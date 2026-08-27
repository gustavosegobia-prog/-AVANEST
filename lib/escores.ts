// Os escores de risco, num lugar só.
//
// Eles nasceram escritos à mão dentro do formulário de avaliação. Enquanto só
// aquela tela os usava, tudo bem. Agora as páginas públicas mostram os mesmos
// escores para quem chega do Google, e duas cópias do mesmo critério é uma
// divergência esperando acontecer: alguém corrige o ponto de corte do STOP-Bang
// numa tela e a outra segue devolvendo o número velho — sem erro, sem aviso, e
// com a autoridade de estar impresso.
//
// Aqui ficam SÓ os critérios e a leitura do total. O preenchimento automático a
// partir da anamnese continua no formulário, porque depende do prontuário, e a
// página pública não tem prontuário nenhum: quem entra ali marca na mão.
//
// As faixas e as taxas são as das publicações originais. Trocá-las por outra
// coorte mudaria o número que o anestesiologista lê ao lado da classe, então
// elas não se ajustam "para arredondar melhor".

/** Chave interna (a mesma gravada na avaliação) e o rótulo lido na tela. */
export type Criterio = [chave: string, rotulo: string];

// ── Índice de Lee (RCRI) ────────────────────────────────────────────────────
// Lee TH et al., Circulation 1999.

export const RCRI_CRITERIOS: Criterio[] = [
  ["rcri_alto_risco", "Cirurgia de alto risco"],
  ["rcri_coronaria", "Doença arterial coronariana"],
  ["rcri_ic", "Insuficiência cardíaca"],
  ["rcri_cerebrovascular", "Doença cerebrovascular (AVC/AIT)"],
  ["rcri_insulina", "Diabetes em uso de insulina"],
  ["rcri_creatinina", "Creatinina > 2,0 mg/dL"],
];

export const LEE_CLASSES = ["I", "II", "III", "IV"];
// Taxas de evento cardíaco maior da derivação original. São as que acompanham o
// índice na literatura.
export const LEE_RISCO = ["0,4%", "0,9%", "6,6%", "11%"];

/**
 * A classe e o risco para um total do RCRI.
 *
 * Quatro classes para sete totais possíveis: de 3 pontos em diante tudo cai na
 * classe IV, que é como o índice foi publicado — a coorte original não separou
 * 3 de 6, e inventar uma quinta faixa aqui daria a um número um respaldo que
 * ele não tem.
 */
export function lerLee(pontos: number) {
  const faixa = Math.min(Math.max(pontos, 0), 3);
  return { classe: LEE_CLASSES[faixa], risco: LEE_RISCO[faixa] };
}

// ── STOP-Bang (apneia obstrutiva do sono) ───────────────────────────────────
// Chung F et al., Anesthesiology 2008.

export const STOP_BANG_CRITERIOS: Criterio[] = [
  ["stop_ronco", "Ronco alto"],
  ["stop_cansaco", "Cansaço/sonolência diurna"],
  ["stop_apneia", "Apneia observada"],
  ["stop_has", "Hipertensão arterial"],
  ["stop_pescoco", "Circunf. cervical > 40 cm"],
  ["stop_imc", "IMC > 35"],
  ["stop_idade", "Idade > 50"],
  ["stop_masculino", "Sexo masculino"],
];

/** Baixo até 2, intermediário de 3 a 4, alto de 5 em diante. */
export function lerStopBang(pontos: number) {
  if (pontos <= 2) return "baixo risco";
  if (pontos <= 4) return "risco intermediário";
  return "alto risco";
}

// ── Apfel (náusea e vômito no pós-operatório) ───────────────────────────────
// Apfel CC et al., Anesthesiology 1999.

export const APFEL_CRITERIOS: Criterio[] = [
  ["apfel_historia", "História de NVPO ou cinetose"],
  ["apfel_opioide", "Opioides pós-operatórios previstos"],
  ["apfel_feminino", "Sexo feminino"],
  ["apfel_nao_tabagista", "Não tabagista"],
];

const APFEL_RISCO = ["≈ 10%", "≈ 21%", "≈ 39%", "≈ 61%", "≈ 79%"];

/** A incidência esperada de NVPO para 0 a 4 fatores. */
export function lerApfel(pontos: number) {
  return APFEL_RISCO[Math.min(Math.max(pontos, 0), 4)];
}

// ── Classificação ASA ───────────────────────────────────────────────────────
//
// Não é escore somado: é uma classificação escolhida pelo médico. Está aqui
// junto porque é a mesma pergunta que traz o colega ao site, e porque o rótulo
// "ASA I" precisa dizer a mesma coisa nas duas telas.
//
// Os exemplos são os da própria ASA. Eles não são regra — a classificação é
// clínica —, mas sem eles a definição vira abstração e cada um classifica de um
// jeito.

export type ClasseASA = { classe: string; definicao: string; exemplos: string };

export const ASA_CLASSES: ClasseASA[] = [
  { classe: "ASA I", definicao: "Paciente saudável",
    exemplos: "Sem doença. Não fumante, sem consumo ou consumo mínimo de álcool." },
  { classe: "ASA II", definicao: "Doença sistêmica leve",
    exemplos: "Sem limitação funcional. Fumante, etilista social, gestante, obesidade "
      + "(IMC 30–40), diabetes ou hipertensão controlados, doença pulmonar leve." },
  { classe: "ASA III", definicao: "Doença sistêmica grave",
    exemplos: "Com limitação funcional. Diabetes ou hipertensão mal controlados, DPOC, "
      + "obesidade mórbida (IMC ≥ 40), hepatite ativa, marca-passo, fração de ejeção "
      + "reduzida, infarto ou AVC há mais de 3 meses." },
  { classe: "ASA IV", definicao: "Doença sistêmica grave que é ameaça constante à vida",
    exemplos: "Infarto ou AVC há menos de 3 meses, isquemia miocárdica em curso, "
      + "disfunção valvar grave, sepse, insuficiência renal em diálise irregular." },
  { classe: "ASA V", definicao: "Moribundo, sem expectativa de sobrevida sem a cirurgia",
    exemplos: "Aneurisma roto, trauma extenso, hemorragia intracraniana com efeito de massa, "
      + "isquemia intestinal com disfunção de múltiplos órgãos." },
  { classe: "ASA VI", definicao: "Morte encefálica declarada, para doação de órgãos",
    exemplos: "Doador em protocolo de captação." },
];

/**
 * O "E" de emergência.
 *
 * Sufixo, e não uma sétima classe: um ASA II operado de urgência continua sendo
 * ASA II, e o que muda é o contexto. Somar não é opção — o "E" não vira ASA III.
 */
export const ASA_EMERGENCIA =
  "Acrescente E quando o adiamento aumentaria significativamente a ameaça à vida "
  + "ou a um membro. O E não muda a classe: um ASA II operado de urgência é ASA IIE.";
