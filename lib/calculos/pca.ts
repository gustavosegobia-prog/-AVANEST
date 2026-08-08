/**
 * Analgesia controlada pelo paciente (PCA/ACP).
 *
 * Este arquivo é uma transcrição de fonte, não uma tabela do serviço. Cada
 * número aqui tem obra e página anotadas ao lado, e o que as fontes não
 * afirmam fica ausente — nunca zero, nunca média entre livros, nunca um valor
 * "típico" inventado para preencher a tela.
 *
 * Fontes:
 *   SAESP, Tratado de Anestesiologia — capítulos de dor aguda, ACP e obesidade.
 *   Miller, Bases da Anestesia, 7ª ed. (2019) — farmacologia de opioides e cap. 40.
 *
 * Três camadas que o módulo nunca mistura:
 *   1. dose sistêmica  — é do paciente, não da bomba;
 *   2. diretriz de PCA publicada — é do livro, não do serviço;
 *   3. protocolo institucional validado — é o único que prescreve, e não está aqui.
 *
 * A regra que sustenta o arquivo inteiro: dose sistêmica não vira dose de
 * demanda por multiplicação. Quem quiser essa conversão precisa de protocolo
 * local; o código não a faz, e é de propósito.
 */

export type Fonte = { obra: string; local: string };

export const SAESP = (pagina: string): Fonte => ({ obra: "SAESP, Tratado de Anestesiologia", local: pagina });
export const MILLER = (pagina: string): Fonte => ({ obra: "Miller, Bases da Anestesia, 7ª ed.", local: pagina });

export const citar = (f: Fonte) => `${f.obra} — ${f.local}`;

/** Faixa publicada. Quando a fonte dá um número só, min e max coincidem. */
export type Faixa = { min: number; max: number };

export const escreverFaixa = (f: Faixa, unidade: string) =>
  f.min === f.max ? `${virgula(f.min)} ${unidade}` : `${virgula(f.min)}–${virgula(f.max)} ${unidade}`;

/** Português escreve 0,5 e não 0.5. A tela toda passa por aqui. */
export function virgula(v: number): string {
  return String(v).replace(".", ",");
}

/* ------------------------------------------------------------------ *
 * Camada 1 — doses sistêmicas do SAESP (PDF p. 3077).
 *
 * Estão aqui para consulta e porque via e modalidade fazem parte do dado.
 * Não alimentam nenhum campo de programação de bomba.
 * ------------------------------------------------------------------ */

export type DoseSistemica = {
  farmaco: string;
  /** Como impressa na fonte, com unidade e periodicidade. */
  dose: string;
  via: string;
  /** Para a conta por peso, quando a fonte publicou a dose por quilo. */
  porKg?: { min: number; max: number; unidade: string };
  fonte: Fonte;
};

export const DOSES_SISTEMICAS: DoseSistemica[] = [
  {
    farmaco: "Morfina", dose: "0,15 mg/kg a cada 3–4 h", via: "EV, bolo",
    porKg: { min: 0.15, max: 0.15, unidade: "mg" }, fonte: SAESP("PDF p. 3077"),
  },
  {
    farmaco: "Morfina", dose: "0,03–0,1 mg/kg/h", via: "EV, infusão contínua",
    porKg: { min: 0.03, max: 0.1, unidade: "mg/h" }, fonte: SAESP("PDF p. 3077"),
  },
  {
    farmaco: "Fentanil", dose: "dose inicial 0,8–1,6 µg/kg", via: "EV, infusão contínua (assim rotulado na tabela)",
    porKg: { min: 0.8, max: 1.6, unidade: "µg" }, fonte: SAESP("PDF p. 3077"),
  },
  {
    farmaco: "Fentanil", dose: "0,3–1,6 µg/kg/h", via: "EV, infusão contínua",
    porKg: { min: 0.3, max: 1.6, unidade: "µg/h" }, fonte: SAESP("PDF p. 3077"),
  },
  {
    farmaco: "Sufentanil", dose: "0,15–0,3 µg/kg/h", via: "Peridural, infusão contínua",
    porKg: { min: 0.15, max: 0.3, unidade: "µg/h" }, fonte: SAESP("PDF p. 3077"),
  },
];

export const AVISO_SISTEMICAS =
  "Doses sistêmicas do SAESP. Não são, por si, programação de PCA: unidade, via e modalidade fazem parte inseparável do dado.";

/**
 * Multiplica a dose publicada pelo peso. Só isso — é a leitura literal de
 * "mg/kg", e não uma conversão para dose de demanda.
 */
export function porPeso(d: DoseSistemica, pesoKg: number): string | undefined {
  if (!d.porKg || !Number.isFinite(pesoKg) || pesoKg <= 0) return undefined;
  const arredonda = (v: number) => Math.round(v * pesoKg * 100) / 100;
  const min = arredonda(d.porKg.min), max = arredonda(d.porKg.max);
  return min === max ? `${virgula(min)} ${d.porKg.unidade}` : `${virgula(min)}–${virgula(max)} ${d.porKg.unidade}`;
}

/* ------------------------------------------------------------------ *
 * Camada 2 — diretrizes de PCA publicadas.
 *
 * Miller, PDF p. 1167: tabela de adulto de 70 kg. SAESP, PDF p. 3078:
 * recomendação geral, sem faixa numérica de demanda.
 * ------------------------------------------------------------------ */

export type FarmacoId = "morfina" | "fentanil" | "hidromorfona" | "sufentanil";

export type Diretriz = {
  populacao: string;
  concentracao: string;
  demanda?: Faixa;
  lockoutMin?: Faixa;
  basal?: Faixa;
  fonte: Fonte;
};

export type Farmaco = {
  id: FarmacoId;
  nome: string;
  /** Unidade da dose de demanda e do bolo, como publicada. */
  unidadeDose: "mg" | "µg";
  /** Unidade da infusão contínua, como publicada. */
  unidadeBasal: "mg/h" | "µg/h";
  diretriz?: Diretriz;
  /** Texto do SAESP, atribuído, quando existir para o fármaco. */
  saesp?: { texto: string; fonte: Fonte };
};

export const FARMACOS: Farmaco[] = [
  {
    id: "morfina", nome: "Morfina", unidadeDose: "mg", unidadeBasal: "mg/h",
    diretriz: {
      populacao: "adulto de 70 kg", concentracao: "1 mg/mL",
      demanda: { min: 0.5, max: 2.5 }, lockoutMin: { min: 6, max: 10 }, basal: { min: 1, max: 2 },
      fonte: MILLER("PDF p. 1167"),
    },
    saesp: {
      texto: "Concentração citada de 1 mg/mL, com referência a 10 minutos. O capítulo afirma não haver vantagem rotineira na infusão basal.",
      fonte: SAESP("PDF p. 3078"),
    },
  },
  {
    id: "fentanil", nome: "Fentanil", unidadeDose: "µg", unidadeBasal: "µg/h",
    diretriz: {
      populacao: "adulto de 70 kg", concentracao: "0,01 mg/mL (10 µg/mL)",
      demanda: { min: 20, max: 50 }, lockoutMin: { min: 5, max: 10 }, basal: { min: 10, max: 100 },
      fonte: MILLER("PDF p. 1167"),
    },
    saesp: {
      texto: "Concentração citada de 10 µg/mL, com referência a 10 minutos. O capítulo afirma não haver vantagem rotineira na infusão basal.",
      fonte: SAESP("PDF p. 3078"),
    },
  },
  {
    id: "hidromorfona", nome: "Hidromorfona", unidadeDose: "mg", unidadeBasal: "mg/h",
    diretriz: {
      populacao: "adulto de 70 kg", concentracao: "0,2 mg/mL",
      demanda: { min: 0.05, max: 0.25 }, lockoutMin: { min: 10, max: 20 }, basal: { min: 0.2, max: 0.4 },
      fonte: MILLER("PDF p. 1167"),
    },
  },
  {
    id: "sufentanil", nome: "Sufentanil", unidadeDose: "µg", unidadeBasal: "µg/h",
    diretriz: {
      populacao: "adulto de 70 kg", concentracao: "0,002 mg/mL (2 µg/mL)",
      demanda: { min: 2, max: 5 }, lockoutMin: { min: 4, max: 10 }, basal: { min: 2, max: 8 },
      fonte: MILLER("PDF p. 1167"),
    },
  },
];

export const acharFarmaco = (id: FarmacoId) => FARMACOS.find((f) => f.id === id);

export const RESSALVA_BASAL =
  "Miller: infusões contínuas não são recomendadas para adultos virgens de opioide. As faixas da tabela são diretrizes publicadas, não prescrição automática.";

export const AVISO_DIRETRIZ =
  "Faixas publicadas para adulto de 70 kg. Não são o protocolo do seu serviço, e o AVANEST não preenche nenhum campo com elas.";

/* ------------------------------------------------------------------ *
 * Conferência: comparar o que o médico digitou com a faixa publicada.
 *
 * O módulo diz onde o valor caiu. Não diz qual valor usar, e nunca escreve
 * "ajuste para X" — a decisão continua sendo de quem prescreve.
 * ------------------------------------------------------------------ */

export type Situacao = "dentro" | "abaixo" | "acima" | "sem-faixa";

export type Conferencia = {
  campo: string;
  valor: number;
  unidade: string;
  situacao: Situacao;
  /** Faixa escrita por extenso, quando existir. */
  faixa?: string;
  fonte?: Fonte;
  texto: string;
};

function comparar(valor: number, faixa?: Faixa): Situacao {
  if (!faixa) return "sem-faixa";
  if (valor < faixa.min) return "abaixo";
  if (valor > faixa.max) return "acima";
  return "dentro";
}

export type Programacao = {
  demanda?: number;
  lockoutMin?: number;
  basal?: number;
  concentracao?: number;
  volumeTotal?: number;
  doseCarga?: number;
  limiteValor?: number;
  limiteJanelaH?: number;
};

const preenchido = (v?: number): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * A partir de que idade o lembrete de "doses menores em idosos" aparece.
 *
 * Este 65 é do AVANEST, não dos livros: as duas fontes falam em idoso sem
 * fixar corte. Fica isolado aqui, e o próprio texto do alerta avisa quem o
 * escolheu — um número meu não pode passar por número de fonte.
 */
export const IDADE_LEMBRETE = 65;

export function conferir(farmacoId: FarmacoId, p: Programacao): Conferencia[] {
  const f = acharFarmaco(farmacoId);
  const d = f?.diretriz;
  const saida: Conferencia[] = [];

  const linha = (campo: string, valor: number, unidade: string, faixa?: Faixa) => {
    const situacao = comparar(valor, faixa);
    const escrita = faixa ? escreverFaixa(faixa, unidade) : undefined;
    const texto =
      situacao === "sem-faixa"
        ? "Sem faixa publicada nas fontes deste guia. Exige protocolo institucional."
        : situacao === "dentro"
          ? `Dentro da faixa publicada (${escrita}, ${d?.populacao}).`
          : `${situacao === "acima" ? "Acima" : "Abaixo"} da faixa publicada (${escrita}, ${d?.populacao}). Confira contra o protocolo do serviço.`;
    saida.push({ campo, valor, unidade, situacao, faixa: escrita, fonte: faixa ? d?.fonte : undefined, texto });
  };

  if (preenchido(p.demanda)) linha("Dose de demanda", p.demanda, f?.unidadeDose ?? "", d?.demanda);
  if (preenchido(p.lockoutMin)) linha("Bloqueio (lockout)", p.lockoutMin, "min", d?.lockoutMin);
  if (preenchido(p.basal)) linha("Infusão basal", p.basal, f?.unidadeBasal ?? "", d?.basal);
  if (preenchido(p.doseCarga)) linha("Dose de carga", p.doseCarga, f?.unidadeDose ?? "", undefined);
  if (preenchido(p.limiteValor)) linha("Limite por janela", p.limiteValor, f?.unidadeDose ?? "", undefined);

  return saida;
}

/* ------------------------------------------------------------------ *
 * Aritmética da bomba.
 *
 * Nada aqui inventa dose: são contas sobre o que a própria pessoa digitou.
 * ------------------------------------------------------------------ */

export type Teto = {
  dosesPorHora: number;
  porDemanda: number;
  porBasal: number;
  total: number;
  unidade: string;
  aviso: string;
};

/**
 * Teto aritmético por hora: quantas vezes o bloqueio permite acionar, vezes a
 * dose de demanda, mais a basal.
 *
 * É o pior caso de um paciente que aperta o botão em todos os intervalos —
 * serve para enxergar o consumo máximo que a programação permite, e não para
 * sugerir que esse consumo seja esperado ou aceitável.
 */
export function tetoPorHora(farmacoId: FarmacoId, p: Programacao): Teto | undefined {
  const f = acharFarmaco(farmacoId);
  if (!preenchido(p.demanda) || !preenchido(p.lockoutMin) || p.lockoutMin <= 0) return undefined;

  const dosesPorHora = Math.floor(60 / p.lockoutMin);
  const arredonda = (v: number) => Math.round(v * 1000) / 1000;
  const porDemanda = arredonda(dosesPorHora * p.demanda);
  const porBasal = preenchido(p.basal) ? p.basal : 0;

  return {
    dosesPorHora, porDemanda, porBasal, total: arredonda(porDemanda + porBasal),
    unidade: `${f?.unidadeDose ?? ""}/h`,
    aviso: "Teto aritmético, se o paciente acionar em todos os bloqueios. Não é dose esperada nem limite de segurança — o limite por hora ou por 4 h é campo de protocolo institucional.",
  };
}

export type Preparo = { massa: number; volume: number; concentracao: number; unidade: string; texto: string };

/** Concentração = massa ÷ volume. A conta que se erra apressado na sala. */
export function prepararSolucao(farmacoId: FarmacoId, massa?: number, volume?: number): Preparo | undefined {
  const f = acharFarmaco(farmacoId);
  if (!preenchido(massa) || !preenchido(volume) || volume <= 0 || massa <= 0) return undefined;
  const concentracao = Math.round((massa / volume) * 1000) / 1000;
  const unidade = `${f?.unidadeDose ?? ""}/mL`;
  return {
    massa, volume, concentracao, unidade,
    texto: `${virgula(massa)} ${f?.unidadeDose ?? ""} em ${virgula(volume)} mL = ${virgula(concentracao)} ${unidade}`,
  };
}

/** Volume de um bolo, dada a concentração da solução montada. */
export function volumeDaDose(dose?: number, concentracao?: number): number | undefined {
  if (!preenchido(dose) || !preenchido(concentracao) || concentracao <= 0) return undefined;
  return Math.round((dose / concentracao) * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * Elegibilidade, risco e barreiras de segurança.
 * ------------------------------------------------------------------ */

export type Perfil = {
  idade?: number;
  pesoKg?: number;
  toleranteOpioide?: boolean;
  cognicaoAdequada?: boolean;
  compreendeDispositivo?: boolean;
  apneiaSono?: boolean;
  obesidade?: boolean;
  dpoc?: boolean;
  funcaoRenalAlterada?: boolean;
  sedativosConcomitantes?: boolean;
  opioideOutraVia?: boolean;
  acionamentoPorTerceiros?: boolean;
  /** "ideal" | "total" | undefined — o SAESP sustenta peso ideal no contexto do obeso. */
  tipoPeso?: "ideal" | "total";
};

export type Alerta = {
  gravidade: "critico" | "atencao" | "lembrete";
  titulo: string;
  texto: string;
  fonte?: Fonte;
};

/**
 * Todo alerta abaixo é uma frase de fonte, atribuída. Nenhum deles calcula
 * dose, propõe número ou manda alterar a bomba: eles dizem o que os livros
 * dizem, e param aí.
 */
export function alertas(farmacoId: FarmacoId, perfil: Perfil, p: Programacao): Alerta[] {
  const lista: Alerta[] = [];
  const temBasal = preenchido(p.basal) && p.basal > 0;

  if (perfil.cognicaoAdequada === false || perfil.compreendeDispositivo === false) {
    lista.push({
      gravidade: "critico", titulo: "Elegibilidade para PCA",
      texto: "Boa função cognitiva e compreensão do dispositivo são essenciais para a técnica. Sem isso, a autotitulação deixa de ser segura.",
      fonte: SAESP("PDF pp. 3093-3095"),
    });
  }

  if (perfil.acionamentoPorTerceiros) {
    lista.push({
      gravidade: "critico", titulo: "Acionamento por terceiros",
      texto: "O botão é exclusivo do paciente. Acionamento por familiares ou pela equipe aumenta o risco de depressão respiratória.",
      fonte: SAESP("PDF pp. 3093-3095"),
    });
  }

  if (temBasal && perfil.toleranteOpioide === false) {
    lista.push({
      gravidade: "critico", titulo: "Basal em paciente virgem de opioide",
      texto: "Infusão contínua não é recomendada para adultos virgens de opioide. Se for mantida, exige justificativa clínica documentada e monitorização compatível.",
      fonte: MILLER("PDF p. 1167"),
    });
  }

  if (temBasal && (perfil.apneiaSono || perfil.obesidade)) {
    lista.push({
      gravidade: "critico", titulo: "Basal em obesidade ou apneia do sono",
      texto: "Em obesos e na apneia obstrutiva do sono, o SAESP orienta evitar infusão basal e sedativos concomitantes, considerar redução da dose total e monitorização. Não há taxa alternativa universal nas fontes — o campo fica em branco por padrão.",
      fonte: SAESP("PDF p. 3093"),
    });
  }

  if (perfil.sedativosConcomitantes || perfil.opioideOutraVia) {
    lista.push({
      gravidade: "atencao", titulo: "Depressores associados",
      texto: "Sedativos ou opioides por outras vias elevam o risco de depressão respiratória e devem constar do plano de monitorização.",
      fonte: SAESP("PDF pp. 3093-3095"),
    });
  }

  if (perfil.funcaoRenalAlterada) {
    lista.push({
      gravidade: "atencao", titulo: "Função renal alterada",
      texto: "Há alerta para insuficiência renal e acúmulo de metabólitos, sem algoritmo numérico universal de ajuste de PCA. Registre o alerta; o ajuste não é calculado automaticamente.",
      fonte: SAESP("PDF pp. 3093-3095"),
    });
  }

  if (perfil.obesidade && farmacoId === "morfina" && !perfil.tipoPeso) {
    lista.push({
      gravidade: "atencao", titulo: "Tipo de peso não informado",
      texto: "Em PCA de morfina no paciente obeso, a referência orienta inserir o peso ideal para cálculo. Informe qual peso foi usado.",
      fonte: SAESP("PDF p. 4434"),
    });
  }

  if (preenchido(perfil.idade) && perfil.idade >= IDADE_LEMBRETE) {
    lista.push({
      gravidade: "atencao", titulo: "Idoso",
      texto: `As necessidades variam amplamente, e doses menores são típicas em idosos ou pacientes comprometidos. O corte de ${IDADE_LEMBRETE} anos que faz este lembrete aparecer é do AVANEST: as fontes falam em idoso sem fixar idade.`,
      fonte: MILLER("PDF p. 1167"),
    });
  }

  if (perfil.apneiaSono || perfil.dpoc) {
    lista.push({
      gravidade: "atencao", titulo: "Risco respiratório de base",
      texto: "Oximetria isolada não exclui hipoventilação, sobretudo com oxigênio suplementar. O Miller considera frequência respiratória e capnografia mais específicas, e reserva a capnografia especialmente a pacientes com comorbidades de risco.",
      fonte: MILLER("PDF p. 1164"),
    });
  }

  if (!preenchido(p.limiteValor) || !preenchido(p.limiteJanelaH)) {
    lista.push({
      gravidade: "lembrete", titulo: "Limite por hora ou por 4 h ausente",
      texto: "As fontes definem o conceito de limite, mas não fornecem um limite horário ou de 4 h por fármaco. Ele não pode ser derivado do bloqueio: exige valor e fonte próprios, do protocolo institucional.",
    });
  }

  return lista;
}

/* ------------------------------------------------------------------ *
 * Textos de referência — exibidos, nunca transformados em decisão.
 * ------------------------------------------------------------------ */

export const NAO_INFERIR: Array<{ campo: string; conduta: string }> = [
  { campo: "Limite máximo por hora ou por 4 h", conduta: "Nulo. Exige protocolo institucional versionado; não se deriva do bloqueio." },
  { campo: "PCA pediátrica", conduta: "As tabelas citadas são de adulto. Não extrapolar por kg — exige fonte pediátrica própria." },
  { campo: "Ajuste renal numérico", conduta: "Há alerta para insuficiência renal e metabólitos, sem algoritmo numérico universal. Registrar o alerta, não calcular." },
  { campo: "Basal em obesidade ou apneia do sono", conduta: "Recomendação de evitar, sem taxa alternativa universal. Ausente por padrão; exceção com justificativa e monitorização." },
  { campo: "Critérios universais de alarme", conduta: "As fontes discutem modalidades, sem limiares únicos para todos os pacientes. Vincular ao protocolo e à população." },
  { campo: "Conversão de dose sistêmica em demanda de PCA", conduta: "Não há autorização para converter automaticamente as doses sistêmicas do SAESP. Derivação bloqueada." },
  { campo: "Dose máxima de opioide forte", conduta: "O SAESP diz não haver máxima geral: eficácia e efeitos adversos orientam a titulação. Guardar o contexto, não criar teto universal." },
];

export const MONITORIZACAO: Array<{ dominio: string; registrar: string; alerta: string }> = [
  {
    dominio: "Consciência e sedação",
    registrar: "Escala institucional, tendência e capacidade de acionar a bomba.",
    alerta: "Sedação e sonolência podem anteceder ou acompanhar a toxicidade; o SAESP destaca o estado mental.",
  },
  {
    dominio: "Ventilação",
    registrar: "Frequência respiratória, padrão e esforço; capnografia quando indicada.",
    alerta: "Miller: frequência respiratória e capnografia são mais específicas; o oxigênio reduz a sensibilidade da oximetria.",
  },
  {
    dominio: "Oxigenação",
    registrar: "SpO2 e uso de O2 suplementar.",
    alerta: "SpO2 isolada não exclui hipoventilação, especialmente sob O2.",
  },
  {
    dominio: "Risco individual",
    registrar: "Apneia do sono, obesidade, DPOC, idade, instabilidade, função renal e tolerância a opioide.",
    alerta: "SAESP: infusão contínua, sedativos ou opioides adicionais, idade e instabilidade elevam o risco.",
  },
  {
    dominio: "Uso do dispositivo",
    registrar: "Paciente instruído; botão exclusivamente pelo paciente.",
    alerta: "PCA por procuração, acionada por familiar ou equipe, aumenta o risco.",
  },
  {
    dominio: "Sistema",
    registrar: "Concentração padronizada, biblioteca da bomba, dupla checagem e trilha de auditoria.",
    alerta: "Erros de programação ou de concentração podem causar doses altas inadvertidas.",
  },
];

export const REGISTRO_MULTIMODAL: string[] = [
  "Objetivo funcional e intensidade da dor em repouso e em movimento.",
  "Analgésicos não opioides e contraindicações relevantes.",
  "Técnica regional ou neuroaxial, quando houver, com vigilância específica.",
  "Consumo total de opioide e efeitos adversos ao longo do tempo.",
  "Plano de transição para via oral e critérios para retirada da PCA.",
];

/**
 * Divergência entre as fontes que o guia manda preservar. As duas ficam
 * atribuídas e datadas: achatá-las numa frase só criaria uma falsa
 * equivalência que nenhum dos dois livros afirma.
 */
export const DIVERGENCIA = {
  titulo: "Divergência entre as fontes, preservada de propósito",
  saesp: {
    texto: "O papel da oximetria e da capnografia ainda não foi estabelecido naquele conjunto de recomendações; mantém frequência respiratória e estado mental como padrão-ouro.",
    fonte: SAESP("PDF p. 3078"),
  },
  miller: {
    texto: "Capnografia e frequência respiratória são mais específicas que a oximetria, sobretudo com oxigênio suplementar.",
    fonte: MILLER("PDF p. 1164"),
  },
};

export const AVISO_MODULO =
  "Material de referência. A configuração da bomba exige prescrição individualizada, checagem independente, protocolo local, avaliação de comorbidades e monitorização compatível. Este módulo não é ordem médica.";

export const AVISO_MULTIMODAL =
  "O SAESP define analgesia multimodal como associação de fármacos com mecanismos diferentes, em doses menores, para melhorar o controle da dor e poupar opioides; AINEs, quando possíveis, reduzem consumo de opioides, náuseas, vômitos e sedação. A PCA entra num plano multimodal, não como módulo isolado.";

export const FONTE_MULTIMODAL = SAESP("PDF pp. 1094 e 3078-3095");
