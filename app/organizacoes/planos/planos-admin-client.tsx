"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { BrandMark } from "@/components/brand-mark";
import { Icone } from "@/components/icone";

// Tabela de preços e campanha de lançamento.
//
// Nada aqui grava direto nas tabelas: as duas são só de leitura para o
// navegador. Toda alteração passa por definir_preco_plano ou
// configurar_campanha, que conferem super_admin por dentro e deixam registro
// na auditoria. Mudar preço de tabela nunca reprecifica quem já assinou —
// o valor de cada cliente está congelado em instituicoes.preco_contratado.

type Plano = {
  codigo: string; nome: string; descricao: string;
  preco_mensal: number | null; min_profissionais: number;
  max_profissionais: number | null; destaque: boolean;
  sob_consulta: boolean; ordem: number; ativo: boolean;
};

type Campanha = {
  ativa: boolean; limite: number; preco: number;
  plano_codigo: string; rotulo: string;
} | null;

type Vagas = {
  ativa: boolean; limite: number; ocupadas: number; restantes: number;
  meses_gratis: number; termina_em: string | null;
  preco: number; preco_padrao: number | null; rotulo: string; plano_codigo: string;
} | null;

const dinheiro = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const equipe = (p: Plano) =>
  p.max_profissionais === null
    ? `${p.min_profissionais}+ anestesiologistas`
    : p.min_profissionais === p.max_profissionais
      ? `${p.max_profissionais} anestesiologista`
      : `${p.min_profissionais} a ${p.max_profissionais} anestesiologistas`;

export function PlanosAdminClient({
  nome, planos, campanha, vagas,
}: { nome: string; planos: Plano[]; campanha: Campanha; vagas: Vagas }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");

  // Rascunho por plano: o campo só vira preço no banco quando se clica em
  // salvar, para não disparar uma gravação a cada tecla.
  const [precos, setPrecos] = useState<Record<string, string>>(() =>
    Object.fromEntries(planos.map((p) => [p.codigo, p.preco_mensal == null ? "" : String(p.preco_mensal)])),
  );
  const [limite, setLimite] = useState(String(campanha?.limite ?? 100));
  const [precoCampanha, setPrecoCampanha] = useState(String(campanha?.preco ?? 89));

  // O builder do supabase-js é "thenable", não Promise: tipar como PromiseLike
  // deixa passar tanto ele quanto uma Promise de verdade.
  async function executar(
    chave: string,
    fn: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setBusy(chave); setErro(""); setAviso("");
    const { error } = await fn();
    setBusy("");
    if (error) { setErro(error.message); return; }
    setAviso("Alteração salva.");
    router.refresh();
  }

  const salvarPreco = (codigo: string) => {
    const valor = Number(precos[codigo]?.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) { setErro("Informe um valor válido."); return; }
    void executar(codigo, () =>
      createClient().rpc("definir_preco_plano", { p_codigo: codigo, p_preco: valor }));
  };

  const alternarAtivo = (p: Plano) =>
    void executar(`ativo:${p.codigo}`, () =>
      createClient().rpc("definir_preco_plano", { p_codigo: p.codigo, p_ativo: !p.ativo }));

  const salvarCampanha = () => {
    const l = Number(limite);
    const v = Number(precoCampanha.replace(",", "."));
    if (!Number.isInteger(l) || l < 0) { setErro("O limite precisa ser um número inteiro."); return; }
    if (!Number.isFinite(v) || v < 0) { setErro("Informe um valor válido para a campanha."); return; }
    void executar("campanha", () =>
      createClient().rpc("configurar_campanha", { p_limite: l, p_preco: v }));
  };

  const alternarCampanha = () =>
    void executar("campanha:ativa", () =>
      createClient().rpc("configurar_campanha", { p_ativa: !campanha?.ativa }));

  const ocupadas = Number(vagas?.ocupadas ?? 0);
  const limiteAtual = Number(vagas?.limite ?? 0);
  const restantes = Number(vagas?.restantes ?? 0);
  const mesesGratis = Number(vagas?.meses_gratis ?? 0);
  // A campanha passou a fechar por data, não por vaga. O `ativa` que a função
  // devolve já leva o prazo em conta.
  const promocaoValendo = Boolean(vagas?.ativa) && mesesGratis > 0;
  const terminaEm = vagas?.termina_em
    ? new Date(`${vagas.termina_em}T12:00:00`).toLocaleDateString("pt-BR")
    : null;
  const planoDaCampanha = planos.find((p) => p.codigo === campanha?.plano_codigo);

  return <main className="clinicalShell">
    <header className="clinicalTopbar">
      <Link className="clinicalBrand" href="/dashboard">
        <BrandMark className="clinicalBrandMark" />
        <span><strong>AVANEST</strong><small>Administração da plataforma</small></span>
      </Link>
      <div className="orgBadge"><strong>Super-admin</strong><small>{nome}</small></div>
      <nav className="roleNav">
        <Link href="/organizacoes">Organizações</Link>
        <Link href="/dashboard">Voltar ao sistema</Link>
      </nav>
    </header>

    <div className="clinicalMain adminMain">
      <section>
        <h1>Planos e campanha</h1>
        <p>
          A tabela de preços vale para quem assinar daqui em diante. Quem já
          contratou mantém o valor congelado — reajustar aqui não reprecifica
          nenhum cliente antigo.
        </p>
      </section>

      {erro && <p className="clinicalError" role="alert">{erro}</p>}
      {aviso && <p className="clinicalOk" role="status">{aviso}</p>}

      <section className="metricGrid adminMetrics">
        <div className="metricCard">
          <strong className={promocaoValendo ? "green" : ""}>{mesesGratis}</strong>
          <span>{mesesGratis === 1 ? "Mês grátis concedido" : "Meses grátis concedidos"}</span>
        </div>
        <div className="metricCard">
          <strong className={promocaoValendo ? "green" : "amber"}>{terminaEm ?? "sem prazo"}</strong>
          <span>Campanha vale até</span>
        </div>
        <div className="metricCard"><strong className="blue">{ocupadas}</strong><span>Organizações que já entraram</span></div>
        <div className="metricCard">
          <strong className={vagas?.ativa ? "green" : "amber"}>{vagas?.ativa ? "Ligada" : "Encerrada"}</strong>
          <span>Situação da campanha</span>
        </div>
        <div className="metricCard">
          <strong>{dinheiro(Number(vagas?.preco ?? 0))}</strong>
          <span>Preço de lançamento</span>
        </div>
      </section>

      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Campanha de lançamento</strong>
          <span>
            {planoDaCampanha
              ? `aplica-se ao plano ${planoDaCampanha.nome}`
              : "plano da campanha não encontrado"}
          </span>
        </div>

        <div className="campanhaBarraLinha">
          <div
            className="planosContadorBarra escura"
            role="progressbar"
            aria-valuenow={ocupadas}
            aria-valuemin={0}
            aria-valuemax={limiteAtual || 1}
            aria-label={`${ocupadas} de ${limiteAtual} vagas preenchidas`}
          >
            <span style={{ width: `${Math.min(100, (ocupadas / Math.max(1, limiteAtual)) * 100)}%` }} />
          </div>
          <b>{ocupadas}/{limiteAtual}</b>
        </div>

        <div className="campanhaForm">
          <label className="clinicalField">
            <span>Limite de vagas</span>
            <input
              type="number" min={0} step={1} inputMode="numeric"
              value={limite} onChange={(e) => setLimite(e.target.value)}
            />
          </label>
          <label className="clinicalField">
            <span>Preço de lançamento (R$/mês)</span>
            <input
              type="text" inputMode="decimal"
              value={precoCampanha} onChange={(e) => setPrecoCampanha(e.target.value)}
            />
          </label>
          <div className="campanhaAcoes">
            <button
              className="primaryClinical"
              onClick={salvarCampanha}
              disabled={busy === "campanha"}
            >
              {busy === "campanha" ? "Salvando..." : "Salvar campanha"}
            </button>
            <button
              className={`outlineClinical${campanha?.ativa ? " whatsappAction" : ""}`}
              onClick={alternarCampanha}
              disabled={busy === "campanha:ativa"}
            >
              <Icone nome={campanha?.ativa ? "pausa" : "estrela"} />
              {busy === "campanha:ativa"
                ? "Salvando..."
                : campanha?.ativa ? "Encerrar promoção" : "Reativar campanha"}
            </button>
          </div>
        </div>

        <p className="campanhaAjuda">
          Encerrar a promoção faz os novos clientes pagarem o preço de tabela do
          plano {planoDaCampanha?.nome ?? "da campanha"}. Quem já entrou como
          fundador continua pagando o valor que contratou. Reativar abre a
          campanha de novo com o limite e o preço definidos acima — dá para
          rodar uma nova campanha sem programar nada.
        </p>
      </section>

      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Tabela de preços</strong>
          <span>vale para novas contratações</span>
        </div>

        {planos.map((plano) => (
          <div className={`planoAdminRow${plano.ativo ? "" : " inativo"}`} key={plano.codigo}>
            <span className="planoAdminNome">
              <strong>
                {plano.nome}
                {plano.destaque && <em className="planoAdminTag">Mais escolhido</em>}
                {plano.codigo === campanha?.plano_codigo && (
                  <em className="planoAdminTag campanha">Campanha</em>
                )}
              </strong>
              <small>{equipe(plano)}{plano.ativo ? "" : " · fora da vitrine"}</small>
            </span>

            {plano.sob_consulta ? (
              <span className="planoAdminSobConsulta">Sob consulta — sem preço na vitrine</span>
            ) : (
              <span className="planoAdminPreco">
                <input
                  type="text" inputMode="decimal" aria-label={`Preço mensal do plano ${plano.nome}`}
                  value={precos[plano.codigo] ?? ""}
                  onChange={(e) => setPrecos((p) => ({ ...p, [plano.codigo]: e.target.value }))}
                />
                <button
                  className="outlineClinical"
                  onClick={() => salvarPreco(plano.codigo)}
                  disabled={busy === plano.codigo}
                >
                  {busy === plano.codigo ? "Salvando..." : "Salvar"}
                </button>
              </span>
            )}

            <button
              className="outlineClinical"
              onClick={() => alternarAtivo(plano)}
              disabled={busy === `ativo:${plano.codigo}`}
            >
              {plano.ativo ? "Tirar da vitrine" : "Publicar"}
            </button>
          </div>
        ))}
      </section>
    </div>
  </main>;
}
