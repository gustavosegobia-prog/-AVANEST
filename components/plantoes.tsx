"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { nomeDoLocal, type LocalDisponivel } from "@/lib/local-ativo";
import { ProducaoDoDia, ProducaoDoMes, type Producao } from "@/components/producao-do-dia";
import { OlhoValores, useValoresOcultos } from "@/components/olho-valores";
import {
  corpoDaFolha, escaparHTML, faixa, folhaDeProducao, hhmm, iniciais, money,
  apelidosDaEquipe, filtroDeHospital, montarICS, nomeCurto, nomeDoPeriodo,
  ondeFica, plantaoNaEscala, plural, somarHoras, TURNOS_DO_DIA, turnosCobertos,
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
  // Plantão de fora: sedação em consultório, hospital que não é do grupo. Só
  // quem lançou enxerga — o RLS não devolve os dos outros nem para o chefe —,
  // e por isso o lugar vem escrito à mão, sem passar pelo cadastro de locais.
  privado: boolean; local_texto: string | null;
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
function imprimirFolha(titulo: string, corpo: string,
                       orientacao: "landscape" | "portrait" = "landscape"): boolean {
  const janela = window.open("", "_blank", "width=1100,height=800");
  if (!janela) return false;
  janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${escaparHTML(titulo)}</title><style>
@page{size:A4 ${orientacao};margin:9mm}
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
h2{font-size:13px;margin:16px 0 5px;padding-bottom:3px;border-bottom:1.5px solid #333;
   break-after:avoid;page-break-after:avoid}
h2 small{font-weight:400;color:#555;font-size:11px;margin-left:7px}
.num{text-align:right}
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
  perfilId, institutionId, locais, ehAdmin, colegas, escalaveis, semCRM = [],
  localAtivoId = null,
}: {
  perfilId: string;
  institutionId: string;
  locais: LocalDisponivel[];
  ehAdmin: boolean;
  /**
   * Todo mundo da organização, para RESOLVER NOME.
   *
   * Inclui inativo e quem não tem CRM de propósito: um plantão lançado no mês
   * passado por alguém que hoje saiu do grupo precisa continuar mostrando o
   * nome de quem estava escalado. Sem isso a escala de março vira uma fileira
   * de "Profissional".
   */
  colegas: Colega[];
  /**
   * Quem pode ENTRAR na escala: médico ativo com CRM.
   *
   * Quem anestesia responde pelo ato com o registro dele, e a escala é o
   * documento de quem responde. Recepção e financeiro usam o sistema e não
   * entram aqui.
   */
  escalaveis: Colega[];
  /** Ativos sem CRM no cadastro. Não some da tela: vira aviso. */
  semCRM?: string[];
  localAtivoId?: string | null;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`);
  const [aba, setAba] = useState<"escala" | "producao" | "modelos" | "trocas">("escala");
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
  /**
   * Qual hospital a escala do grupo está mostrando.
   *
   * Só vale para a escala do grupo, e é aí que está a diferença entre as
   * duas. Um grupo de anestesia cobre várias instituições ao mesmo tempo, e
   * misturá-las num calendário só não é uma lista mais completa: é uma lista
   * ilegível. Duas linhas "07-19h" no mesmo dia, uma da Santa Casa e outra do
   * Hospital da Unimed, não se distinguem — e é a escala de dois serviços
   * diferentes, com equipes diferentes.
   *
   * Na escala pessoal acontece o oposto: misturar é a graça. O médico quer
   * ver o mês inteiro dele num lugar só, não importa em quantos hospitais
   * esteja espalhado.
   *
   * Começa no local onde a pessoa está atendendo hoje, que ela já respondeu
   * ao entrar no sistema. Sem essa resposta, no primeiro hospital do cadastro
   * — e não em "todos": a visão de conjunto saiu da coluna porque não é a
   * escala de lugar nenhum, e abrir nela deixaria a tela mostrando justamente
   * o que se decidiu não mostrar.
   */
  const [hospital, setHospital] = useState<string>(
    localAtivoId ?? locais.find((l) => l.ativo)?.id ?? "todos",
  );
  const { oculto: valorOculto, alternar: esconderValores, mascara } = useValoresOcultos();
  const [pedindoTroca, setPedindoTroca] = useState<Plantao | null>(null);
  // Lançar sem modelo. O modelo é atalho, não pré-requisito: exigir que a
  // pessoa crie um modelo antes de registrar o primeiro plantão é uma parede
  // logo na entrada, e foi exatamente onde a tela travou no primeiro uso.
  // O dia e para quem. A pessoa vem junto porque o formulário manual pode ser
  // aberto de dentro do atalho rápido — escolheu o colega, quer outro horário —
  // e reabrir com "Para mim" apagaria a escolha que a pessoa acabou de fazer.
  const [lancando, setLancando] = useState<{ dia: string; para: string } | null>(null);

  const nomePorId = useMemo(() => new Map(colegas.map((c) => [c.id, c.nome])), [colegas]);
  const localPorId = useMemo(() => new Map(locais.map((l) => [l.id, nomeDoLocal(l)])), [locais]);
  // O calendário precisa dizer QUAL plantão é, não só que existe um. Cor e
  // nome vêm do modelo; sem modelo, o rótulo cai no horário, que ainda
  // distingue diurno de noturno.
  const modeloPorId = useMemo(() => new Map(modelos.map((mo) => [mo.id, mo])), [modelos]);
  // Convênios que a organização já usa, para o campo do caderninho sugerir
  // "Unimed" em vez de exigir que se digite de novo a cada paciente.
  const [conveniosConhecidos, setConvenios] = useState<string[]>([]);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data } = await createClient()
        .from("convenio_valores").select("convenio").eq("ativo", true);
      if (!vivo) return;
      const nomes = [...new Set((data ?? []).map((r) => String(r.convenio).trim()).filter(Boolean))];
      setConvenios(["Particular", ...nomes.filter((n) => n.toLowerCase() !== "particular")].sort());
    })();
    return () => { vivo = false; };
  }, []);

  const corPorMedico = useMemo(() => {
    const m = new Map<string, string>();
    colegas.forEach((c, i) => m.set(c.id, CORES_MEDICO[i % CORES_MEDICO.length]));
    return m;
  }, [colegas]);

  // O nome curto de cada colega para os botões de escalar rápido.
  const apelidos = useMemo(() => apelidosDaEquipe(colegas), [colegas]);

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

  /**
   * Lançar a partir de um modelo, para mim ou para um colega.
   *
   * `para` é o atalho de escalar rápido: escolhe-se a pessoa, clica-se no
   * modelo, e o turno entra na escala dela. A trava de administrador é a mesma
   * do lançamento manual — o RLS recusaria de qualquer forma, e conferir aqui
   * evita a tentativa virar um erro seco na tela.
   */
  async function lancar(dia: string, modelo: Modelo, para?: string) {
    setErro(""); setAviso("");
    const dono = ehAdmin && para ? para : perfilId;
    const supabase = createClient();
    const { error } = await supabase.from("plantoes").insert({
      institution_id: institutionId, perfil_id: dono,
      local_id: modelo.local_id, modelo_id: modelo.id,
      data: dia, hora_inicio: modelo.hora_inicio, hora_fim: modelo.hora_fim,
      // Mesma regra do lançamento manual: quanto o colega recebe é combinado
      // dele com quem paga, e ele ajusta na própria lista. O valor do modelo é
      // o seu, não o dele.
      valor: dono === perfilId ? modelo.valor : 0, created_by: perfilId,
    });
    if (error) {
      setErro(error.code === "23505"
        ? dono === perfilId
          ? "Você já tem um plantão nesse dia e horário."
          : `${nomePorId.get(dono) ?? "Esse profissional"} já tem um plantão nesse dia e horário.`
        : "Não foi possível lançar o plantão.");
      return;
    }
    // O painel do dia fica ABERTO quando se escala outra pessoa: montar a
    // escala é escalar seis nomes seguidos no mesmo dia, e fechar a cada
    // clique obrigaria a reabrir o dia toda vez. Para si mesmo fecha, que é o
    // gesto único de quem só lança o próprio plantão.
    if (dono === perfilId) setDiaAberto(null);
    else setAviso(`Plantão de ${nomeCurto(nomePorId.get(dono) ?? "")} lançado em ${dia.slice(8, 10)}/${dia.slice(5, 7)}.`);
    void carregar();
  }

  async function lancarAvulso(dados: {
    data: string; local_id: string; local_texto: string;
    hora_inicio: string; hora_fim: string;
    valor: number; perfil_id: string; privado: boolean;
  }) {
    setErro(""); setAviso("");
    // Quem monta a escala do serviço lança para os outros; quem não é
    // administrador só lança para si — o RLS recusaria de qualquer forma, e
    // forçar aqui evita a tentativa virar um erro seco na tela.
    //
    // Plantão privado é sempre para si, mesmo sendo administrador: um turno
    // que só a outra pessoa enxerga, lançado por você, é agenda dela — e o
    // banco recusa.
    const dono = ehAdmin && dados.perfil_id && !dados.privado ? dados.perfil_id : perfilId;
    const { error } = await createClient().from("plantoes").insert({
      institution_id: institutionId, perfil_id: dono,
      // Um ou outro, nunca os dois: é o que a constraint do banco exige, e o
      // que impede a mesma linha de ter dois lugares diferentes.
      local_id: dados.privado ? null : (dados.local_id || null),
      local_texto: dados.privado ? (dados.local_texto.trim() || null) : null,
      privado: dados.privado,
      data: dados.data,
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
    if (dados.privado) {
      setAviso("Plantão lançado só na sua escala. Ninguém do grupo enxerga este turno.");
    } else if (dono !== perfilId) {
      setAviso(`Plantão lançado para ${nomePorId.get(dono) ?? "o profissional"}. Ele aparece na escala dele, que pode ajustar o valor e pedir troca.`);
    }
    void carregar();
  }

  async function atualizar(id: string, campos: Partial<Plantao>) {
    setErro("");
    const supabase = createClient();
    const { error } = await supabase.from("plantoes")
      .update({ ...campos, updated_at: new Date().toISOString() }).eq("id", id);
    // A mensagem do banco vem inteira. As recusas daqui são regras de escala —
    // "este plantão é do grupo, passe para um colega" —, e traduzir isso para
    // "não foi possível salvar" esconde justamente a parte que diz o que fazer.
    if (error) { setErro(error.message || "Não foi possível salvar a alteração."); return; }
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

  /**
   * Apagar. Só o que é privado, ou por quem monta a escala.
   *
   * Plantão da escala do grupo não se apaga: sai passando para um colega que
   * aceite. O banco recusa com essa frase, e a tela repete o que ele disse em
   * vez de traduzir por conta própria — mensagem inventada aqui envelhece
   * separada da regra que a produziu.
   */
  async function remover(id: string) {
    const alvo = plantoes.find((p) => p.id === id);
    const pergunta = alvo?.privado
      ? "Apagar este plantão? Ele é só seu, ninguém do grupo o enxerga."
      : "Remover este plantão da escala?";
    if (!confirm(pergunta)) return;
    setErro(""); setAviso("");
    // O .select() no fim não é enfeite: a política de apagar do banco esconde
    // a linha em vez de recusar, e sem ele um DELETE barrado volta como
    // sucesso com zero linhas — a tela diria "removido" e o plantão
    // continuaria na escala. Com ele, zero linhas é resposta e vira aviso.
    const { data, error } = await createClient()
      .from("plantoes").delete().eq("id", id).select("id");
    if (error) { setErro(error.message || "Não foi possível remover o plantão."); return; }
    if (!data || data.length === 0) {
      setErro("Este plantão está na escala do grupo e não pode ser apagado."
        + " Use \"Passar plantão\" e escolha um colega — ele sai da sua escala quando o colega aceitar.");
      return;
    }
    void carregar();
  }

  /**
   * A seção aberta, como a coluna a enxerga.
   *
   * Aba e escopo continuam sendo dois estados porque significam coisas
   * diferentes — que painel mostrar e de quem é a escala —, mas a coluna
   * apresenta um item por seção. Aqui os dois viram um nome só, e irPara faz
   * o caminho de volta: sem isso, "Minha escala" e "Escala do grupo"
   * apareceriam ambas acesas, já que as duas são a aba "escala".
   */

  // O contador da coluna conta o que espera resposta SUA: convite dirigido a
  // você, mais oferta aberta de outra pessoa. Contar os seus próprios pedidos
  // faria o número pedir uma ação que não é sua.
  const trocasParaMim = trocas.filter((t) => t.solicitante_id !== perfilId
    && (t.destinatario_id === null || t.destinatario_id === perfilId)).length;

  const hojeISO = new Date().toISOString().slice(0, 10);
  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  const primeiroDiaSemana = new Date(ano, m - 1, 1).getDay();

  // O que a tela está mostrando, uma vez só. O calendário, a lista, a folha
  // impressa e o arquivo de agenda leem daqui — se cada um refizesse o filtro,
  // bastaria um deles esquecer o "situacao !== cancelado" para a escala
  // impressa sair diferente da que está na tela.
  // A coluna lista os hospitais do CADASTRO, e não só os que já têm plantão.
  // Escala de hospital vazio não é um beco: é exatamente onde o administrador
  // vai para montá-la, e o botão de lançar está ali.
  const locaisAtivos = useMemo(() => locais.filter((l) => l.ativo), [locais]);

  // Id que não corresponde a hospital nenhum cai em "todos": é o que impede um
  // local arquivado, ou um cadastro que mudou, de esvaziar a tela em silêncio.
  const hospitalAtivo = filtroDeHospital(hospital, locaisAtivos.map((l) => l.id));

  // O nome do hospital só cabe na célula quando ela mistura hospitais. Aberta
  // num deles, seria a mesma palavra repetida em trinta e um quadrados.
  const mostraLocalNaCelula = hospitalAtivo === "todos" || hospitalAtivo === "sem";

  const daEscala = useMemo(
    () => plantoes.filter((p) => p.situacao !== "cancelado"
      && (escopo === "grupo" || p.perfil_id === perfilId)
      // O plantão privado nunca entra na escala do grupo, nem na sua. O banco
      // já não devolve os dos outros; o seu volta, e sem esta linha ele cairia
      // em "Sem hospital" — dentro da escala do grupo, que é o único lugar
      // onde ele não deve estar.
      && (escopo !== "grupo" || !p.privado)
      // A escala pessoal mistura os hospitais de propósito; a do grupo é uma
      // por hospital, pelo motivo explicado em `hospital`.
      && (escopo !== "grupo" || plantaoNaEscala(p.local_id, hospitalAtivo))),
    [plantoes, escopo, perfilId, hospitalAtivo],
  );

  const secaoAtiva = aba === "escala"
    ? (escopo === "minha" ? "minha" : `grupo:${hospitalAtivo}`)
    : aba;

  function irPara(secao: string) {
    if (secao === "minha") { setAba("escala"); setEscopo("minha"); return; }
    if (secao.startsWith("grupo:")) {
      setAba("escala"); setEscopo("grupo"); setHospital(secao.slice(6));
      return;
    }
    setAba(secao as "producao" | "modelos" | "trocas");
  }

  /**
   * Os cartões de resumo são de Minha escala, e de mais lugar nenhum.
   *
   * Todos eles contam a mesma coisa: os SEUS plantões, as SUAS horas, o SEU
   * dinheiro. Ao lado da escala do grupo, que mostra o turno da equipe, eles
   * respondem uma pergunta que ninguém fez ali — e pior, parecem falar do que
   * está na tela. Em Trocas e Modelos é a mesma história: são listas, não
   * painéis.
   */
  const mostraMetricas = aba === "escala" && escopo === "minha";

  /** O que esta escala mostra, em uma frase. */
  const notaDaEscala = escopo === "minha"
    ? "Todos os seus turnos, de todos os hospitais, num lugar só — inclusive os plantões só seus."
    : hospitalAtivo === "todos"
      // Sem item na coluna: só se chega aqui por hospital arquivado ou
      // organização sem local cadastrado. A frase diz o caminho de volta.
      ? "Nenhum hospital aberto — a escala está mostrando todos juntos. Escolha um hospital na coluna ao lado."
      : hospitalAtivo === "sem"
        ? "Plantões lançados sem hospital. Abra o dia e relance com o local para eles entrarem na escala certa."
        : `Escala da equipe em ${locaisAtivos.find((l) => l.id === hospitalAtivo)
            ? nomeDoLocal(locaisAtivos.find((l) => l.id === hospitalAtivo)!) : "—"}. `
          + "Você edita apenas os seus turnos.";

  /**
   * Os turnos de um dia, agrupados por hospital E horário.
   *
   * O hospital entra na chave, e não é detalhe: sem ele, o plantão das 07h da
   * Santa Casa e o das 07h do Hospital da Unimed caíam na mesma linha, com as
   * iniciais das duas equipes juntas. A tela mostrava uma escala que não
   * existe em lugar nenhum.
   */
  const turnosDoDia = useCallback((dia: string) => {
    const doDia = daEscala.filter((p) => p.data === dia);
    return Object.values(doDia.reduce<Record<string, {
      chave: string; localId: string | null; inicio: string; fim: string;
      horas: number; gente: Plantao[];
    }>>((acc, p) => {
      const chave = `${p.local_id ?? "-"}|${p.hora_inicio}|${p.hora_fim}`;
      acc[chave] ??= {
        chave, localId: p.local_id, inicio: p.hora_inicio, fim: p.hora_fim,
        horas: Number(p.horas), gente: [],
      };
      acc[chave].gente.push(p);
      return acc;
    }, {})).sort((a, b) => a.inicio.localeCompare(b.inicio)
      || String(a.localId).localeCompare(String(b.localId)));
  }, [daEscala]);

  /**
   * O dia dividido em manhã, tarde e noite.
   *
   * O turno continua sendo lançado com a hora que a pessoa quiser: um fica até
   * as 13h, outro faz o dia inteiro, outro entra às 19h. A faixa não é uma
   * gaveta em que o plantão precisa caber — ela é LIDA do horário. Por isso o
   * de 07-19h aparece na manhã e na tarde: às 15h ele está lá, e uma tarde em
   * branco numa tela feita para achar buraco de cobertura faria alguém escalar
   * gente em cima de um plantão que já existe.
   *
   * As três faixas aparecem sempre que o dia tem alguém, inclusive as vazias.
   * O vazio é a informação: "sábado à noite não tem ninguém" é a pergunta que
   * traz o coordenador a esta tela.
   */
  const faixasDoDia = useCallback((dia: string) => {
    const turnos = turnosDoDia(dia);
    if (turnos.length === 0) return [];
    return TURNOS_DO_DIA.map((faixaDoDia) => {
      const blocos = turnos.filter((t) => turnosCobertos(t.inicio, t.fim).includes(faixaDoDia.id));
      // Vendo hospitais diferentes de uma vez, duas equipes na mesma faixa
      // viram uma fileira só de iniciais — e uma escala que não existe em
      // lugar nenhum. O nome separa as equipes; num hospital só ele seria a
      // mesma palavra repetida trinta vezes na tela.
      const locais = new Set(blocos.map((b) => b.localId ?? "-"));
      return { ...faixaDoDia, blocos, separarPorLocal: mostraLocalNaCelula && locais.size > 1 };
    });
  }, [turnosDoDia, mostraLocalNaCelula]);

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
          : `Plantão${ondeFica(p, localPorId, "") ? ` · ${ondeFica(p, localPorId, "")}` : ""}`,
        onde: ondeFica(p, localPorId, ""),
      }))),
      "text/calendar;charset=utf-8",
    );
    setAviso("Arquivo baixado. No iPhone, toque nele e escolha Adicionar. No Google Agenda: Configurações → Importar e exportar → Importar.");
  }

  /**
   * A produção do mês em papel, para mandar para o faturamento.
   *
   * Folha retrato, e não paisagem como a escala: é uma lista de nomes, e
   * lista de nome pede coluna estreita e folha em pé.
   */
  function imprimirProducao(itens: Producao[]) {
    setErro(""); setAviso("");
    const { titulo, corpo } = folhaDeProducao(
      itens.map((i) => ({
        data: i.data, paciente: i.paciente, convenio: i.convenio,
        procedimento: i.procedimento, valor: Number(i.valor), situacao: i.situacao,
      })),
      MESES[m - 1], ano, new Date(),
    );
    if (!imprimirFolha(titulo, corpo, "portrait")) {
      setErro("O navegador bloqueou a janela de impressão. Libere as janelas pop-up para este site e tente de novo.");
    }
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
        local: ondeFica(p, localPorId, ""),
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

      {/* O olho esconde TUDO, e não só o dinheiro: quantos plantões alguém faz
          no mês é informação de quem faz, e a escala é aberta no corredor do
          centro cirúrgico com gente ao lado. O rótulo do cartão fica — cartão
          em branco não diz o que está escondido, e a pessoa mostra tudo de
          novo só para lembrar o que era. */}
      {mostraMetricas && (() => {
        // Os cartões viram lista para o olho poder morar no ÚLTIMO deles,
        // qualquer que ele seja: na escala do grupo os três de dinheiro não
        // existem, e um botão preso ao "A receber" sumiria junto com eles.
        const cartoes = [
          { chave: "turnos", valor: String(resumo.turnos), rotulo: "Plantões no mês", cor: "" },
          { chave: "horas", valor: `${resumo.horas.toLocaleString("pt-BR")}h`, rotulo: "Horas", cor: "" },
          { chave: "total", valor: money(resumo.total), rotulo: "Total do mês", cor: "blue" },
          { chave: "pago", valor: money(resumo.pago), rotulo: "Recebido", cor: "green" },
          { chave: "aberto", valor: money(resumo.aberto), rotulo: "A receber", cor: "amber" },
        ];
        return (
        <section className="metricGrid plantaoMetrics">
          {cartoes.map((c, i) => (
            <div className="metricCard" key={c.chave}>
              {/* O rótulo fica; só o número some. Cartão em branco não diz o
                  que está escondido, e a pessoa acaba mostrando tudo de novo
                  só para lembrar o que era. */}
              <strong className={c.cor}>{mascara(c.valor)}</strong>
              <span>{c.rotulo}</span>
              {i === cartoes.length - 1 && (
                <OlhoValores oculto={valorOculto} onAlternar={esconderValores} />
              )}
            </div>
          ))}
        </section>
        );
      })()}

      {/* Uma coluna, como no Médico, no Financeiro e no Admin. Antes eram duas
          fileiras de pílulas empilhadas — seção em cima, escopo embaixo —, e
          além de ocuparem duas alturas antes do calendário davam à Escala uma
          navegação diferente da de todas as outras áreas do sistema. */}
      <div className="financeLayout">
        <nav className="financeTarefas" aria-label="Seções da Escala">
          {([
            ["grupo", "Escala"],
            ["minha", "Minha escala"],
            // Uma escala por hospital, cada uma na sua linha. O grupo não tem
            // uma escala: tem a da Santa Casa, a do Hospital da Unimed, a do
            // Instituto. Serviços diferentes, equipes diferentes — e cada uma
            // se lê inteira sem a outra atravessada no meio.
            ["grupo", "Escala do grupo"],
            ...locaisAtivos.map((l) => [`grupo:${l.id}`, nomeDoLocal(l)] as [string, string]),
            // A coluna lista hospitais, e só. Saíram daqui "Todos os
            // hospitais" — a pergunta dele, "onde eu estou este mês?", Minha
            // escala responde melhor, já juntando tudo — e "Sem hospital",
            // que era uma gaveta de conserto ocupando lugar de escala.
            //
            // Plantão sem lugar continua existindo e continua visível em Minha
            // escala, que não filtra por hospital. O que ele não tem mais é
            // linha própria na escala do grupo: uma escala é de um serviço, e
            // "nenhum serviço" não é um deles.
            ["grupo", "Equipe"],
            ["trocas", "Trocas", trocasParaMim],
            ["grupo", "Faturamento"],
            ["producao", "Produção"],
            ["grupo", "Configuração"],
            ["modelos", "Modelos"],
          ] as [string, string, number?][]).map(([id, rotulo, contador], i) =>
            id === "grupo"
              ? <span className="financeTarefaGrupo" key={`g${i}`}>{rotulo}</span>
              : <button
                  type="button" key={id}
                  className={secaoAtiva === id ? "active" : ""}
                  aria-current={secaoAtiva === id ? "true" : undefined}
                  onClick={() => irPara(id)}
                >
                  <span>{rotulo}</span>
                  {contador ? <b className="financeTarefaContador">{contador}</b> : null}
                </button>,
          )}
        </nav>

        <div className="financeConteudo">
      {aba === "escala" && (
        <>
          <p className="plantaoEscopoNota">{notaDaEscala}</p>

          {/* Quem não aparece para escalar, e por quê.
              Sem esta linha, o coordenador abre a fila de nomes, não encontra
              um colega que trabalha ali todo dia e conclui que a tela está
              quebrada — em vez de ir preencher o CRM que falta. Só para quem
              monta a escala: é ele quem tem onde consertar. */}
          {ehAdmin && escopo === "grupo" && semCRM.length > 0 && (
            <p className="plantaoNota">
              {plural(semCRM.length, "profissional está", "profissionais estão")} fora
              da escala por falta de CRM no cadastro: <strong>{semCRM.join(", ")}</strong>.
              A escala é o documento de quem responde pela anestesia, e o registro
              faz parte dele. O CRM se preenche em <strong>Admin → Equipe</strong>.
            </p>
          )}
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
                  onClick={() => setLancando({
                    dia: hojeISO.startsWith(mes) ? hojeISO : `${mes}-01`, para: perfilId,
                  })}>
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

                  // Na escala do grupo o dia sai em três faixas — M, T, N — com
                  // quem cobre cada uma. É como a escala é lida na parede do
                  // hospital: primeiro o turno, depois quem está nele. Só a
                  // letra, porque "Manhã" por extenso três vezes não cabe num
                  // quadrado de calendário, e o nome inteiro está no title.
                  const faixasDia = escopo === "grupo" ? faixasDoDia(dia) : [];

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
                              {faixasDia.map((f) => (
                                <i key={f.id} className={`plantaoFaixa${f.blocos.length ? "" : " vazia"}`}
                                  title={f.blocos.length
                                    ? `${f.nome} — ` + f.blocos.map((t) =>
                                        `${faixa(t.inicio, t.fim)}`
                                        + `${t.localId ? ` ${localPorId.get(t.localId) ?? ""}` : ""}`
                                        + `: ${t.gente.map((g) => nomePorId.get(g.perfil_id) ?? "").join(", ")}`
                                      ).join(" · ")
                                    : `${f.nome} — ninguém escalado`}>
                                  <b>{f.letra}</b>
                                  <span className="plantaoQuem">
                                    {f.blocos.length === 0 && <em className="plantaoVazio">—</em>}
                                    {f.blocos.map((t) => (
                                      <span key={t.chave} className="plantaoBloco">
                                        {/* O nome do hospital só entra quando a
                                            faixa junta equipes de hospitais
                                            diferentes: sem ele, as iniciais das
                                            duas viram uma fileira só e a tela
                                            mostra uma escala que não existe. */}
                                        {f.separarPorLocal && (
                                          <u className="plantaoOnde1">
                                            {t.localId ? localPorId.get(t.localId) ?? "—" : "Sem local"}
                                          </u>
                                        )}
                                        {t.gente.slice(0, 4).map((g) => (
                                          <em key={g.id} className={`med-${corPorMedico.get(g.perfil_id) ?? "m8"}${g.perfil_id === perfilId ? " eu" : ""}`}>
                                            {iniciais(nomePorId.get(g.perfil_id) ?? "")}
                                          </em>
                                        ))}
                                        {t.gente.length > 4 && <em className="plantaoMais">+{t.gente.length - 4}</em>}
                                      </span>
                                    ))}
                                  </span>
                                </i>
                              ))}
                            </>
                          : <>
                              {/* Escala pessoal: horário e onde. O lugar é o que
                                  muda de um plantão para outro na agenda de quem
                                  roda três hospitais. */}
                              {doDia.slice(0, 2).map((p) => {
                                const mo = p.modelo_id ? modeloPorId.get(p.modelo_id) : undefined;
                                return (
                                  <i key={p.id} className={`plantaoEtiqueta etq-${mo?.cor ?? "cinza"}`}
                                    title={`${nomeDoPeriodo(p.hora_inicio, p.hora_fim)} · ${faixa(p.hora_inicio, p.hora_fim)}${ondeFica(p, localPorId, "") ? ` · ${ondeFica(p, localPorId, "")}` : ""}`}>
                                    <b>{faixa(p.hora_inicio, p.hora_fim)}</b>
                                    <span>{ondeFica(p, localPorId)}</span>
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
              pessoal={escopo === "minha"}
              institutionId={institutionId} conveniosConhecidos={conveniosConhecidos}
              colegas={escalaveis} apelidos={apelidos} corPorMedico={corPorMedico}
              nomePorId={nomePorId} localPorId={localPorId}
              onLancar={lancar} onLancarAvulso={(d, p) => setLancando({ dia: d, para: p })}
              onRemover={remover} onPassar={(p) => setPedindoTroca(p)}
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
                    <strong>{escopo === "grupo" ? nomePorId.get(p.perfil_id) ?? "Profissional" : ondeFica(p, localPorId)}</strong>
                    <small>{escopo === "grupo" ? ondeFica(p, localPorId) : null}</small>
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
                          {/* "Cancelado" some da escala igualzinho a apagar, e
                              some sem ninguém saber. Num plantão do grupo é a
                              mesma regra do Remover: sai passando para um
                              colega. O banco recusa de qualquer forma; tirar a
                              opção evita o erro depois do clique. */}
                          {(p.privado || ehAdmin || p.situacao === "cancelado") && (
                            <option value="cancelado">Cancelado</option>
                          )}
                        </select>
                      </label>
                    )}
                  </span>
                  <span className="plantaoCelula">
                    {/* O botão vai dentro da mesma estrutura dos campos, com um
                        rótulo vazio no lugar do texto. Sem isso ele fica a uma
                        altura de rótulo acima dos campos vizinhos — e acertar
                        isso com um padding escolhido a olho volta a desalinhar
                        assim que a fonte ou o corpo do rótulo mudar. */}
                    {/* Plantão privado não se oferece: o colega não o enxerga,
                        não sabe onde fica nem quanto vale, e aceitaria às
                        cegas. Ele se apaga, que é o que faz sentido para um
                        turno que só existe para você. */}
                    {meu && !p.privado && (
                      <span className="inlineMoney">
                        <span aria-hidden="true">&nbsp;</span>
                        <button className="outlineClinical" onClick={() => setPedindoTroca(p)}>
                          {p.aberto_para_troca ? "Trocar de novo" : "Passar plantão"}
                        </button>
                      </span>
                    )}
                    {meu && p.privado && (
                      <span className="inlineMoney">
                        <span aria-hidden="true">&nbsp;</span>
                        <button className="outlineClinical red" onClick={() => void remover(p.id)}>
                          Apagar
                        </button>
                      </span>
                    )}
                  </span>
                </div>
                );
              })}
          </section>
        </>
      )}

      {aba === "producao" && (
        <ProducaoDoMes
          mes={mes} nomeMes={MESES[m - 1]} ano={ano} onImprimir={imprimirProducao}
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
      </div>

      {/* Os modais ficam fora da grade: são sobreposições de tela inteira, e
          dentro da coluna herdariam a largura dela. */}
      {lancando && (
        <LancarPlantao
          dia={lancando.dia} para={lancando.para} locais={locais} modelos={modelos}
          colegas={escalaveis} apelidos={apelidos} corPorMedico={corPorMedico}
          perfilId={perfilId} ehAdmin={ehAdmin}
          onFechar={() => setLancando(null)} onSalvar={lancarAvulso}
        />
      )}

      {pedindoTroca && (
        <PedirTroca
          plantao={pedindoTroca} colegas={escalaveis.filter((c) => c.id !== perfilId)}
          localPorId={localPorId}
          onFechar={() => setPedindoTroca(null)}
          onEnviar={(destino, msg) => void pedirTroca(pedindoTroca, destino, msg)}
        />
      )}

    </div>
  );
}

function DiaDetalhe({
  dia, plantoes, modelos, colegas, apelidos, corPorMedico,
  perfilId, ehAdmin, pessoal, institutionId, conveniosConhecidos,
  nomePorId, localPorId, onLancar, onLancarAvulso, onRemover, onPassar, onFechar,
}: {
  dia: string; plantoes: Plantao[]; modelos: Modelo[]; perfilId: string;
  colegas: Colega[]; apelidos: Map<string, string>; corPorMedico: Map<string, string>;
  ehAdmin: boolean; pessoal: boolean;
  institutionId: string; conveniosConhecidos: string[];
  nomePorId: Map<string, string>; localPorId: Map<string, string>;
  onLancar: (dia: string, modelo: Modelo, para: string) => void;
  onLancarAvulso: (dia: string, para: string) => void;
  onRemover: (id: string) => void;
  onPassar: (p: Plantao) => void;
  onFechar: () => void;
}) {
  const [d, mm, aa] = [dia.slice(8, 10), dia.slice(5, 7), dia.slice(0, 4)];
  // A anotação se liga ao plantão quando não há dúvida de qual é. Com dois
  // turnos seus no mesmo dia, escolher um por conta própria seria chute.
  const meusDoDia = plantoes.filter((p) => p.perfil_id === perfilId && p.situacao !== "cancelado");

  /**
   * Para quem o próximo clique escala.
   *
   * A escala do serviço era montada numa planilha: clicar na célula do dia,
   * abrir a lista, escolher o nome. São dois toques, e é o que se repete
   * quarenta vezes numa tarde de montagem. Aqui é o mesmo gesto — escolher a
   * pessoa, clicar no turno —, e a escolha FICA de pé entre um lançamento e
   * outro, porque quem monta a escala costuma pôr a mesma pessoa em vários
   * dias seguidos.
   *
   * Nasce em "mim" e só existe para quem monta a escala. Sem ser
   * administrador, o único destino possível é você mesmo — e o RLS confirma.
   */
  const [para, setPara] = useState(perfilId);
  const escalaOutro = ehAdmin && para !== perfilId;
  // Quem já está neste dia: escalar duas vezes a mesma pessoa no mesmo turno
  // é o erro mais fácil de cometer clicando rápido, e o banco recusa com um
  // erro seco. Marcado no botão, ele nem chega a ser clicado.
  const jaNoDia = new Set(plantoes.filter((p) => p.situacao !== "cancelado").map((p) => p.perfil_id));
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
            <small>{ondeFica(p, localPorId)}{p.privado ? " · só você vê" : ""}</small>
          </span>
          {/* Três botões diferentes, e a diferença é de regra, não de tela.
              O administrador tira da escala o plantão de qualquer um: quem
              monta a escala corrige a escala. O plantão privado é só seu e
              some quando você quiser. O da escala do grupo não se apaga — sai
              passando para um colega que aceite, porque quem some de um turno
              sem avisar deixa o buraco para o dia da cirurgia. */}
          {ehAdmin || (p.perfil_id === perfilId && p.privado)
            ? <button className="outlineClinical red" onClick={() => onRemover(p.id)}>Remover</button>
            : p.perfil_id === perfilId
              ? <button className="outlineClinical" onClick={() => onPassar(p)}
                  title="Este plantão é da escala do grupo: ele sai da sua escala quando um colega aceitar">
                  Passar plantão
                </button>
              : <span className="statusChip paused">de colega</span>}
        </div>
      ))}

      {/* Escolher a pessoa, e só então o turno. A ordem é essa porque é a
          pergunta que se faz montando escala: "quem fica na quinta?" — o
          horário já está decidido antes de abrir o dia.

          Só para quem monta a escala, e só quando há mais de uma pessoa: para
          o anestesista sozinho a fila seria um botão único escrito "Para mim",
          que não escolhe nada. */}
      {ehAdmin && !pessoal && colegas.length > 1 && (
        <div className="plantaoParaQuem">
          <span>Escalar:</span>
          <div className="plantaoFilaNomes" role="group" aria-label="Para quem escalar">
            <button type="button"
              className={`plantaoNomeChip${para === perfilId ? " escolhido" : ""}`}
              aria-pressed={para === perfilId} onClick={() => setPara(perfilId)}>
              Para mim
            </button>
            {colegas.filter((c) => c.id !== perfilId).map((c) => (
              <button type="button" key={c.id}
                className={`plantaoNomeChip med-${corPorMedico.get(c.id) ?? "m8"}`
                  + `${para === c.id ? " escolhido" : ""}${jaNoDia.has(c.id) ? " jaEscalado" : ""}`}
                aria-pressed={para === c.id}
                title={jaNoDia.has(c.id) ? `${c.nome} — já está neste dia` : c.nome}
                onClick={() => setPara(c.id)}>
                {apelidos.get(c.id) ?? c.nome}
                {jaNoDia.has(c.id) && <b aria-hidden="true">✓</b>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="plantaoLancar">
        <span>{escalaOutro
          ? `Turno de ${apelidos.get(para) ?? "quem você escolheu"}:`
          : "Lançar a partir de um modelo:"}</span>
        {modelos.length === 0
          ? <button className="primaryClinical compact" onClick={() => onLancarAvulso(dia, para)}>
              + Lançar plantão neste dia
            </button>
          : modelos.map((mo) => (
            <button key={mo.id} className={`plantaoModeloChip cor-${mo.cor}`} onClick={() => onLancar(dia, mo, para)}>
              <b>{mo.nome}</b>
              {/* O valor do modelo é o SEU. Escalando outra pessoa ele sairia
                  da tela como promessa de pagamento que não foi combinada com
                  ninguém — o plantão dela entra com valor zero, e ela ajusta. */}
              <small>{hhmm(mo.hora_inicio)}–{hhmm(mo.hora_fim)}{escalaOutro ? "" : ` · ${money(Number(mo.valor))}`}</small>
            </button>
          ))}
        {/* O caminho manual continua inteiro: data, local, horário e para quem,
            tudo à mão. O atalho não substitui o formulário — ele leva a pessoa
            escolhida junto para dentro dele. */}
        {modelos.length > 0 && (
          <button className="outlineClinical" onClick={() => onLancarAvulso(dia, para)}>
            Outro horário…
          </button>
        )}
      </div>

      {/* O caderninho do dia. Fica aqui, no painel que já abre ao tocar no
          dia, e não numa tela à parte: a anotação é feita no fim do plantão,
          com o jaleco ainda vestido, e cada toque a mais é um paciente que
          deixa de ser anotado.

          Só na escala pessoal. Na do grupo o dia que se abre é o de todo
          mundo, e um caderno de pacientes embaixo dele sugere que se está
          anotando a produção da equipe — quando a lista é, e continua sendo,
          estritamente de quem escreve. */}
      {pessoal && (
        <ProducaoDoDia
          dia={dia} perfilId={perfilId} institutionId={institutionId}
          conveniosConhecidos={conveniosConhecidos}
          plantaoId={meusDoDia.length === 1 ? meusDoDia[0].id : null}
        />
      )}
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
              Nenhum local cadastrado ainda. O cadastro fica em{" "}
              <strong>Admin → Organização → Locais de atendimento</strong>.
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
  dia, para, locais, modelos, colegas, apelidos, corPorMedico,
  perfilId, ehAdmin, onFechar, onSalvar,
}: {
  dia: string;
  /** Quem já vinha escolhido na fila rápida do painel do dia. */
  para: string;
  locais: LocalDisponivel[];
  modelos: Modelo[];
  colegas: Colega[];
  apelidos: Map<string, string>;
  corPorMedico: Map<string, string>;
  perfilId: string;
  ehAdmin: boolean;
  onFechar: () => void;
  onSalvar: (d: {
    data: string; local_id: string; local_texto: string;
    hora_inicio: string; hora_fim: string; valor: number;
    perfil_id: string; privado: boolean;
  }) => void;
}) {
  const [form, setForm] = useState({
    data: dia, local_id: locais[0]?.id ?? "", local_texto: "",
    hora_inicio: "07:00", hora_fim: "19:00",
    valor: "", perfil_id: ehAdmin ? para : perfilId, privado: false,
  });
  // Privado é sempre para si: um turno que só a outra pessoa enxerga, lançado
  // por você, é agenda dela. Marcar a chave devolve o destino para você.
  const paraOutro = ehAdmin && !form.privado && form.perfil_id !== perfilId;

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
                Só dá para escalar a si mesmo: não há outro médico com CRM
                cadastrado. Quem você convidar em <strong>Admin → Convidar</strong> passa
                a aparecer aqui assim que o CRM dele estiver preenchido —
                recepção e financeiro não entram na escala.
              </p>
            )}

            {/* Quem monta a escala do serviço escala os outros. Sem este campo,
                "Escala do grupo" era um diário compartilhado: mostrava o que
                cada um lançou para si, e não a escala que alguém montou. */}
            {/* Os dois caminhos, um em cima do outro e sempre os dois. A fila
                é o atalho: um toque no nome e pronto. A lista suspensa
                continua embaixo porque com quinze pessoas na organização a
                fila vira um muro de botões, e porque nela o nome aparece
                inteiro — que é o que se confere antes de escalar alguém para
                um plantão. As duas são o mesmo campo: mexer numa move a outra.

                A fila fica FORA do <label>. Dentro dele, o clique num chip
                seria repassado ao controle rotulado e abriria a lista suspensa
                junto — dois campos reagindo a um toque só. */}
            {/* A chave do plantão de fora.
                Vem antes de "para quem" e de "local" porque muda os dois: um
                plantão privado é sempre seu, e o lugar dele não sai do cadastro
                da organização. Deixá-la no fim faria a pessoa preencher o
                formulário inteiro e ver metade dele mudar no último clique. */}
            <label className="localCompartilhar span4">
              <input type="checkbox" checked={form.privado}
                onChange={(e) => setForm({ ...form, privado: e.target.checked })} />
              <span><strong>Plantão só meu</strong>
                <small>
                  Sedação fora, hospital que não é do grupo, cobertura particular.
                  Aparece só na sua escala e no seu mês — ninguém do grupo enxerga,
                  nem quem monta a escala.
                </small></span>
            </label>

            {ehAdmin && colegas.length > 1 && !form.privado && (
              <div className="plantaoFilaCampo span4">
                <span className="plantaoFilaRotulo" id="para-quem-rapido">Para quem</span>
                <div className="plantaoFilaNomes" role="group" aria-labelledby="para-quem-rapido">
                  <button type="button"
                    className={`plantaoNomeChip${form.perfil_id === perfilId ? " escolhido" : ""}`}
                    aria-pressed={form.perfil_id === perfilId}
                    onClick={() => setForm({ ...form, perfil_id: perfilId })}>
                    Para mim
                  </button>
                  {colegas.filter((c) => c.id !== perfilId).map((c) => (
                    <button type="button" key={c.id} title={c.nome}
                      className={`plantaoNomeChip med-${corPorMedico.get(c.id) ?? "m8"}`
                        + `${form.perfil_id === c.id ? " escolhido" : ""}`}
                      aria-pressed={form.perfil_id === c.id}
                      onClick={() => setForm({ ...form, perfil_id: c.id })}>
                      {apelidos.get(c.id) ?? c.nome}
                    </button>
                  ))}
                </div>
                <label className="clinicalField">
                  <span>Ou escolha pelo nome completo</span>
                  <select value={form.perfil_id}
                    onChange={(e) => setForm({ ...form, perfil_id: e.target.value })}>
                    <option value={perfilId}>Para mim</option>
                    {colegas.filter((c) => c.id !== perfilId).map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <label className="clinicalField span2"><span>Data</span>
              <input type="date" value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })} /></label>
            {/* No plantão privado o lugar é escrito à mão, e não escolhido.
                Cadastrar a clínica de endoscopia em "Locais de atendimento"
                resolveria o nome e estragaria o resto: local do cadastro é do
                grupo, vira coluna na escala do grupo e aparece para todo mundo
                — exatamente o oposto de um plantão que só você vê. */}
            {form.privado
              ? <label className="clinicalField span2"><span>Onde</span>
                  <input value={form.local_texto} maxLength={80}
                    placeholder="Clínica de endoscopia, Hospital São José…"
                    onChange={(e) => setForm({ ...form, local_texto: e.target.value })} />
                  <small className="campoDica">
                    Escrito por você, e não do cadastro da organização — este nome
                    não aparece para ninguém do grupo.
                  </small></label>
              : <label className="clinicalField span2"><span>Local</span>
                  <select value={form.local_id} onChange={(e) => setForm({ ...form, local_id: e.target.value })}>
                    <option value="">Sem local</option>
                    {locais.map((l) => <option key={l.id} value={l.id}>{nomeDoLocal(l)}</option>)}
                  </select>
                  {/* Lista vazia é um beco: a pessoa abre o campo, encontra só
                      "Sem local" e não tem como adivinhar que o cadastro é noutra
                      tela. Foi a primeira pergunta de quem usou. */}
                  {locais.length === 0 && (
                    <small className="campoDica">
                      Nenhum local cadastrado. O cadastro fica em{" "}
                      <strong>Admin → Organização → Locais de atendimento</strong>.
                    </small>
                  )}</label>}
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
            <h2 id="pedir-troca">Passar plantão</h2>
            <p>
              {Number(plantao.data.slice(8, 10))}/{plantao.data.slice(5, 7)} ·{" "}
              {hhmm(plantao.hora_inicio)}–{hhmm(plantao.hora_fim)} ·{" "}
              {ondeFica(plantao, localPorId, "sem local")}
            </p>
            {/* Dito antes do envio, e não depois: quem clica aqui está saindo
                de um plantão, e precisa saber que ainda não saiu. */}
            <p className="plantaoNota">
              O plantão continua seu até alguém aceitar. Enquanto ninguém aceitar,
              você segue escalado.
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
          <small>{ondeFica(p, localPorId)}</small>
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
