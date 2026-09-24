"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { BrandMark } from "@/components/brand-mark";
import { bloqueioParaExcluir, confirmacaoConfere } from "@/lib/exclusao-de-organizacao";

type Organizacao = {
  id: string; nome: string; tipo: string; plano: string; assinatura_ate: string | null;
  profissionais: number; usuarios: number; valor_mensal: number;
  pacientes: number; avaliacoes: number; criada_em: string;
  plano_codigo: string | null; plano_nome: string | null;
  preco_fundador: boolean; max_profissionais: number | null;
  contratado_em: string | null; fundador_perdido: boolean;
};

const PLANOS: Array<[string, string]> = [
  ["trial", "Teste grátis"], ["ativo", "Assinatura ativa"], ["cortesia", "Cortesia"],
  ["suspenso", "Suspensa"], ["cancelado", "Cancelada"],
];
const dinheiro = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "sem prazo");
const vencida = (o: Organizacao) =>
  ["suspenso", "cancelado"].includes(o.plano) ||
  (o.assinatura_ate !== null && new Date(o.assinatura_ate) <= new Date());

/** Quanto a gaveta abre, e a partir de quanto ela decide abrir sozinha. */
const GAVETA_LARGURA = 132;
const GAVETA_ABRE = 56;

export function OrganizacoesClient({ nome, organizacoes, minhaOrganizacao }: {
  nome: string; organizacoes: Organizacao[]; minhaOrganizacao: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [aviso, setAviso] = useState("");
  /** A organização que está com a confirmação de exclusão aberta. */
  const [excluindo, setExcluindo] = useState<Organizacao | null>(null);
  const [digitado, setDigitado] = useState("");

  async function excluir(org: Organizacao) {
    setBusy(org.id);
    setAviso("");
    const { error } = await createClient().rpc("excluir_organizacao", { p_id: org.id });
    setBusy("");
    if (error) { setAviso(error.message); return; }
    setExcluindo(null); setDigitado("");
    router.refresh();
  }

  // A validade é calculada no banco: relógio de navegador não define cobrança.
  async function alterar(org: Organizacao, plano: string, meses: number | null) {
    setBusy(org.id);
    setAviso("");
    const { error } = await createClient().rpc("definir_assinatura", {
      p_institution_id: org.id, p_plano: plano, p_meses: meses,
    });
    setBusy("");
    if (error) { setAviso(error.message); return; }
    router.refresh();
  }

  const receita = organizacoes
    .filter((o) => o.plano === "ativo" && !vencida(o))
    .reduce((soma, o) => soma + Number(o.valor_mensal), 0);
  const emTeste = organizacoes.filter((o) => o.plano === "trial" && !vencida(o)).length;
  const inadimplentes = organizacoes.filter(vencida).length;

  return <main className="clinicalShell">
    <header className="clinicalTopbar">
      <Link className="clinicalBrand" href="/dashboard">
        <BrandMark className="clinicalBrandMark" />
        <span><strong>AVANEST</strong><small>Administração da plataforma</small></span>
      </Link>
      <div className="orgBadge"><strong>Super-admin</strong><small>{nome}</small></div>
      <nav className="roleNav">
        <Link href="/organizacoes/planos">Planos e campanha</Link>
        <Link href="/dashboard">Voltar ao sistema</Link>
      </nav>
    </header>

    <div className="clinicalMain adminMain">
      <section>
        <h1>Organizações</h1>
        <p>Todas as organizações que usam o AVANEST, com assinatura, uso e faturamento.</p>
      </section>

      {aviso && <p className="clinicalError" role="alert">{aviso}</p>}

      <section className="metricGrid adminMetrics">
        <div className="metricCard"><strong className="green">{dinheiro(receita)}</strong><span>Receita mensal recorrente</span></div>
        <div className="metricCard"><strong className="blue">{organizacoes.length}</strong><span>Organizações</span></div>
        <div className="metricCard"><strong className="amber">{emTeste}</strong><span>Em teste grátis</span></div>
        <div className="metricCard"><strong className="red">{inadimplentes}</strong><span>Vencidas ou suspensas</span></div>
      </section>

      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Assinaturas</strong>
        </div>
        {organizacoes.length === 0
          ? <div className="emptyClinical compactEmpty">Nenhuma organização cadastrada.</div>
          : organizacoes.map((org) => (
            <OrgComGaveta
              key={org.id}
              bloqueio={bloqueioParaExcluir({
                nome: org.nome, pacientes: org.pacientes, avaliacoes: org.avaliacoes,
                usuarios: org.usuarios, minha: org.id === minhaOrganizacao,
              })}
              nome={org.nome}
              onPedirExclusao={() => { setExcluindo(org); setDigitado(""); setAviso(""); }}
            >
            <div className={`orgRow ${vencida(org) ? "vencida" : ""}`}>
              <span className="orgRowNome">
                <strong>
                  {org.nome}
                  {org.preco_fundador && <em className="planoAdminTag campanha">Fundador</em>}
                  {/* Sem isto não dá para responder "por que esse aqui paga o
                      preço cheio se ainda sobra vaga?" — cancelou uma vez. */}
                  {org.fundador_perdido && !org.preco_fundador && (
                    <em className="planoAdminTag">Fora da campanha</em>
                  )}
                </strong>
                <small>
                  {org.tipo === "individual" ? "Individual" : "Grupo"} ·{" "}
                  {org.profissionais} anestesiologista(s)
                  {org.max_profissionais !== null && <> de {org.max_profissionais} do plano</>} ·{" "}
                  {org.usuarios} usuário(s) · {org.pacientes} paciente(s) ·{" "}
                  {org.avaliacoes} avaliação(ões)
                </small>
              </span>
              <span className="orgRowPlano">
                <b>{PLANOS.find(([v]) => v === org.plano)?.[1] ?? org.plano}</b>
                <small>{vencida(org) ? "venceu em" : "até"} {data(org.assinatura_ate)}</small>
              </span>
              <span className="orgRowValor">
                <b>{dinheiro(org.valor_mensal)}</b>
                {/* Sem plano contratado o valor é a conta antiga, por cabeça:
                    dizer "por mês" ali daria a entender que já foi cobrado. */}
                <small>{org.plano_nome ? `${org.plano_nome} · por mês` : "sem plano contratado"}</small>
              </span>
              <select
                className="orgRowAcao"
                value=""
                disabled={busy === org.id}
                onChange={(event) => {
                  const [plano, meses] = event.target.value.split(":");
                  if (plano) void alterar(org, plano, meses === "null" ? null : Number(meses));
                  event.target.value = "";
                }}
              >
                <option value="">{busy === org.id ? "Salvando..." : "Alterar..."}</option>
                <option value="ativo:1">Ativar por 1 mês</option>
                <option value="ativo:12">Ativar por 12 meses</option>
                <option value="trial:0.5">Estender teste por 15 dias</option>
                <option value="cortesia:6">Cortesia por 6 meses</option>
                <option value="cortesia:null">Cortesia sem prazo</option>
                <option value="suspenso:null">Suspender</option>
                <option value="cancelado:null">Cancelar</option>
              </select>
            </div>
            </OrgComGaveta>
          ))}
      </section>

      {/* A CONFIRMAÇÃO É DIGITAR O NOME, e não um "tem certeza?". Caixa de
          certeza é clicada no automático — é o mesmo gesto de fechar um aviso —
          e aqui o gesto não tem volta. Copiar o nome obriga a olhar QUAL linha
          vai sumir, que é justamente o erro a evitar: excluir a de baixo. */}
      {excluindo && (
        <div className="patientModalBackdrop" onClick={(e) => { if (e.target === e.currentTarget) setExcluindo(null); }}>
          <div className="patientModal orgExcluirModal" role="dialog" aria-modal="true" aria-labelledby="excluir-org">
            <div className="patientModalHead">
              <div>
                <h2 id="excluir-org">Excluir definitivamente</h2>
                <p>Esta ação não tem volta. A organização e tudo que ela tem de configuração somem do sistema.</p>
              </div>
              <button type="button" onClick={() => setExcluindo(null)} aria-label="Fechar sem excluir">×</button>
            </div>
            <div className="patientModalCorpo">
              <p className="orgExcluirNome">{excluindo.nome}</p>
              <label className="evalField">
                <span>Para confirmar, digite o nome da organização</span>
                <input value={digitado} onChange={(e) => setDigitado(e.target.value)} autoFocus
                  placeholder={excluindo.nome} />
              </label>
            </div>
            <div className="modalActions">
              <button type="button" className="outlineClinical" onClick={() => setExcluindo(null)}>Cancelar</button>
              <button type="button" className="primaryClinical perigo"
                disabled={busy === excluindo.id || !confirmacaoConfere(digitado, excluindo.nome)}
                onClick={() => void excluir(excluindo)}>
                {busy === excluindo.id ? "Excluindo..." : "Excluir para sempre"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </main>;
}

/**
 * A gaveta que aparece ao puxar a linha para a esquerda.
 *
 * Mesmo gesto da escala, e de propósito: quem já apagou um plantão arrastando
 * não precisa aprender nada novo aqui.
 *
 * NO COMPUTADOR NÃO EXISTE ARRASTAR COM O DEDO, e por isso o botão também
 * aparece ao passar o mouse na linha. Fosse só o toque, a tela mais usada pelo
 * dono do produto — que administra pelo monitor — não teria a função.
 *
 * Organização que não pode ser excluída não ganha gaveta nenhuma: o motivo
 * aparece como dica na linha. Botão que existe para recusar ensina a tentar.
 */
function OrgComGaveta({ bloqueio, nome, onPedirExclusao, children }: {
  bloqueio: string | null;
  nome: string;
  onPedirExclusao: () => void;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);

  if (bloqueio) return <div className="orgSemGaveta" title={`${nome} — ${bloqueio}`}>{children}</div>;

  return (
    <div className="orgArrasta">
      <div
        className="orgArrastaCorpo"
        style={{ transform: `translateX(${dx}px)`, transition: arrastando ? "none" : undefined }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          inicio.current = { x: t.clientX, y: t.clientY };
          setArrastando(true);
        }}
        onTouchMove={(e) => {
          if (!inicio.current) return;
          const t = e.touches[0];
          const andou = t.clientX - inicio.current.x;
          // Rolagem vertical vence: descer a lista com o polegar torto não pode
          // abrir gaveta em cada linha por onde o dedo passa.
          if (Math.abs(t.clientY - inicio.current.y) > Math.abs(andou)) { setDx(0); return; }
          setDx(Math.max(-GAVETA_LARGURA, Math.min(0, andou)));
        }}
        onTouchEnd={() => {
          setArrastando(false);
          setDx((d) => (d < -GAVETA_ABRE ? -GAVETA_LARGURA : 0));
          inicio.current = null;
        }}
      >
        {children}
      </div>
      <button type="button" className="orgGaveta"
        aria-label={`Excluir ${nome} definitivamente`}
        onClick={() => { setDx(0); onPedirExclusao(); }}>
        Excluir
      </button>
    </div>
  );
}
