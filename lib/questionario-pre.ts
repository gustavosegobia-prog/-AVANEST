// O questionário pré-anestésico que o paciente responde pelo celular.
//
// COMO FUNCIONA. A recepção manda pelo WhatsApp um link pessoal (/q/<token>),
// que vale 7 dias. O paciente responde sem login. Na consulta, o médico vê as
// respostas na avaliação e traz para a ficha o que quiser, com um toque.
//
// UMA DEFINIÇÃO SÓ. As perguntas moram aqui e servem às três telas: a página
// do paciente desenha a partir delas, a avaliação lê as respostas por elas e
// "Trazer as respostas" usa o mesmo mapa. Escritas em dois lugares, a
// pergunta que o paciente viu e a que o médico leu divergiriam calado.
//
// O QUE O PACIENTE DIZ NÃO VIRA DIAGNÓSTICO. As respostas preenchem só campo
// vazio, e a avaliação marca o que veio do paciente. Os remédios ficam de
// fora da lista estruturada de propósito: o nome escrito pelo paciente
// ("remédio da pressão, o branquinho") e a foto da receita vão para o médico
// ler e cadastrar. Gerar o cartão do remédio sozinho daria dose e conduta a
// um texto que ninguém conferiu.

export const SIM = "sim";
export const NAO = "nao";
export const NAO_SEI = "naosei";

export type Respostas = Record<string, string | string[]>;

/** O que o questionário sabe do paciente antes de ele responder. */
export type Contexto = { sexo?: string | null };

export type Opcao = {
  id: string;
  /** Como o paciente lê. */
  texto: string;
  /** O botão equivalente na avaliação, quando existe. */
  ficha?: string;
};

export type Pergunta = {
  id: string;
  texto: string;
  ajuda?: string;
  /**
   * simnao: Sim / Não / Não sei, e com "Sim" abrem as marcas e o detalhe.
   * escolha: uma opção só. marcar: várias opções, sem o Sim/Não antes.
   */
  tipo: "simnao" | "escolha" | "marcar" | "numero" | "texto" | "data";
  opcoes?: Opcao[];
  /** Texto livre que abre com "Sim" (ou sempre, nos tipos texto). */
  detalhe?: string;
  /** Com o detalhe aberto, ele é obrigatório (o nome do que dá alergia, quem é o familiar). */
  detalheObrigatorio?: boolean;
  unidade?: string;
  /** Pode ficar em branco. */
  opcional?: boolean;
  /** A pergunta só aparece quando a condição vale. */
  se?: (r: Respostas, ctx: Contexto) => boolean;
};

export type Bloco = { id: string; titulo: string; perguntas: Pergunta[] };

const marcou = (r: Respostas, pergunta: string, opcao: string) => {
  const m = r[`${pergunta}.marcas`];
  return Array.isArray(m) && m.includes(opcao);
};
const disse = (r: Respostas, pergunta: string, valor: string) => r[pergunta] === valor;

// Perguntas curtas, no estilo da ficha impressa (11/11/2026: "tem como ser
// mais diretos nas perguntas"). O exemplo, quando ajuda, fica na linha de
// baixo, em letra menor. O `id` de cada pergunta e de cada opção não muda:
// é ele que leva a resposta ao campo da avaliação.
export const BLOCOS: Bloco[] = [
  {
    id: "voce",
    titulo: "Sobre você",
    perguntas: [
      {
        id: "quem", tipo: "escolha", texto: "Quem está respondendo?",
        opcoes: [
          { id: "paciente", texto: "O paciente" },
          { id: "familiar", texto: "Familiar ou responsável" },
        ],
        detalhe: "Nome e parentesco", detalheObrigatorio: true,
      },
      { id: "peso", tipo: "numero", texto: "Peso", unidade: "kg", opcional: true, ajuda: "Se não souber, deixe em branco." },
      { id: "altura", tipo: "numero", texto: "Altura", unidade: "cm", opcional: true, ajuda: "Ex.: 1,65 m = 165" },
      { id: "cirurgia", tipo: "texto", texto: "Cirurgia que vai fazer", opcional: true },
      { id: "cirurgiao", tipo: "texto", texto: "Cirurgião", opcional: true, ajuda: "Se souber." },
    ],
  },
  {
    id: "anestesias",
    titulo: "Cirurgias e anestesias",
    perguntas: [
      { id: "cirurgias", tipo: "simnao", texto: "Já fez cirurgia?", detalhe: "Quais e quando" },
      {
        id: "anestesias", tipo: "marcar", texto: "Tipo de anestesia", opcional: true,
        se: (r) => disse(r, "cirurgias", SIM),
        opcoes: [
          { id: "geral", texto: "Geral (dormiu)" },
          { id: "raqui", texto: "Raqui ou peridural" },
          { id: "sedacao", texto: "Sedação" },
          { id: "local", texto: "Local" },
          { id: "naosei", texto: "Não sei" },
        ],
      },
      {
        id: "problema", tipo: "simnao", texto: "Problema com anestesia?", detalhe: "O que aconteceu",
        opcoes: [
          { id: "enjoo", texto: "Enjoo ou vômito forte", ficha: "Náuseas/vômitos intensos" },
          { id: "tubo", texto: "Difícil colocar o tubo", ficha: "Intubação difícil" },
          { id: "alergia", texto: "Alergia", ficha: "Alergia" },
          { id: "febre", texto: "Febre muito alta" },
          { id: "cefaleia", texto: "Dor de cabeça após raqui", ficha: "Cefaleia pós-raqui" },
          { id: "acordar", texto: "Demorou para acordar" },
          { id: "uti", texto: "Foi para a UTI", ficha: "UTI" },
        ],
      },
      {
        id: "familia", tipo: "simnao", texto: "Problema grave com anestesia na família?",
        ajuda: "Ex.: febre muito alta, UTI ou morte.", detalhe: "Quem e o que aconteceu",
      },
      { id: "viagem", tipo: "simnao", texto: "Enjoa em viagem?" },
    ],
  },
  {
    id: "coracao",
    titulo: "Coração, pulmão e diabetes",
    perguntas: [
      {
        id: "coracao", tipo: "simnao", texto: "Pressão alta ou doença do coração?", detalhe: "Outra ou detalhe",
        opcoes: [
          { id: "pressao", texto: "Pressão alta", ficha: "Hipertensão" },
          { id: "infarto", texto: "Infarto", ficha: "Infarto" },
          { id: "stent", texto: "Stent ou ponte de safena", ficha: "Coronariopatia" },
          { id: "fraco", texto: "Insuficiência cardíaca", ficha: "Insuficiência cardíaca" },
          { id: "arritmia", texto: "Arritmia", ficha: "Arritmia" },
          { id: "valvula", texto: "Doença de válvula", ficha: "Valvopatia" },
          { id: "marcapasso", texto: "Marca-passo", ficha: "Marca-passo/CDI" },
        ],
      },
      { id: "esforco", tipo: "simnao", texto: "Dor no peito ou falta de ar ao esforço?" },
      {
        id: "pulmao", tipo: "simnao", texto: "Doença no pulmão?", ajuda: "Ex.: asma, bronquite, enfisema.", detalhe: "Outra ou detalhe",
        opcoes: [
          { id: "asma", texto: "Asma", ficha: "Asma" },
          { id: "dpoc", texto: "Bronquite crônica ou enfisema", ficha: "DPOC" },
          { id: "apneia", texto: "Apneia do sono", ficha: "Apneia do sono" },
        ],
      },
      {
        id: "crise", tipo: "texto", texto: "Última crise", opcional: true, ajuda: "Ex.: há 3 meses.",
        se: (r) => disse(r, "pulmao", SIM) && (marcou(r, "pulmao", "asma") || marcou(r, "pulmao", "dpoc")),
      },
      {
        id: "diabetes", tipo: "simnao", texto: "Diabetes?", detalhe: "Detalhe",
        opcoes: [
          { id: "insulina", texto: "Insulina", ficha: "Insulina" },
          { id: "comprimido", texto: "Comprimido" },
          { id: "hipo", texto: "Hipoglicemia recente", ficha: "Hipoglicemia recente" },
        ],
      },
    ],
  },
  {
    id: "outras",
    titulo: "Outras doenças",
    perguntas: [
      {
        id: "neuro", tipo: "simnao", texto: "Doença neurológica ou psiquiátrica?",
        ajuda: "Ex.: convulsão, derrame, Parkinson, depressão.", detalhe: "Outra ou detalhe",
        opcoes: [
          { id: "epilepsia", texto: "Convulsão / epilepsia", ficha: "Epilepsia" },
          { id: "avc", texto: "Derrame (AVC)", ficha: "AVC/AIT" },
          { id: "parkinson", texto: "Parkinson", ficha: "Parkinson" },
          { id: "demencia", texto: "Demência", ficha: "Demência" },
          { id: "depressao", texto: "Depressão", ficha: "Depressão" },
          { id: "ansiedade", texto: "Ansiedade", ficha: "Ansiedade" },
          { id: "bipolar", texto: "Transtorno bipolar", ficha: "Transtorno bipolar" },
        ],
      },
      {
        id: "outras", tipo: "simnao", texto: "Outra doença?", ajuda: "Ex.: tireoide, rins, fígado.", detalhe: "Outra ou detalhe",
        opcoes: [
          { id: "hipotireoidismo", texto: "Hipotireoidismo", ficha: "Hipotireoidismo" },
          { id: "hipertireoidismo", texto: "Hipertireoidismo", ficha: "Hipertireoidismo" },
          { id: "tireoide", texto: "Tireoide (não sei qual)" },
          { id: "rins", texto: "Doença nos rins", ficha: "Doença renal crônica" },
          { id: "dialise", texto: "Diálise", ficha: "Em diálise" },
          { id: "hepatite", texto: "Hepatite", ficha: "Hepatite" },
          { id: "cirrose", texto: "Cirrose", ficha: "Cirrose" },
          { id: "refluxo", texto: "Refluxo / azia", ficha: "Refluxo (DRGE)" },
          { id: "artrite", texto: "Artrite reumatoide", ficha: "Artrite reumatoide" },
          { id: "lupus", texto: "Lúpus", ficha: "Lúpus" },
          { id: "cancer", texto: "Câncer", ficha: "Câncer" },
        ],
      },
      {
        id: "aguda", tipo: "simnao", texto: "Gripe, febre ou infecção nas últimas 2 semanas?", detalhe: "Detalhe",
        opcoes: [
          { id: "gripe", texto: "Gripe", ficha: "Gripe" },
          { id: "febre", texto: "Febre", ficha: "Febre" },
          { id: "tosse", texto: "Tosse", ficha: "Tosse" },
          { id: "urina", texto: "Infecção de urina", ficha: "ITU" },
          { id: "diarreia", texto: "Diarreia ou vômitos", ficha: "Diarreia/vômitos" },
        ],
      },
      { id: "glaucoma", tipo: "simnao", texto: "Glaucoma?" },
      {
        id: "gravidez", tipo: "escolha", texto: "Grávida ou pode estar?",
        se: (_r, ctx) => String(ctx.sexo ?? "").toLowerCase() !== "masculino",
        opcoes: [
          { id: SIM, texto: "Sim" },
          { id: NAO, texto: "Não" },
          { id: NAO_SEI, texto: "Não sei" },
          { id: "naoaplica", texto: "Não se aplica" },
        ],
      },
      {
        id: "semanas", tipo: "texto", texto: "Quantas semanas?", opcional: true,
        se: (r) => disse(r, "gravidez", SIM),
      },
    ],
  },
  {
    id: "diaadia",
    titulo: "Seu dia a dia",
    perguntas: [
      {
        id: "escada", tipo: "escolha", texto: "Sobe 2 andares de escada sem parar?",
        opcoes: [
          { id: "sim", texto: "Sim" },
          { id: "cansa", texto: "Não: paro por cansaço ou falta de ar" },
          { id: "outro", texto: "Não: por outro motivo (dor, joelho…)" },
          { id: NAO_SEI, texto: "Não sei" },
        ],
      },
      { id: "ronco", tipo: "simnao", texto: "Ronca alto?" },
      { id: "sono", tipo: "simnao", texto: "Muito sono ou cansaço durante o dia?" },
      { id: "parada", tipo: "simnao", texto: "Já viram você parar de respirar dormindo?" },
      {
        id: "habitos", tipo: "simnao", texto: "Fuma, bebe ou usa drogas?",
        detalhe: "Quanto. Se parou, quando.",
        opcoes: [
          { id: "fumo", texto: "Fumo / vape", ficha: "Tabagismo" },
          { id: "alcool", texto: "Álcool", ficha: "Álcool" },
          { id: "maconha", texto: "Maconha", ficha: "Cannabis" },
          { id: "cocaina", texto: "Cocaína ou estimulante", ficha: "Cocaína/estimulantes" },
        ],
      },
      {
        id: "dentes", tipo: "simnao", texto: "Prótese dentária, aparelho ou dente mole?", detalhe: "Detalhe",
        opcoes: [
          { id: "dentadura", texto: "Dentadura / ponte móvel", ficha: "Prótese removível" },
          { id: "fixa", texto: "Prótese fixa / implante", ficha: "Prótese fixa" },
          { id: "mole", texto: "Dente mole", ficha: "Dente solto" },
          { id: "quebrado", texto: "Dente quebrado", ficha: "Dente fraturado" },
          { id: "aparelho", texto: "Aparelho", ficha: "Aparelho" },
          { id: "semdentes", texto: "Sem dentes", ficha: "Edentado" },
        ],
      },
    ],
  },
  {
    id: "remedios",
    titulo: "Alergias e remédios",
    perguntas: [
      {
        id: "alergia", tipo: "simnao", texto: "Alergia?", ajuda: "A remédio, látex, alimento ou outra coisa.",
        detalhe: "Nome de cada um e o que aconteceu", detalheObrigatorio: true,
        opcoes: [
          { id: "remedio", texto: "Remédio", ficha: "Medicamentos" },
          { id: "latex", texto: "Látex", ficha: "Látex" },
          { id: "contraste", texto: "Contraste de exame", ficha: "Contraste iodado" },
          { id: "alimento", texto: "Alimento", ficha: "Alimentos" },
          { id: "antisseptico", texto: "Esparadrapo / iodo", ficha: "Antissépticos" },
          { id: "outra", texto: "Outra", ficha: "Outros" },
        ],
      },
      {
        id: "remedios", tipo: "simnao", texto: "Remédio de uso diário?",
        detalhe: "Nome e dose (ou mande a foto da receita abaixo)",
      },
      {
        id: "sangue", tipo: "simnao", texto: "Remédio para afinar o sangue?", detalhe: "Outro ou detalhe",
        opcoes: [
          { id: "aas", texto: "AAS (aspirina)" },
          { id: "clopidogrel", texto: "Clopidogrel" },
          { id: "varfarina", texto: "Varfarina (Marevan)" },
          { id: "rivaroxabana", texto: "Rivaroxabana (Xarelto)" },
          { id: "apixabana", texto: "Apixabana (Eliquis)" },
          { id: "dabigatrana", texto: "Dabigatrana (Pradaxa)" },
        ],
      },
      {
        id: "caneta", tipo: "simnao", texto: "Remédio para emagrecer?",
        ajuda: "Ex.: Ozempic, Mounjaro, Wegovy, Saxenda, Rybelsus.", detalhe: "Qual",
      },
      {
        id: "caneta_dia", tipo: "data", texto: "Data da última dose", opcional: true,
        se: (r) => disse(r, "caneta", SIM),
      },
    ],
  },
  {
    id: "fim",
    titulo: "Para terminar",
    perguntas: [
      { id: "mais", tipo: "texto", texto: "Algo mais para o anestesiologista?", opcional: true },
    ],
  },
];

export const TODAS = BLOCOS.flatMap((b) => b.perguntas);

/**
 * As partes que o paciente não chegou a concluir, pelo número de partes
 * salvas. A última ("Para terminar") só tem campo opcional e não conta.
 */
export function partesQueFaltam(parte: number | null | undefined): string[] {
  const feitas = Math.max(0, Math.floor(Number(parte) || 0));
  return BLOCOS.slice(feitas).filter((b) => b.perguntas.some((p) => !p.opcional)).map((b) => b.titulo);
}
const POR_ID = new Map(TODAS.map((p) => [p.id, p]));

export const MAX_FOTOS = 4;
export const VALIDADE_DIAS = 7;

export const perguntasDoBloco = (bloco: Bloco, r: Respostas, ctx: Contexto) =>
  bloco.perguntas.filter((p) => !p.se || p.se(r, ctx));

const texto = (r: Respostas, chave: string) => {
  const v = r[chave];
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
};
const marcas = (r: Respostas, id: string): string[] => {
  const m = r[`${id}.marcas`];
  const validas = new Set((POR_ID.get(id)?.opcoes ?? []).map((o) => o.id));
  return Array.isArray(m) ? m.filter((x) => typeof x === "string" && validas.has(x)) : [];
};

/** O detalhe abre com o "Sim", e na pergunta de quem responde, com "familiar". */
export const detalheAberto = (p: Pergunta, r: Respostas) =>
  p.tipo === "simnao" ? r[p.id] === SIM : p.id === "quem" && r.quem === "familiar";

/** As perguntas do bloco que ainda pedem resposta. */
export function faltandoNoBloco(bloco: Bloco, r: Respostas, ctx: Contexto): string[] {
  return perguntasDoBloco(bloco, r, ctx).filter((p) => {
    if (p.opcional) return false;
    if (p.detalheObrigatorio && detalheAberto(p, r) && !texto(r, `${p.id}.texto`)) return true;
    return !texto(r, p.id);
  }).map((p) => p.id);
}

/** Respostas soltas sem sentido (perguntas que sumiram, valores trocados) saem antes de gravar. */
export function limparRespostas(r: Respostas, ctx: Contexto): Respostas {
  const limpo: Respostas = {};
  for (const bloco of BLOCOS) {
    for (const p of perguntasDoBloco(bloco, r, ctx)) {
      const v = texto(r, p.id);
      if (p.tipo === "marcar") {
        const m = marcas(r, p.id);
        if (m.length) limpo[`${p.id}.marcas`] = m;
        continue;
      }
      if (p.tipo === "simnao" && ![SIM, NAO, NAO_SEI].includes(v)) continue;
      if (p.tipo === "escolha" && !(p.opcoes ?? []).some((o) => o.id === v)) continue;
      if (!v) continue;
      limpo[p.id] = v.slice(0, 600);
      if (detalheAberto(p, r)) {
        const m = marcas(r, p.id);
        if (m.length) limpo[`${p.id}.marcas`] = m;
        const t = texto(r, `${p.id}.texto`);
        if (t) limpo[`${p.id}.texto`] = t.slice(0, 600);
      }
    }
  }
  return limpo;
}

// ── Da resposta do paciente para o campo da avaliação ──────────────────────

const NA_FICHA: Record<string, string> = { [SIM]: "Sim", [NAO]: "Não", [NAO_SEI]: "Não sabe" };

/** O que o paciente marcou, na língua da ficha: o botão quando existe, o texto dele quando não. */
function detalheNaFicha(r: Respostas, id: string, extra: string[] = []): string {
  const opcoes = POR_ID.get(id)?.opcoes ?? [];
  const partes = marcas(r, id).map((m) => {
    const o = opcoes.find((x) => x.id === m)!;
    return o.ficha ?? o.texto.toLowerCase();
  });
  const livre = texto(r, `${id}.texto`);
  return [...partes, ...extra, ...(livre ? [livre] : [])].join(", ");
}

/** Número digitado do jeito do paciente: "1,65" de altura vira 165. */
export function lerMedida(valor: string, unidade: "kg" | "cm"): string {
  const limpo = String(valor ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  let n = Number(limpo);
  if (!limpo || !Number.isFinite(n) || n <= 0) return "";
  if (unidade === "cm" && n < 3) n = n * 100;
  n = Math.round(n * 10) / 10;
  const [min, max] = unidade === "kg" ? [1, 350] : [30, 250];
  return n >= min && n <= max ? String(n) : "";
}

const ESCADA: Record<string, string> = { sim: "4–10 METs", cansa: "< 4 METs", outro: "Não avaliável" };
const ANESTESIA_CURTA: Record<string, string> = {
  geral: "geral", raqui: "raqui/peridural", sedacao: "sedação", local: "local", naosei: "não sabe",
};

/**
 * O que as respostas preenchem na avaliação. Só campo vazio: o que o médico
 * já escreveu, ou desmarcou de propósito, fica como está.
 */
export function respostasParaAvaliacao(
  r: Respostas,
  atuais: Record<string, unknown>,
): { campos: Record<string, string | boolean>; trazidos: string[] } {
  const campos: Record<string, string | boolean> = {};
  const vazio = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
  const recusados = String(atuais.escores_recusados ?? "").split(",");
  const por = (campo: string, valor: string | boolean | undefined) => {
    if (valor === undefined || valor === "" || !vazio(atuais[campo])) return;
    if (typeof valor === "boolean" && recusados.includes(campo)) return;
    campos[campo] = valor;
  };
  const simnao = (id: string) => NA_FICHA[texto(r, id)];
  /**
   * O detalhe só entra junto de um "Sim" na ficha. Com o "Não" do médico, a
   * tela esconde o detalhe e a impressão não o lê: entraria escondido e
   * contradizendo a resposta.
   */
  const fichaDizSim = (campo: string) => (campo in campos ? campos[campo] : atuais[campo]) === "Sim";
  /** Pergunta da anamnese: resposta e, com "Sim", o detalhe. */
  const anamnese = (campo: string, id: string, extra: string[] = []) => {
    const resposta = simnao(id);
    por(campo, resposta);
    if (resposta === "Sim" && fichaDizSim(campo)) por(`${campo}_detalhes`, detalheNaFicha(r, id, extra));
  };

  por("peso", lerMedida(texto(r, "peso"), "kg"));
  por("altura", lerMedida(texto(r, "altura"), "cm"));
  por("cirurgia", texto(r, "cirurgia"));
  por("cirurgiao", texto(r, "cirurgiao"));

  // Cirurgias anteriores: o que foi feito e a anestesia, nos dois campos dela.
  por("cirurgias_anteriores", simnao("cirurgias"));
  if (r.cirurgias === SIM && fichaDizSim("cirurgias_anteriores")) {
    por("cirurgias_anteriores_cirurgia", texto(r, "cirurgias.texto"));
    por("cirurgias_anteriores_anestesia", marcas(r, "anestesias").map((m) => ANESTESIA_CURTA[m]).join(", "));
  }

  // A pergunta da ficha junta o próprio paciente e a família.
  const prob = texto(r, "problema"), fam = texto(r, "familia");
  const reacao = prob === SIM || fam === SIM ? "Sim"
    : prob === NAO && fam === NAO ? "Não"
    : prob || fam ? "Não sabe" : undefined;
  por("reacao_anestesica", reacao);
  if (reacao === "Sim" && fichaDizSim("reacao_anestesica")) {
    const daFamilia = fam === SIM ? [`família: ${texto(r, "familia.texto") || "caso grave com anestesia"}`] : [];
    const doPaciente = prob === SIM ? detalheNaFicha(r, "problema") : "";
    por("reacao_anestesica_detalhes", [doPaciente, ...daFamilia].filter(Boolean).join(", "));
  }

  anamnese("cardiovascular", "coracao", r.esforco === SIM ? ["dor no peito ou falta de ar ao esforço"] : []);
  anamnese("respiratoria", "pulmao");
  if (r.pulmao === SIM && fichaDizSim("respiratoria")) por("respiratoria_ultima_crise", texto(r, "crise"));
  anamnese("diabetes", "diabetes");
  anamnese("neurologica", "neuro");
  anamnese("outras_doencas", "outras");
  anamnese("doenca_aguda", "aguda");
  anamnese("glaucoma", "glaucoma");
  anamnese("habitos", "habitos");
  anamnese("dentaria", "dentes");
  anamnese("alergias", "alergia");

  if (r.gravidez === SIM) {
    por("gestacao", "Sim");
    if (fichaDizSim("gestacao")) por("gestacao_idade_gestacional", texto(r, "semanas"));
  } else if (r.gravidez === NAO) por("gestacao", "Não");

  por("capacidade_funcional", ESCADA[texto(r, "escada")]);

  // Os remédios: só a resposta. Nome, dose e foto ficam para o médico.
  por("medicacao_continua", simnao("remedios"));
  por("anticoagulante", simnao("sangue"));
  por("glp1", simnao("caneta"));
  if (r.caneta === SIM && fichaDizSim("glp1") && /^\d{4}-\d{2}-\d{2}$/.test(texto(r, "caneta_dia"))) por("glp1_ultima_dose", texto(r, "caneta_dia"));

  // Escores: o paciente responde três do STOP-Bang e dois do Apfel. Só liga
  // o critério; o "não" deixa o campo como o médico decidir.
  if (r.ronco === SIM) por("stop_ronco", true);
  if (r.sono === SIM) por("stop_cansaco", true);
  if (r.parada === SIM) por("stop_apneia", true);
  if (r.coracao === SIM && marcas(r, "coracao").includes("pressao")) por("stop_has", true);
  if (r.viagem === SIM || (r.problema === SIM && marcas(r, "problema").includes("enjoo"))) por("apfel_historia", true);

  return { campos, trazidos: Object.keys(campos) };
}

// ── O que o médico precisa ver primeiro ────────────────────────────────────

export type Alerta = { texto: string; grave: boolean };

const nomes = (r: Respostas, id: string) => {
  const opcoes = POR_ID.get(id)?.opcoes ?? [];
  const lista = marcas(r, id).map((m) => opcoes.find((o) => o.id === m)!.texto);
  const livre = texto(r, `${id}.texto`);
  return [...lista, ...(livre ? [livre] : [])].join(", ");
};

export function alertasDoQuestionario(r: Respostas): Alerta[] {
  const a: Alerta[] = [];
  const com = (base: string, extra: string) => (extra ? `${base}: ${extra}` : base);
  if (r.problema === SIM && marcas(r, "problema").includes("febre"))
    a.push({ texto: "Febre muito alta em anestesia anterior: investigar hipertermia maligna.", grave: true });
  if (r.familia === SIM)
    a.push({ texto: com("Problema grave com anestesia na família", texto(r, "familia.texto")), grave: true });
  if (r.problema === SIM && marcas(r, "problema").includes("tubo"))
    a.push({ texto: "Relata intubação difícil em anestesia anterior.", grave: true });
  if (r.alergia === SIM) a.push({ texto: com("Alergia", nomes(r, "alergia")), grave: true });
  if (r.sangue === SIM) a.push({ texto: com("Anticoagulante ou antiagregante", nomes(r, "sangue")) + ". Confirmar a última dose.", grave: true });
  if (r.caneta === SIM) {
    const dia = texto(r, "caneta_dia");
    const quando = /^\d{4}-\d{2}-\d{2}$/.test(dia) ? ` Última dose em ${dia.split("-").reverse().join("/")}.` : " Sem a data da última dose.";
    a.push({ texto: com("Remédio para emagrecer (GLP-1)", texto(r, "caneta.texto")) + "." + quando, grave: true });
  }
  if (r.esforco === SIM) a.push({ texto: "Dor no peito ou falta de ar ao esforço.", grave: true });
  if (r.gravidez === SIM) a.push({ texto: com("Gestante", texto(r, "semanas") && `${texto(r, "semanas")} semanas`), grave: true });
  if (r.gravidez === NAO_SEI) a.push({ texto: "Não sabe se está grávida: confirmar.", grave: true });
  if (r.aguda === SIM) a.push({ texto: com("Doença aguda nas últimas 2 semanas", nomes(r, "aguda")), grave: false });
  if (r.diabetes === SIM && marcas(r, "diabetes").includes("hipo")) a.push({ texto: "Hipoglicemia nos últimos meses.", grave: false });
  if (r.outras === SIM && marcas(r, "outras").includes("dialise")) a.push({ texto: "Faz diálise: perguntar o dia da última sessão.", grave: false });
  if (r.coracao === SIM && marcas(r, "coracao").includes("marcapasso")) a.push({ texto: "Usa marca-passo.", grave: false });
  return a;
}

// ── As respostas como o paciente deu, para o médico ler ────────────────────

export type ItemDoResumo = { pergunta: string; resposta: string };

const RESPOSTA_LIDA: Record<string, string> = { [SIM]: "Sim", [NAO]: "Não", [NAO_SEI]: "Não sei" };

export function resumoDasRespostas(r: Respostas, ctx: Contexto): { titulo: string; itens: ItemDoResumo[] }[] {
  return BLOCOS.map((bloco) => ({
    titulo: bloco.titulo,
    itens: perguntasDoBloco(bloco, r, ctx).flatMap((p): ItemDoResumo[] => {
      const v = texto(r, p.id);
      let resposta = "";
      if (p.tipo === "marcar") resposta = nomes(r, p.id);
      else if (p.tipo === "simnao") resposta = [RESPOSTA_LIDA[v], v === SIM ? nomes(r, p.id) : ""].filter(Boolean).join(" — ");
      else if (p.tipo === "escolha") {
        const o = p.opcoes?.find((x) => x.id === v)?.texto ?? "";
        resposta = [o, texto(r, `${p.id}.texto`)].filter(Boolean).join(" — ");
      } else if (p.tipo === "data") resposta = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split("-").reverse().join("/") : v;
      else if (p.tipo === "numero" && v) {
        // O valor que vai para a ficha, e o que o paciente escreveu quando difere ("1,63" de altura).
        const lido = lerMedida(v, p.unidade === "kg" ? "kg" : "cm");
        const escrito = v.replace(".", ",");
        resposta = lido
          ? `${lido.replace(".", ",")} ${p.unidade}${lido.replace(".", ",") === escrito ? "" : ` (escreveu ${escrito})`}`
          : `${escrito} (fora da faixa: confirmar)`;
      }
      else resposta = v;
      return resposta ? [{ pergunta: p.texto, resposta }] : [];
    }),
  })).filter((b) => b.itens.length > 0);
}

export function quemRespondeu(r: Respostas): string {
  if (r.quem === "familiar") return `Familiar${texto(r, "quem.texto") ? `: ${texto(r, "quem.texto")}` : ""}`;
  if (r.quem === "paciente") return "O próprio paciente";
  return "";
}

// ── A mensagem do WhatsApp ─────────────────────────────────────────────────

export const linkDoQuestionario = (origem: string, token: string) => `${origem}/q/${token}`;

export function primeiroNome(nome: string | null | undefined): string {
  const p = String(nome ?? "").trim().split(/\s+/)[0] ?? "";
  return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : "";
}

/** "INOVANEST — Serviço de Anestesiologia…" vira "INOVANEST", para a assinatura. */
export function nomeCurtoDaOrganizacao(organizacao: string | null | undefined): string {
  return String(organizacao ?? "").split(/\s+[—–-]\s+/)[0].trim();
}

/**
 * O texto do Dr. Gustavo (10/11/2026). Negrito do WhatsApp é com UM asterisco
 * de cada lado: com dois, os asteriscos aparecem na mensagem.
 */
export function mensagemDoQuestionario(
  { paciente, organizacao, link, validade }: { paciente: string; organizacao: string | null; link: string; validade: string },
): string {
  const nome = primeiroNome(paciente);
  const ate = new Date(validade).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const org = String(organizacao ?? "").trim();
  const curto = nomeCurtoDaOrganizacao(org);
  return [
    `Olá${nome ? `, ${nome}` : ""}! 👋`,
    "",
    org ? `Somos da *${org}*.` : "Somos da equipe de anestesia.",
    "",
    "Antes da sua consulta pré-anestésica, pedimos que responda a um breve questionário sobre sua saúde. Isso ajudará a tornar sua avaliação mais ágil e segura.",
    "",
    "⏱️ *Tempo estimado: menos de 10 minutos.*",
    "",
    "📱 Você pode interromper e continuar depois no mesmo celular.",
    "",
    "*Acesse seu questionário:*",
    link,
    "",
    `🔒 Link pessoal e exclusivo, válido até ${ate}.`,
    "",
    curto ? `*${curto} | Sua segurança é nossa prioridade.*` : "*Sua segurança é nossa prioridade.*",
  ].join("\n");
}

/** wa.me com o número do paciente; sem número, o WhatsApp pede o contato. */
export function whatsappDoPaciente(telefone: string | null | undefined, mensagem: string): string {
  let d = String(telefone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  const numero = /^55\d{10,11}$/.test(d) ? d : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

// ── A situação, para a recepção (sem o conteúdo) ───────────────────────────

export type Situacao = "enviado" | "aberto" | "incompleto" | "respondido" | "vencido";

export const NOME_DA_SITUACAO: Record<Situacao, string> = {
  enviado: "Questionário enviado",
  aberto: "Questionário aberto",
  incompleto: "Questionário incompleto",
  respondido: "Questionário respondido",
  vencido: "Questionário vencido",
};
