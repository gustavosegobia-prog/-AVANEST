"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";
import {
  corpoDaFolha, escaparHTML, faixa, hhmm, iniciais, money,
  montarICS, periodoDoTurno, plural, somarHoras,
} from "@/lib/escala";

// Plantões: a escala, o valor e a troca.
//
// A aba fica no topo, ao lado de Médico, porque plantão não é assunto do
// Financeiro — é o trabalho em si. Quem entra aqui quer três respostas:
// onde eu trabalho este mês, quanto isso dá, e quem cobre o dia que eu não
// posso.
//
// O modelo é a ideia central. "Mamborê diurno, 07:00–19:00, R$ 1.100" fica
// salvo, e lançar o mês vira um toque por dia em vez de cinco campos. Foi
// copiado do caderno que o próprio médico já mantém no celular — não é
// invenção nossa, é o hábito que já existe.

type Modelo = {
  id: string; nome: string; local_id: string | null; owner_id: string | null;
  hora_inicio: string; hora_fim: string; valor: number; cor: string; ativo: boolean;
};
type Plantao = {
  id: string; perfil_id: string; local_id: string | null; modelo_id: string | null;
  data: string; hora_inicio: string; hora_fim: string; horas: number;
  valor: number; situacao: string; pago_em: string | null;
  aberto_para_troca: boolean; observacoes: string | null;
};
type Colega = { id: string; nome: string };
type Troca = {
  id: string; plantao_id: string; solicitante_id: string;
  destinatario_id: string | null; status: string; mensagem: string | null;
  created_at: string;
};

const MESES = ["janeiro","fevereiro","março","abril","maio","junho",
               "julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS = ["D","S","T","Q","Q","S","S"];

// Atalhos de duração. 6h e 12h cobrem o padrão; o horário continua editável,
// porque plantão de 24h e cobertura de 4h existem e não podem ficar de fora.
const DURACOES = [6, 12, 24] as const;

/**
 * A folha da escala, numa janela só dela.
 *
 * Janela nova, e não impressão da própria tela. A alternativa seria esconder o
 * painel inteiro no @media print, e o site já tem regras de impressão para a
 * ficha e para o termo — mexer no que vale para "tudo" para acertar uma tela
 * põe em risco o documento que o paciente leva assinado para casa.
 *
 * Aqui a folha é escrita do zero, com o CSS dela junto: o que sai na
 * impressora é exatamente o que está nesta função, e nada mais.
 */
function imprimirFolha(titulo: string, corpo: string): boolean {
  const janela = window.open("", "_blank", "width=1100,height=800");
  if (!janela) return false;
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escaparHTML(titulo)}</title><style>
@page{size:A4 landscape;margin:9mm}
*{box-sizing:border-box}
body{margin:0;font:12px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#111}
h1{font-size:17px;margin:0 0 2px}
.sub{color:#555;font-size:11.5px;margin:0 0 12px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#444;
   padding:5px 4px;border:1px solid #bbb;background:#f1f1f1}
td{border:1px solid #bbb;vertical-align:top;height:88px;padding:4px 5px}
td.vazio{background:#fafafa}
td .d{font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:3px}
td .t{display:block;margin-bottom:3px;line-height:1.25}
td .t b{font-size:10.5px;display:block}
td .t span{font-size:10px;color:#333}
.lista{margin-top:14px}
.lista td,.lista th{height:auto;padding:5px 7px;font-size:11px}
.lista td{vertical-align:middle}
/* O resumo do grupo tem três colunas curtas: em largura total elas viram três
   faixas de 9cm com uma palavra dentro cada. */
.lista.resumo{max-width:460px}
.rodape{margin-top:10px;font-size:9.5px;color:#666;display:flex;justify-content:space-between}
tr,td,th{break-inside:avoid;page-break-inside:avoid}
</style></head><body>${corpo}</body></html>`);
  janela.document.close();
  janela.focus();
  // O print imediato pega a folha antes de o navegador medir a tabela, e sai
  // com a primeira linha cortada. 300ms é o suficiente — não há imagem a
  // carregar, só texto para posicionar.
  setTimeout(() => janela.print(), 300);
  return true;
}

/**
 * Entrega um arquivo ao usuário sem passar por servidor nenhum.
 *
 * A escala já está na memória da aba; mandá-la para um endpoint só para
 * receber de volta seria expor o mês inteiro de plantões numa requisição que
 * não precisa existir.
 */
function baixar(nome: string, conteudo: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  // Sem o revoke, cada exportação deixa o arquivo inteiro preso na memória da
  // aba até ela fechar. O atraso existe porque revogar antes de o download
  // começar cancela o próprio download no Safari.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Uma cor por médico, estável.
 *
 * O índice vem da posição na lista da equipe, e não de um sorteio: a mesma
 * pessoa precisa ter a mesma cor toda vez que a tela abre, senão a cor não
 * ajuda a reconhecer ninguém — vira enfeite.
 */
const CORES_MEDICO = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8"] as const;

export function Plantoes({
  perfilId, institutionId, locais, ehAdmin, colegas,
}: {
  perfilId: string;
  institutionId: string;
  locais: LocalDisponivel[];
  ehAdmin: boolean;
  colegas: Colega[];
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const [aba, setAba] = useState<"escala" | "modelos" | "trocas">("escala");
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [plantoes, setPlantoes] = useState<Plantao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [trocas, setTrocas] = useState<Troca[]>([]);
  // Escala do grupo ou só a minha. Duas leituras da mesma tela: "onde eu
  // trabalho este mês" e "quem está de plantão no dia 12".
  const [escopo, setEscopo] = useState<"minha" | "grupo">("minha");
  const [pedindoTroca, setPedindoTroca] = useState<Plantao | null>(null);
  // Lançar sem modelo. O modelo é atalho, não pré-requisito: exigir que a
  // pessoa crie um modelo antes de registrar o primeiro plantão é uma parede
  // logo na entrada, e foi exatamente onde a tela travou no primeiro uso.
  const [lancando, setLancando] = useState<string | null>(null);

  const nomePorId = useMemo(() => new Map(colegas.map((c) => [c.id, c.nome])), [colegas]);
  const localPorId = useMemo(() => new Map(locais.map((l) => [l.id, nomeDoLocal(l)])), [locais]);
  // O calendário precisa dizer QUAL plantão é, não só que existe um. Cor e
  // nome vêm do modelo; sem modelo, o rótulo cai no horário, que ainda
  // distingue diurno de noturno.
  const modeloPorId = useMemo(() => new Map(modelos.map((mo) => [mo.id, mo])), [modelos]);
  const corPorMedico = useMemo(() => {
    const m = new Map<string, string>();
    colegas.forEach((c, i) => m.set(c.id, CORES_MEDICO[i % CORES_MEDICO.length]));
    return m;
  }, [colegas]);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [ano, m] = mes.split("-").map(Number);
    const primeiro = `${mes}-01`;
    const ultimo = new Date(ano, m, 0).toISOString().slice(0, 10);
    const [{ data: mods }, { data: plans, error }, { data: trs }] = await Promise.all([
      supabase.from("modelos_plantao").select("*").eq("ativo", true).order("nome"),
      supabase.from("plantoes").select("*").gte("data", primeiro).lte("data", ultimo).order("data"),
      supabase.from("trocas_plantao").select("*").eq("status", "pendente").order("created_at", { ascending: false }),
    ]);
    setCarregando(false);
    if (error) { setErro("Não foi possível carregar os plantões."); return; }
    setModelos((mods ?? []) as Modelo[]);
    setPlantoes((plans ?? []) as Plantao[]);
    setTrocas((trs ?? []) as Troca[]);
  }, [mes]);

  useEffect(() => { void carregar(); }, [carregar]);

  const meus = plantoes.filter((p) => p.perfil_id === perfilId && p.situacao !== "cancelado");
  const resumo = useMemo(() => {
    const total = meus.reduce((s, p) => s + Number(p.valor), 0);
    const pago = meus.filter((p) => p.situacao === "pago").reduce((s, p) => s + Number(p.valor), 0);
    const horas = meus.reduce((s, p) => s + Number(p.horas), 0);
    return { total, pago, aberto: total - pago, horas, turnos: meus.length };
  }, [meus]);

  function mudarMes(passo: number) {
    const [ano, m] = mes.split("-").map(Number);
    const d = new Date(ano, m - 1 + passo, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  async function lancar(dia: string, modelo: Modelo) {
    setErro(""); setAviso("");
    const supabase = createClient();
    const { error } = await supabase.from("plantoes").insert({
      institution_id: institutionId, perfil_id: perfilId,
      local_id: modelo.local_id, modelo_id: modelo.id,
      data: dia, hora_inicio: modelo.hora_inicio, hora_fim: modelo.hora_fim,
      valor: modelo.valor, created_by: perfilId,
    });
    if (error) {
      setErro(error.code === "23505"
        ? "Você já tem um plantão nesse dia e horário."
        : "Não foi possível lançar o plantão.");
      return;
    }
    setDiaAberto(null);
    void carregar();
  }

  async function lancarAvulso(dados: {
    data: string; local_id: string; hora_inicio: string; hora_fim: string;
    valor: number; perfil_id: string;
  }) {
    setErro(""); setAviso("");
    // Quem monta a escala do serviço lança para os outros; quem não é
    // administrador só lança para si — o RLS recusaria de qualquer forma, e
    // forçar aqui evita a tentativa virar um erro seco na tela.
    const dono = ehAdmin && dados.perfil_id ? dados.perfil_id : perfilId;
    const { error } = await createClient().from("plantoes").insert({
      institution_id: institutionId, perfil_id: dono,
      local_id: dados.local_id || null, data: dados.data,
      hora_inicio: dados.hora_inicio, hora_fim: dados.hora_fim,
      // O valor de um plantão que você escala para outra pessoa é combinado
      // entre ela e quem paga: entra zero, e ela ajusta na própria lista.
      valor: dono === perfilId ? dados.valor : 0, created_by: perfilId,
    });
    if (error) {
      setErro(error.code === "23505"
        ? dono === perfilId
          ? "Você já tem um plantão nesse dia e horário."
          : `${nomePorId.get(dono) ?? "Esse profissional"} já tem um plantão nesse dia e horário.`
        : "Não foi possível lançar o plantão.");
      return;
    }
    setLancando(null);
    if (dono !== perfilId) {
      setAviso(`Plantão lançado para ${nomePorId.get(dono) ?? "o profissional"}. Ele aparece na escala dele, que pode ajustar o valor e pedir troca.`);
    }
    void carregar();
  }

  async function atualizar(id: string, campos: Partial<Plantao>) {
    setErro("");
    const supabase = createClient();
    const { error } = await supabase.from("plantoes")
      .update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setErro("Não foi possível salvar a alteração."); return; }
    void carregar();
  }

  async function pedirTroca(plantao: Plantao, destinatarioId: string, mensagem: string) {
    setErro(""); setAviso("");
    const supabase = createClient();
    const { error } = await supabase.from("trocas_plantao").insert({
      institution_id: institutionId, plantao_id: plantao.id,
      solicitante_id: perfilId,
      // String vazia significa "todo o grupo"; o banco guarda null, que é o
      // que aceitar_troca lê para saber que qualquer um pode assumir.
      destinatario_id: destinatarioId || null,
      mensagem: mensagem.trim() || null,
    });
    if (error) { setErro("Não foi possível registrar o pedido de troca."); return; }
    await supabase.from("plantoes").update({ aberto_para_troca: true }).eq("id", plantao.id);
    setPedindoTroca(null);
    setAviso(destinatarioId
      ? "Convite enviado. Ele aparece na aba Trocas do colega."
      : "Plantão oferecido ao grupo. Qualquer colega pode assumir.");
    void carregar();
  }

  async function responderTroca(trocaId: string, acao: "aceitar_troca" | "recusar_troca" | "cancelar_troca") {
    setErro(""); setAviso("");
    const { error } = await createClient().rpc(acao, { p_troca_id: trocaId });
    if (error) { setErro(error.message); return; }
    setAviso(acao === "aceitar_troca"
      ? "Plantão assumido. A escala foi atualizada e a troca ficou registrada na auditoria."
      : acao === "recusar_troca" ? "Convite recusado." : "Pedido cancelado.");
    void carregar();
  }

  async function remover(id: string) {
    if (!confirm("Remover este plantão da escala?")) return;
    const supabase = createClient();
    await supabase.from("plantoes").delete().eq("id", id);
    void carregar();
  }

  const hojeISO = new Date().toISOString().slice(0, 10);
  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const primeiroDiaSemana = new Date(ano, m - 1, 1).getDay();

  // O que a tela está mostrando, uma vez só. O calendário, a lista, a folha
  // impressa e o arquivo de agenda leem daqui — se cada um refizesse o filtro,
  // bastaria um deles esquecer o "situacao !== cancelado" para a escala
  // impressa sair diferente da que está na tela.
  const daEscala = useMemo(
    () => plantoes.filter((p) => p.situacao !== "cancelado"
      && (escopo === "grupo" || p.perfil_id === perfilId)),
    [plantoes, escopo, perfilId],
  );

  /** Os turnos de um dia, agrupados por horário: é como a escala é lida. */
  const turnosDoDia = useCallback((dia: string) => {
    const doDia = daEscala.filter((p) => p.data === dia);
    return Object.values(doDia.reduce<Record<string, {
      chave: string; inicio: string; fim: string; horas: number; gente: Plantao[];
    }>>((acc, p) => {
      const chave = `${p.hora_inicio}|${p.hora_fim}`;
      acc[chave] ??= { chave, inicio: p.hora_inicio, fim: p.hora_fim, horas: Number(p.horas), gente: [] };
      acc[chave].gente.push(p);
      return acc;
    }, {})).sort((a, b) => a.inicio.localeCompare(b.inicio));
  }, [daEscala]);

  /**
   * A escala no calendário do celular.
   *
   * O mesmo arquivo serve aos dois: o iPhone abre .ics direto no Calendário e o
   * Google Agenda importa em Configurações → Importar. Não há "botão do
   * Google" separado porque o link do Google cria um evento por vez, e uma
   * escala tem vinte.
   */
  function exportarAgenda() {
    setErro(""); setAviso("");
    if (daEscala.length === 0) { setErro("Não há plantão neste mês para exportar."); return; }
    baixar(
      `escala-${escopo}-${mes}.ics`,
      montarICS(daEscala.map((p) => ({
        id: p.id, data: p.data, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim,
        titulo: escopo === "grupo"
          ? `Plantão · ${nomePorId.get(p.perfil_id) ?? "equipe"}`
          : `Plantão${p.local_id ? ` · ${localPorId.get(p.local_id) ?? ""}` : ""}`,
        onde: p.local_id ? localPorId.get(p.local_id) ?? "" : "",
      }))),
      "text/calendar;charset=utf-8",
    );
    setAviso("Arquivo baixado. No iPhone, toque nele e escolha Adicionar. No Google Agenda: Configurações → Importar e exportar → Importar.");
  }

  /**
   * A escala em papel.
   *
   * Duas folhas diferentes, e não uma com um filtro: a do grupo é a que se
   * prega na parede, e nela não entra valor nenhum — quanto cada um recebe é
   * assunto dele com quem paga, e uma folha na parede do centro cirúrgico é
   * lida por todo mundo que passa. A pessoal é a que vai junto do talão, e essa
   * traz o valor porque é para isso que ela serve.
   */
  function imprimirEscala() {
    setErro(""); setAviso("");
    if (daEscala.length === 0) { setErro("Não há plantão neste mês para imprimir."); return; }
    const { titulo, corpo } = corpoDaFolha({
      doGrupo: escopo === "grupo",
      mes, nomeMes: MESES[m - 1], ano, diasNoMes, primeiroDiaSemana,
      impressoEm: new Date(),
      plantoes: daEscala.map((p) => ({
        data: p.data, hora_inicio: p.hora_inicio, hora_fim: p.hora_fim,
        horas: Number(p.horas), valor: Number(p.valor), situacao: p.situacao,
        local: p.local_id ? localPorId.get(p.local_id) ?? "" : "",
        profissional: nomePorId.get(p.perfil_id) ?? "",
      })),
    });
    if (!imprimirFolha(titulo, corpo)) {
      setErro("O navegador bloqueou a janela de impressão. Libere as janelas pop-up para este site e tente de novo.");
    }
  }

  if (carregando) return <div className="emptyClinical">Carregando plantões…</div>;

  return (
    <div className="clinicalMain plantaoMain">
      <section className="clinicalWelcome">
        <div>
          <h1>Escala</h1>
          <p>Seus plantões, o valor de cada turno e as trocas com a equipe.</p>
        </div>
      </section>

      {erro && <p className="clinicalError">{erro}</p>}
      {aviso && <p className="financeSuccess" role="status">{aviso}</p>}

      <section className="metricGrid plantaoMetrics">
        <div className="metricCard"><strong>{resumo.turnos}</strong><span>Plantões no mês</span></div>
        <div className="metricCard"><strong>{resumo.horas.toLocaleString("pt-BR")}h</strong><span>Horas</span></div>
        <div className="metricCard"><strong className="blue">{money(resumo.total)}</strong><span>Total do mês</span></div>
        <div className="metricCard"><strong className="green">{money(resumo.pago)}</strong><span>Recebido</span></div>
        <div className="metricCard"><strong className="amber">{money(resumo.aberto)}</strong><span>A receber</span></div>
      </section>

      <div className="financeChips plantaoAbas" role="group" aria-label="Seções dos plantões">
        {([["escala", "Escala"], ["modelos", "Modelos"], ["trocas", "Trocas"]] as const).map(([id, rot]) => (
          <button key={id} type="button" className={aba === id ? "active" : ""} onClick={() => setAba(id)}>{rot}</button>
        ))}
      </div>

      {aba === "escala" && (
        <>
          <div className="plantaoEscopo" role="group" aria-label="De quem é a escala">
            {([["minha", "Minha escala"], ["grupo", "Escala do grupo"]] as const).map(([id, rot]) => (
              <button key={id} type="button" className={escopo === id ? "active" : ""}
                onClick={() => setEscopo(id)}>{rot}</button>
            ))}
            <small>
              {escopo === "minha"
                ? "Só os seus turnos."
                : "Todos os turnos da equipe. Você edita apenas os seus."}
            </small>
          </div>
          <section className="clinicalPanel">
            {/* A barra fica AQUI, colada no calendário, e não no cabeçalho da
                página. Mudar o mês e lançar um plantão são ações sobre o
                calendário: separadas dele por dois blocos de resumo, a pessoa
                trocava o mês e perdia de vista o que tinha mudado. */}
            <div className="plantaoBarra">
              <div className="plantaoMesNav">
                <button className="outlineClinical" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
                <strong>{MESES[m - 1]} {ano}</strong>
                <button className="outlineClinical" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
                {/* Depois de folhear três meses para trás, voltar é um toque. */}
                {mes !== `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}` && (
                  <button className="outlineClinical" onClick={() =>
                    setMes(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`)}>Hoje</button>
                )}
              </div>
              <div className="plantaoBarraAcoes">
                <button className="outlineClinical" onClick={exportarAgenda}
                  title="Baixa um arquivo .ics: o iPhone abre no Calendário e o Google Agenda importa">
                  Google/Apple
                </button>
                <button className="outlineClinical" onClick={imprimirEscala}>Imprimir</button>
                <button className="primaryClinical compact"
                  onClick={() => setLancando(hojeISO.startsWith(mes) ? hojeISO : `${mes}-01`)}>
                  + Lançar plantão
                </button>
              </div>
            </div>
            <div className="plantaoCalendario">
              <div className="plantaoSemana">{DIAS.map((d, i) => <span key={i}>{d}</span>)}</div>
              <div className="plantaoGrade">
                {Array.from({ length: primeiroDiaSemana }).map((_, i) => <span key={`v${i}`} />)}
                {Array.from({ length: diasNoMes }, (_, i) => {
                  const dia = `${mes}-${String(i + 1).padStart(2, "0")}`;
                  const doDia = daEscala.filter((p) => p.data === dia);
                  const fimDeSemana = new Date(`${dia}T12:00:00`).getDay() % 6 === 0;

                  // Na escala do grupo, os turnos iguais viram uma linha só com
                  // as pessoas dentro: "07-19h · GS HM". É como a escala é
                  // lida na parede do hospital — pelo turno, não por pessoa —,
                  // e num serviço com seis anestesistas de dia a lista por
                  // pessoa não caberia em célula nenhuma.
                  const turnos = escopo === "grupo" ? turnosDoDia(dia) : [];

                  return (
                    <button
                      type="button" key={dia}
                      className={`plantaoDia${dia === hojeISO ? " hoje" : ""}${fimDeSemana ? " fds" : ""}${diaAberto === dia ? " aberto" : ""}`}
                      onClick={() => setDiaAberto(diaAberto === dia ? null : dia)}
                      aria-label={`${i + 1} — ${doDia.length ? plural(doDia.length, "plantão", "plantões") : "sem plantão"}`}
                    >
                      <b>{i + 1}</b>
                      <span className="plantaoEtiquetas">
                        {escopo === "grupo"
                          ? <>
                              {turnos.slice(0, 2).map((t) => (
                                <i key={t.chave} className="plantaoTurno"
                                  title={`${periodoDoTurno(t.inicio, t.horas)} ${faixa(t.inicio, t.fim)} — ${t.gente.map((g) => nomePorId.get(g.perfil_id) ?? "").join(", ")}`}>
                                  <b>{faixa(t.inicio, t.fim)}</b>
                                  <span className="plantaoQuem">
                                    {t.gente.slice(0, 4).map((g) => (
                                      <em key={g.id} className={`med-${corPorMedico.get(g.perfil_id) ?? "m8"}${g.perfil_id === perfilId ? " eu" : ""}`}>
                                        {iniciais(nomePorId.get(g.perfil_id) ?? "")}
                                      </em>
                                    ))}
                                    {t.gente.length > 4 && <em className="plantaoMais">+{t.gente.length - 4}</em>}
                                  </span>
                                </i>
                              ))}
                              {turnos.length > 2 && <i className="plantaoMais">+{turnos.length - 2} {turnos.length - 2 === 1 ? "turno" : "turnos"}</i>}
                            </>
                          : <>
                              {/* Escala pessoal: horário e onde. O lugar é o que
                                  muda de um plantão para outro na agenda de quem
                                  roda três hospitais. */}
                              {doDia.slice(0, 2).map((p) => {
                                const mo = p.modelo_id ? modeloPorId.get(p.modelo_id) : undefined;
                                return (
                                  <i key={p.id} className={`plantaoEtiqueta etq-${mo?.cor ?? "cinza"}`}
                                    title={`${periodoDoTurno(p.hora_inicio, Number(p.horas))} ${faixa(p.hora_inicio, p.hora_fim)}${p.local_id ? ` · ${localPorId.get(p.local_id) ?? ""}` : ""}`}>
                                    <b>{faixa(p.hora_inicio, p.hora_fim)}</b>
                                    <span>{p.local_id ? localPorId.get(p.local_id) ?? "Sem local" : "Sem local"}</span>
                                  </i>
                                );
                              })}
                              {doDia.length > 2 && <i className="plantaoMais">+{doDia.length - 2}</i>}
                            </>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {diaAberto && (
            <DiaDetalhe
              dia={diaAberto} plantoes={plantoes.filter((p) => p.data === diaAberto)}
              modelos={modelos} perfilId={perfilId} ehAdmin={ehAdmin}
              nomePorId={nomePorId} localPorId={localPorId}
              onLancar={lancar} onLancarAvulso={(d) => setLancando(d)}
              onRemover={remover}
              onFechar={() => setDiaAberto(null)}
            />
          )}

          <section className="clinicalPanel">
            <div className="panelTitle">
              <strong>{escopo === "grupo" ? `Escala da equipe em ${MESES[m - 1]}` : `Meus plantões em ${MESES[m - 1]}`}</strong>
              <span>o valor é editável no seu próprio plantão: o combinado muda de um turno para outro</span>
            </div>
            {daEscala.length === 0
              ? <div className="emptyClinical compactEmpty">Nenhum plantão lançado neste mês. Toque num dia do calendário para lançar.</div>
              : daEscala.map((p) => {
                const meu = p.perfil_id === perfilId;
                return (
                /* Grade de colunas fixas, e não flex com quebra. As linhas de
                   colega têm menos controles que as suas, e em flex isso
                   empurrava valor, situação e botão para posições diferentes a
                   cada linha — a lista virava um degrau. Aqui cada coluna tem
                   lugar marcado, ocupado ou não. */
                <div className="plantaoLinha escalaLinha" key={p.id}>
                  <span className="plantaoQuando">
                    <strong>{Number(p.data.slice(8, 10))}/{p.data.slice(5, 7)}</strong>
                    <small>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)} · {p.horas}h</small>
                  </span>
                  <span className="plantaoOnde">
                    <strong>{escopo === "grupo" ? nomePorId.get(p.perfil_id) ?? "Profissional" : (p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local")}</strong>
                    <small>{escopo === "grupo" ? (p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local") : null}</small>
                    {p.aberto_para_troca && <small className="plantaoTrocaAviso">oferecido para troca</small>}
                  </span>
                  {/* O valor do colega não é editável nem visível: quanto cada
                      um recebe é assunto dele com quem paga, e a escala não
                      precisa expor isso para funcionar. O RLS recusaria a
                      escrita de qualquer forma; esconder evita a tentativa. */}
                  <span className="plantaoCelula">
                    {meu ? (
                      <label className="inlineMoney">
                        <span>Valor</span>
                        <input
                          defaultValue={Number(p.valor) || ""} placeholder="R$ 0,00" inputMode="decimal"
                          onBlur={(e) => {
                            const v = Number(e.target.value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
                            if (Number.isFinite(v) && v !== Number(p.valor)) void atualizar(p.id, { valor: v });
                          }}
                        />
                      </label>
                    ) : <span className="plantaoDeColega">de colega</span>}
                  </span>
                  <span className="plantaoCelula">
                    {meu && (
                      <label className="inlineMoney">
                        <span>Situação</span>
                        <select value={p.situacao} onChange={(e) => void atualizar(p.id, { situacao: e.target.value })}>
                          <option value="escalado">Escalado</option>
                          <option value="realizado">Realizado</option>
                          <option value="pago">Pago</option>
                          <option value="cancelado">Cancelado</option>
                        </select>
                      </label>
                    )}
                  </span>
                  <span className="plantaoCelula">
                    {meu && (
                      <button className="outlineClinical" onClick={() => setPedindoTroca(p)}>
                        {p.aberto_para_troca ? "Trocar de novo" : "Solicitar troca"}
                      </button>
                    )}
                  </span>
                </div>
                );
              })}
          </section>
        </>
      )}

      {lancando && (
        <LancarPlantao
          dia={lancando} locais={locais} modelos={modelos}
          colegas={colegas} perfilId={perfilId} ehAdmin={ehAdmin}
          onFechar={() => setLancando(null)} onSalvar={lancarAvulso}
        />
      )}

      {pedindoTroca && (
        <PedirTroca
          plantao={pedindoTroca} colegas={colegas.filter((c) => c.id !== perfilId)}
          localPorId={localPorId}
          onFechar={() => setPedindoTroca(null)}
          onEnviar={(destino, msg) => void pedirTroca(pedindoTroca, destino, msg)}
        />
      )}

      {aba === "modelos" && (
        <ModelosPainel
          modelos={modelos} locais={locais} perfilId={perfilId}
          institutionId={institutionId} ehAdmin={ehAdmin}
          onMudou={() => { void carregar(); }}
        />
      )}

      {aba === "trocas" && (
        <TrocasPainel
          trocas={trocas} plantoes={plantoes} perfilId={perfilId}
          nomePorId={nomePorId} localPorId={localPorId} onResponder={responderTroca}
        />
      )}
    </div>
  );
}

function DiaDetalhe({
  dia, plantoes, modelos, perfilId, ehAdmin, nomePorId, localPorId,
  onLancar, onLancarAvulso, onRemover, onFechar,
}: {
  dia: string; plantoes: Plantao[]; modelos: Modelo[]; perfilId: string; ehAdmin: boolean;
  nomePorId: Map<string, string>; localPorId: Map<string, string>;
  onLancar: (dia: string, modelo: Modelo) => void;
  onLancarAvulso: (dia: string) => void;
  onRemover: (id: string) => void;
  onFechar: () => void;
}) {
  const [d, mm, aa] = [dia.slice(8, 10), dia.slice(5, 7), dia.slice(0, 4)];
  return (
    <section className="clinicalPanel plantaoDetalhe">
      <div className="panelTitle">
        <strong>{d}/{mm}/{aa}</strong>
        <span>{plantoes.length ? `${plural(plantoes.length, "plantão", "plantões")} na escala` : "nenhum plantão neste dia"}</span>
        <button className="outlineClinical" onClick={onFechar} style={{ marginLeft: "auto" }}>Fechar</button>
      </div>

      {plantoes.map((p) => (
        <div className="plantaoLinha" key={p.id}>
          <span className="plantaoQuando">
            <strong>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)}</strong>
            <small>{p.horas}h</small>
          </span>
          <span className="plantaoOnde">
            <strong>{nomePorId.get(p.perfil_id) ?? "Profissional"}</strong>
            <small>{p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local"}</small>
          </span>
          {/* O administrador tira da escala o plantão de qualquer um: quem monta
              a escala corrige a escala. O colega comum só mexe no que é dele. */}
          {p.perfil_id === perfilId || ehAdmin
            ? <button className="outlineClinical red" onClick={() => onRemover(p.id)}>Remover</button>
            : <span className="statusChip paused">de colega</span>}
        </div>
      ))}

      <div className="plantaoLancar">
        <span>Lançar a partir de um modelo:</span>
        {modelos.length === 0
          ? <button className="primaryClinical compact" onClick={() => onLancarAvulso(dia)}>
              + Lançar plantão neste dia
            </button>
          : modelos.map((mo) => (
            <button key={mo.id} className={`plantaoModeloChip cor-${mo.cor}`} onClick={() => onLancar(dia, mo)}>
              <b>{mo.nome}</b>
              <small>{hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)} · {money(Number(mo.valor))}</small>
            </button>
          ))}
        {modelos.length > 0 && (
          <button className="outlineClinical" onClick={() => onLancarAvulso(dia)}>
            Outro horário…
          </button>
        )}
      </div>
    </section>
  );
}

function ModelosPainel({
  modelos, locais, perfilId, institutionId, ehAdmin, onMudou,
}: {
  modelos: Modelo[]; locais: LocalDisponivel[]; perfilId: string;
  institutionId: string; ehAdmin: boolean; onMudou: () => void;
}) {
  const vazio = {
    nome: "", local_id: "", hora_inicio: "07:00", hora_fim: "19:00",
    valor: "", cor: "azul", compartilhado: ehAdmin,
  };
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) { setErro("Dê um nome ao modelo."); return; }
    setSalvando(true); setErro("");
    const supabase = createClient();
    const { error } = await supabase.from("modelos_plantao").insert({
      institution_id: institutionId,
      owner_id: form.compartilhado && ehAdmin ? null : perfilId,
      nome: form.nome.trim(), local_id: form.local_id || null,
      hora_inicio: form.hora_inicio, hora_fim: form.hora_fim,
      valor: Number(form.valor.replace(/\./g, "").replace(",", ".")) || 0,
      cor: form.cor, created_by: perfilId,
    });
    setSalvando(false);
    if (error) { setErro("Não foi possível salvar o modelo."); return; }
    setForm(vazio); onMudou();
  }

  async function apagar(id: string) {
    if (!confirm("Apagar este modelo? Os plantões já lançados continuam.")) return;
    await createClient().from("modelos_plantao").update({ ativo: false }).eq("id", id);
    onMudou();
  }

  return (
    <section className="clinicalPanel">
      <div className="panelTitle">
        <strong>Modelos de plantão</strong>
        <span>o turno que se repete, salvo uma vez: lançar o mês vira um toque por dia</span>
      </div>

      {erro && <p className="clinicalError">{erro}</p>}

      <form className="plantaoModeloForm" onSubmit={salvar}>
        <label className="clinicalField wide"><span>Nome *</span>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: Mamborê diurno" /></label>
        <label className="clinicalField"><span>Local</span>
          <select value={form.local_id} onChange={(e) => setForm({ ...form, local_id: e.target.value })}>
            <option value="">Sem local</option>
            {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
          </select>
          {/* Lista de locais vazia é um beco: a pessoa abre o campo, não acha
              nada e não tem como adivinhar que o cadastro fica em outra tela. */}
          {locais.length === 0 && (
            <small className="campoDica">
              Nenhum local cadastrado ainda. Eles são criados em Admin → Locais de atendimento.
            </small>
          )}</label>
        <label className="clinicalField"><span>Início</span>
          <input type="time" value={form.hora_inicio}
            onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></label>
        <label className="clinicalField"><span>Fim</span>
          <input type="time" value={form.hora_fim}
            onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} /></label>
        <label className="clinicalField"><span>Valor</span>
          <input value={form.valor} inputMode="decimal" placeholder="1.100,00"
            onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>

        <div className="plantaoDuracoes">
          <span>Duração rápida:</span>
          {DURACOES.map((h) => (
            <button type="button" key={h} className="outlineClinical"
              onClick={() => setForm({ ...form, hora_fim: somarHoras(form.hora_inicio, h) })}>
              {h}h
            </button>
          ))}
        </div>

        {ehAdmin && (
          <label className="localCompartilhar">
            <input type="checkbox" checked={form.compartilhado}
              onChange={(e) => setForm({ ...form, compartilhado: e.target.checked })} />
            <span><strong>Modelo da equipe</strong>
              <small>Todos poderão usar. Desmarque para deixá-lo só seu.</small></span>
          </label>
        )}

        <button className="primaryClinical compact" disabled={salvando}>
          {salvando ? "Salvando…" : "+ Criar modelo"}
        </button>
      </form>

      {modelos.length === 0
        ? <div className="emptyClinical compactEmpty">Nenhum modelo ainda.</div>
        : modelos.map((mo) => (
          <div className="plantaoLinha" key={mo.id}>
            <span className={`plantaoCor cor-${mo.cor}`} aria-hidden="true" />
            <span className="plantaoOnde">
              <strong>{mo.nome}</strong>
              <small>{hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)}
                {mo.local_id ? ` · ${nomeDoLocal(locais.find((l) => l.id === mo.local_id) ?? { nome: "—" })}` : ""}</small>
            </span>
            <b>{money(Number(mo.valor))}</b>
            {mo.owner_id === null && <span className="statusChip present">da equipe</span>}
            <button className="outlineClinical red" onClick={() => void apagar(mo.id)}>Apagar</button>
          </div>
        ))}
    </section>
  );
}

/**
 * Lançar um plantão sem depender de modelo.
 *
 * O modelo economiza toques em quem já tem rotina; quem está começando não tem
 * nenhum, e sem esta tela o caminho era: adivinhar que existe uma aba Modelos,
 * criar um lá, voltar, clicar no dia. Quatro passos para registrar um turno.
 *
 * Escolher um modelo aqui preenche o resto — continua sendo atalho, e agora
 * também sem ser obrigação.
 */
function LancarPlantao({
  dia, locais, modelos, colegas, perfilId, ehAdmin, onFechar, onSalvar,
}: {
  dia: string;
  locais: LocalDisponivel[];
  modelos: Modelo[];
  colegas: Colega[];
  perfilId: string;
  ehAdmin: boolean;
  onFechar: () => void;
  onSalvar: (d: { data: string; local_id: string; hora_inicio: string; hora_fim: string; valor: number; perfil_id: string }) => void;
}) {
  const [form, setForm] = useState({
    data: dia, local_id: locais[0]?.id ?? "", hora_inicio: "07:00", hora_fim: "19:00",
    valor: "", perfil_id: perfilId,
  });
  const paraOutro = ehAdmin && form.perfil_id !== perfilId;

  function aplicarModelo(id: string) {
    const mo = modelos.find((x) => x.id === id);
    if (!mo) return;
    setForm({
      ...form, local_id: mo.local_id ?? form.local_id,
      hora_inicio: hhmm(mo.hora_inicio), hora_fim: hhmm(mo.hora_fim),
      valor: String(Number(mo.valor) || ""),
    });
  }

  return (
    <div className="patientModalBackdrop" role="presentation">
      <section className="localModal" role="dialog" aria-modal="true" aria-labelledby="lancar-plantao">
        <div className="patientModalHead">
          <div><h2 id="lancar-plantao">Lançar plantão</h2>
            <p>O valor pode ser ajustado depois, direto na lista.</p></div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSalvar({ ...form, valor: Number(form.valor.replace(/\./g, "").replace(",", ".")) || 0 });
        }}>
          {/* Grade única para tudo, inclusive a duração rápida. Antes ela ficava
              fora da grade com grid-column:1/-1 — regra que só vale DENTRO de
              um grid —, e como bloco solto encavalava nos campos de horário. */}
          <div className="plantaoLancarGrade">
            {modelos.length > 0 && (
              <label className="clinicalField span4">
                <span>Usar um modelo (opcional)</span>
                <select defaultValue="" onChange={(e) => aplicarModelo(e.target.value)}>
                  <option value="">Preencher à mão</option>
                  {modelos.map((mo) => (
                    <option key={mo.id} value={mo.id}>
                      {mo.nome} · {hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* A pergunta que aparece aqui é "onde eu cadastro os médicos?".
                A resposta é que eles não se cadastram na escala: quem entrou na
                organização já é escalável. Sem esta linha, um administrador
                sozinho vê um campo com um nome só e conclui que a tela está
                quebrada. */}
            {ehAdmin && colegas.length <= 1 && (
              <p className="plantaoNota">
                Você é a única pessoa na organização, então só dá para escalar
                a si mesmo. Quem você convidar em <strong>Admin → Convidar</strong> passa
                a aparecer aqui automaticamente.
              </p>
            )}

            {/* Quem monta a escala do serviço escala os outros. Sem este campo,
                "Escala do grupo" era um diário compartilhado: mostrava o que
                cada um lançou para si, e não a escala que alguém montou. */}
            {ehAdmin && colegas.length > 1 && (
              <label className="clinicalField span4">
                <span>Para quem</span>
                <select value={form.perfil_id}
                  onChange={(e) => setForm({ ...form, perfil_id: e.target.value })}>
                  <option value={perfilId}>Para mim</option>
                  {colegas.filter((c) => c.id !== perfilId).map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="clinicalField span2"><span>Data</span>
              <input type="date" value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })} /></label>
            <label className="clinicalField span2"><span>Local</span>
              <select value={form.local_id} onChange={(e) => setForm({ ...form, local_id: e.target.value })}>
                <option value="">Sem local</option>
                {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
              </select></label>
            <label className="clinicalField"><span>Início</span>
              <input type="time" value={form.hora_inicio}
                onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} /></label>
            <label className="clinicalField"><span>Fim</span>
              <input type="time" value={form.hora_fim}
                onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} /></label>
            {/* O valor sai da tela quando o plantão é de outra pessoa: quanto
                ela recebe é combinado dela com quem paga, e ela ajusta na
                própria lista. */}
            {!paraOutro && (
              <label className="clinicalField span2"><span>Valor</span>
                <input value={form.valor} inputMode="decimal" placeholder="1.100,00"
                  onChange={(e) => setForm({ ...form, valor: e.target.value })} /></label>
            )}

            <div className="plantaoDuracoes">
              <span>Duração rápida:</span>
              {DURACOES.map((h) => (
                <button type="button" key={h} className="outlineClinical"
                  onClick={() => setForm({ ...form, hora_fim: somarHoras(form.hora_inicio, h) })}>{h}h</button>
              ))}
            </div>
          </div>

          {paraOutro && (
            <p className="plantaoNota">
              O plantão entra na escala de {colegas.find((c) => c.id === form.perfil_id)?.nome ?? "quem você escolheu"}.
              Ele ajusta o valor e pode pedir troca por lá.
            </p>
          )}

          <div className="modalActions">
            <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="primaryClinical compact">Lançar</button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * Pedir troca: para o grupo todo ou para uma pessoa.
 *
 * A diferença não é cosmética. Oferta ao grupo é "alguém cobre?", e o primeiro
 * que aceitar leva. Convite dirigido é "você cobre?", e ninguém além dele pode
 * assumir — é o que faz sentido quando já houve uma combinação por fora e só
 * falta registrar.
 */
function PedirTroca({
  plantao, colegas, localPorId, onFechar, onEnviar,
}: {
  plantao: Plantao;
  colegas: Colega[];
  localPorId: Map<string, string>;
  onFechar: () => void;
  onEnviar: (destinatarioId: string, mensagem: string) => void;
}) {
  const [destino, setDestino] = useState("");
  const [mensagem, setMensagem] = useState("");

  return (
    <div className="patientModalBackdrop" role="presentation">
      <section className="localModal" role="dialog" aria-modal="true" aria-labelledby="pedir-troca">
        <div className="patientModalHead">
          <div>
            <h2 id="pedir-troca">Solicitar troca</h2>
            <p>
              {Number(plantao.data.slice(8, 10))}/{plantao.data.slice(5, 7)} ·{" "}
              {hhmm(plantao.hora_inicio)}–{hhmm(plantao.hora_fim)} ·{" "}
              {plantao.local_id ? localPorId.get(plantao.local_id) ?? "sem local" : "sem local"}
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onEnviar(destino, mensagem); }}>
          <fieldset className="plantaoDestino">
            <legend>Para quem?</legend>
            <label className={destino === "" ? "ativo" : ""}>
              <input type="radio" name="destino" checked={destino === ""} onChange={() => setDestino("")} />
              <span>
                <strong>Todo o grupo</strong>
                <small>Qualquer colega pode assumir. O primeiro que aceitar leva.</small>
              </span>
            </label>
            <label className={destino !== "" ? "ativo" : ""}>
              <input type="radio" name="destino" checked={destino !== ""}
                onChange={() => setDestino(colegas[0]?.id ?? "")} />
              <span>
                <strong>Uma pessoa</strong>
                <small>Só ela vê o convite e só ela pode aceitar.</small>
              </span>
            </label>
          </fieldset>

          {destino !== "" && (
            <label className="clinicalField">
              <span>Colega</span>
              <select value={destino} onChange={(e) => setDestino(e.target.value)}>
                {colegas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
          )}

          <label className="clinicalField wide" style={{ marginTop: 14 }}>
            <span>Mensagem (opcional)</span>
            <textarea className="localObs" rows={2} value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Ex.: consigo cobrir o seu do dia 30 em troca" />
          </label>

          <div className="modalActions">
            <button type="button" className="outlineClinical" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="primaryClinical compact"
              disabled={destino !== "" && colegas.length === 0}>
              Enviar pedido
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * As trocas em aberto, dos dois lados.
 *
 * Separadas como o médico pensa nelas: "o que me pediram" e "o que eu pedi".
 * Juntar as duas numa lista só obrigaria a ler cada linha para descobrir de
 * que lado dela a pessoa está.
 */
function TrocasPainel({
  trocas, plantoes, perfilId, nomePorId, localPorId, onResponder,
}: {
  trocas: Troca[];
  plantoes: Plantao[];
  perfilId: string;
  nomePorId: Map<string, string>;
  localPorId: Map<string, string>;
  onResponder: (id: string, acao: "aceitar_troca" | "recusar_troca" | "cancelar_troca") => void;
}) {
  const plantaoPorId = new Map(plantoes.map((p) => [p.id, p]));
  // Recebidos: o que foi dirigido a mim, mais o que foi aberto ao grupo por
  // outra pessoa. Os meus próprios pedidos nunca entram aqui.
  const recebidos = trocas.filter((t) => t.solicitante_id !== perfilId
    && (t.destinatario_id === null || t.destinatario_id === perfilId));
  const enviados = trocas.filter((t) => t.solicitante_id === perfilId);

  function Linha({ troca, lado }: { troca: Troca; lado: "recebido" | "enviado" }) {
    const p = plantaoPorId.get(troca.plantao_id);
    if (!p) return null;
    const dirigido = troca.destinatario_id !== null;
    return (
      <div className="plantaoLinha">
        <span className="plantaoQuando">
          <strong>{Number(p.data.slice(8, 10))}/{p.data.slice(5, 7)}</strong>
          <small>{hhmm(p.hora_inicio)}–{hhmm(p.hora_fim)} · {p.horas}h</small>
        </span>
        <span className="plantaoOnde">
          <strong>
            {lado === "recebido"
              ? nomePorId.get(troca.solicitante_id) ?? "Colega"
              : dirigido ? `para ${nomePorId.get(troca.destinatario_id!) ?? "colega"}` : "aberto ao grupo"}
          </strong>
          <small>{p.local_id ? localPorId.get(p.local_id) ?? "—" : "Sem local"}</small>
          {troca.mensagem && <small className="plantaoMensagem">“{troca.mensagem}”</small>}
        </span>
        <span className={`statusChip ${dirigido ? "waiting" : "paused"}`}>
          {dirigido ? "convite" : "aberto ao grupo"}
        </span>
        {lado === "recebido" ? (
          <>
            <button className="primaryClinical compact" onClick={() => onResponder(troca.id, "aceitar_troca")}>
              Assumir
            </button>
            {/* Recusar só existe no convite dirigido: numa oferta aberta, quem
                não quer apenas não assume — e "recusar" apagaria a oferta para
                todos os outros colegas. */}
            {dirigido && (
              <button className="outlineClinical" onClick={() => onResponder(troca.id, "recusar_troca")}>
                Recusar
              </button>
            )}
          </>
        ) : (
          <button className="outlineClinical red" onClick={() => onResponder(troca.id, "cancelar_troca")}>
            Cancelar pedido
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Pedidos recebidos</strong>
          <span>convites para você e plantões oferecidos ao grupo</span>
        </div>
        {recebidos.length === 0
          ? <div className="emptyClinical compactEmpty">Nenhum pedido no momento.</div>
          : recebidos.map((t) => <Linha key={t.id} troca={t} lado="recebido" />)}
      </section>

      <section className="clinicalPanel">
        <div className="panelTitle">
          <strong>Trocas que você pediu</strong>
          <span>aguardando alguém assumir</span>
        </div>
        {enviados.length === 0
          ? <div className="emptyClinical compactEmpty">Você não tem pedidos em aberto. Use “Solicitar troca” na Escala.</div>
          : enviados.map((t) => <Linha key={t.id} troca={t} lado="enviado" />)}
      </section>
    </>
  );
}
