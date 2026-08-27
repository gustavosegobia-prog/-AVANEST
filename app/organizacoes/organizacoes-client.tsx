"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { BrandMark } from "@/components/brand-mark";

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

export function OrganizacoesClient({ nome, organizacoes }: { nome: string; organizacoes: Organizacao[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [aviso, setAviso] = useState("");

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
            <div className={`orgRow ${vencida(org) ? "vencida" : ""}`} key={org.id}>
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
          ))}
      </section>
    </div>
  </main>;
}
