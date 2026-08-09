/**
 * Correção dos distúrbios eletrolíticos — adulto.
 *
 * Transcrição do guia clínico AVANEST, que se apoia no SAESP e no Miller e usa
 * diretrizes especializadas apenas como conferência de segurança. Cada número
 * carrega obra e página; onde a fonte não define regime, o campo fica nulo e a
 * ausência é dita em voz alta.
 *
 * A trava que atravessa o arquivo inteiro: déficit estimado não vira dose.
 * Todas as funções abaixo devolvem estimativa rotulada como estimativa, e
 * nenhuma delas programa reposição — a fisiologia redistribui, a resposta real
 * diverge da prevista, e quem mede de novo é quem prescreve.
 */

export type Fonte = { obra: string; local: string };

export const SAESP = (p: string): Fonte => ({ obra: "SAESP, Tratado de Anestesiologia", local: p });
export const MILLER = (p: string): Fonte => ({ obra: "Miller, Bases da Anestesia, 7ª ed.", local: p });
export const EUROPEIA_HIPONATREMIA: Fonte = {
  obra: "Diretriz europeia de hiponatremia (ESICM/ESE/ERA-EDTA)",
  local: "conferência de segurança",
};
export const UK_HIPERCALEMIA: Fonte = {
  obra: "UK Kidney Association, Management of Hyperkalaemia in Adults",
  local: "atualização 2023",
};

export const citar = (f: Fonte) => `${f.obra} — ${f.local}`;

export const virgula = (v: number) => String(v).replace(".", ",");
const arred = (v: number, casas = 2) => Math.round(v * 10 ** casas) / 10 ** casas;
const ok = (v?: number): v is number => typeof v === "number" && Number.isFinite(v);

/* ------------------------------------------------------------------ *
 * Limiares citados.
 *
 * Separados das faixas de laboratório de propósito: estes têm fonte, as
 * faixas de referência do hemograma não têm e mudam de laboratório.
 * ------------------------------------------------------------------ */

export type Limiar = { valor: number; unidade: string; texto: string; fonte: Fonte };

export const LIMIARES: Record<string, Limiar> = {
  hiponatremia: {
    valor: 135, unidade: "mmol/L",
    texto: "Hiponatremia definida como Na abaixo de 135 mmol/L.",
    fonte: SAESP("PDF pp. 2442-2446"),
  },
  hiponatremiaSintomas: {
    valor: 125, unidade: "mmol/L",
    texto: "Sintomas neurológicos geralmente abaixo de 125 mmol/L.",
    fonte: SAESP("PDF pp. 2442-2446"),
  },
  hipernatremia: {
    valor: 145, unidade: "mmol/L",
    texto: "Hipernatremia definida como Na acima de 145 mmol/L. O objetivo descrito é 145 mmol/L, corrigindo causa, volume e perdas em paralelo.",
    fonte: SAESP("PDF pp. 2446-2448"),
  },
  hipocalemia: {
    valor: 3.5, unidade: "mmol/L",
    texto: "Hipocalemia definida como K abaixo de 3,5 mmol/L.",
    fonte: SAESP("PDF pp. 2450-2452"),
  },
  hipocalemiaTratar: {
    valor: 3.0, unidade: "mmol/L",
    texto: "Tratamento recomendado com K abaixo de 3,0 mmol/L ou na presença de sintomas.",
    fonte: SAESP("PDF pp. 2450-2452"),
  },
  hipercalcemiaEmergencia: {
    valor: 15, unidade: "mg/dL",
    texto: "Emergência hipercalcêmica acima de 15 mg/dL.",
    fonte: SAESP("PDF pp. 2450-2455"),
  },
  hipomagnesemia: {
    valor: 1.9, unidade: "mg/dL",
    texto: "Limiar citado para repor magnésio na hipocalemia refratária. A fonte não fornece regime geral de reposição.",
    fonte: SAESP("PDF pp. 2450-2452"),
  },
};

/* ------------------------------------------------------------------ *
 * Sódio — variação prevista por solução.
 *
 * ΔNa por litro = (Na da solução − Na sérico) ÷ (ACT + 1).
 *
 * O "+1" existe na figura 95.12 e some no texto corrido da mesma página. A
 * implementação segue a figura, e a divergência editorial fica registrada na
 * tela: esconder isso seria escolher por quem lê, num ponto em que a fonte
 * não é unânime consigo mesma.
 * ------------------------------------------------------------------ */

export type FaixaEtaria = "jovem" | "idoso";

/** Água corporal total como fração do peso. */
export const FATOR_ACT: Record<FaixaEtaria, number> = { jovem: 0.6, idoso: 0.5 };

export const DISCREPANCIA_ACT =
  "A figura 95.12 do SAESP inclui o “+1” no denominador; o texto corrido da mesma página o omite. O AVANEST usa a fórmula da figura e registra a divergência.";

export type Solucao = { id: string; nome: string; sodio: number; fonte?: Fonte };

/**
 * Só as duas soluções cujo sódio a fonte declara. As demais que o capítulo
 * cita — salina 0,2% e 0,45% — aparecem sem número lá, então aqui o sódio é
 * digitado. Preencher por conta própria transformaria rótulo comercial em
 * dado de origem.
 */
export const SOLUCOES: Solucao[] = [
  { id: "nacl3", nome: "NaCl 3%", sodio: 513, fonte: SAESP("PDF pp. 2442-2446") },
  { id: "glicose5", nome: "Glicose 5%", sodio: 0, fonte: SAESP("PDF pp. 2446-2448") },
  { id: "outra", nome: "Outra — informar o sódio", sodio: Number.NaN },
];

export type VariacaoSodio = {
  act: number;
  deltaPorLitro: number;
  deltaNoVolume?: number;
  volumeL?: number;
  formula: string;
  aviso: string;
};

export function variacaoSodio(e: {
  naSerico?: number; naSolucao?: number; pesoKg?: number;
  faixaEtaria?: FaixaEtaria; volumeMl?: number;
}): VariacaoSodio | undefined {
  const { naSerico, naSolucao, pesoKg } = e;
  if (!ok(naSerico) || !ok(naSolucao) || !ok(pesoKg) || pesoKg <= 0) return undefined;

  const act = arred(FATOR_ACT[e.faixaEtaria ?? "jovem"] * pesoKg, 1);
  const deltaPorLitro = arred((naSolucao - naSerico) / (act + 1), 2);
  const volumeL = ok(e.volumeMl) && e.volumeMl > 0 ? arred(e.volumeMl / 1000, 3) : undefined;

  return {
    act, deltaPorLitro,
    volumeL,
    deltaNoVolume: volumeL !== undefined ? arred(deltaPorLitro * volumeL, 2) : undefined,
    formula: "ΔNa por 1 L = (Na da solução − Na sérico) ÷ (ACT + 1)",
    aviso: "Previsão inicial. A resposta real pode ser maior ou menor: repita o sódio, observe a diurese e não programe todo o déficit estimado de uma vez.",
  };
}

export type LimiteSodio = { rotulo: string; texto: string; fonte: Fonte };

export const LIMITES_HIPONATREMIA: LimiteSodio[] = [
  {
    rotulo: "Grave ou sintomática",
    texto: "Reposição salina. A tabela cita 1 mmol/L/h nas 3 primeiras horas e 0,5 mmol/L/h depois, sem exceder 8 a 10 mmol/L em 24 h.",
    fonte: SAESP("PDF pp. 2442-2446"),
  },
  {
    rotulo: "Conferência de segurança",
    texto: "150 mL de NaCl 3% em 20 min, repetindo sob dosagem até subir 5 mmol/L; limite de 10 mmol/L em 24 h e 8 mmol/L nas 24 h seguintes.",
    fonte: EUROPEIA_HIPONATREMIA,
  },
  {
    rotulo: "Risco de desmielinização",
    texto: "Desnutrição, hepatopatia e déficit de potássio elevam o risco. A fórmula não substitui medidas seriadas, e a sobrecorreção é frequente.",
    fonte: SAESP("PDF pp. 2442-2446"),
  },
];

export const LIMITES_HIPERNATREMIA: LimiteSodio[] = [
  {
    rotulo: "Instalada em poucas horas",
    texto: "Redução de 1 mmol/L/h descrita como adequada.",
    fonte: SAESP("PDF pp. 2446-2448"),
  },
  {
    rotulo: "Crônica ou de duração desconhecida",
    texto: "0,5 mmol/L/h, sem exceder queda de 10 mmol/L nas primeiras 24 h.",
    fonte: SAESP("PDF pp. 2446-2448"),
  },
];

export const SEM_DEFICIT_AGUA_LIVRE =
  "O SAESP não apresenta, no trecho, uma fórmula separada de déficit de água livre. O AVANEST calcula apenas a variação prevista por solução — outra fórmula só entra com fonte própria, versão e validação clínica.";

/** Teto de variação em 24 h, para conferir o que já foi acumulado. */
export const TETO_NA_24H = 10;
export const TETO_NA_24H_SEGUINTES = 8;

export function conferirVariacao24h(variacaoAcumulada?: number): string | undefined {
  if (!ok(variacaoAcumulada)) return undefined;
  const v = Math.abs(variacaoAcumulada);
  if (v >= TETO_NA_24H) {
    return `Variação de ${virgula(arred(v, 1))} mmol/L nas últimas 24 h: atingiu ou passou o teto de ${TETO_NA_24H} mmol/L citado pelas fontes.`;
  }
  if (v >= 8) {
    return `Variação de ${virgula(arred(v, 1))} mmol/L nas últimas 24 h: já está na faixa de 8 a 10 mmol/L que o SAESP dá como limite.`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Potássio
 * ------------------------------------------------------------------ */

/** Regra aproximada: queda de 0,3 mEq/L no sérico ≈ 100 mEq de déficit corporal. */
export const QUEDA_POR_100_MEQ = 0.3;
export const K_REFERENCIA_PADRAO = 4.0;

export type DeficitK = {
  diferenca: number;
  deficitAproximado: number;
  formula: string;
  aviso: string;
};

export function deficitPotassio(kAtual?: number, kReferencia = K_REFERENCIA_PADRAO): DeficitK | undefined {
  if (!ok(kAtual) || !ok(kReferencia) || kAtual >= kReferencia) return undefined;
  const diferenca = arred(kReferencia - kAtual, 2);
  return {
    diferenca,
    deficitAproximado: Math.round((diferenca / QUEDA_POR_100_MEQ) * 100),
    formula: `Déficit ≈ (K de referência − K atual) ÷ ${virgula(QUEDA_POR_100_MEQ)} × 100 mEq`,
    aviso: "Estimativa corporal, não ordem de administração. pH, insulina e beta-agonistas redistribuem potássio; reponha em frações, meça de novo, confira rim e diurese e corrija o magnésio.",
  };
}

export const KCL_191 = {
  rotulo: "KCl 19,1%",
  mEqPorMl: 2.5,
  nota: "1 mL = 2,5 mEq. Não diluir em glicose.",
  fonte: SAESP("PDF pp. 2450-2452"),
};

export type Acesso = "periferico" | "central";

/** Concentração e velocidade máximas descritas na tabela da fonte, por acesso. */
export const LIMITES_K: Record<Acesso, { concentracao: number; velocidade: number; nota: string }> = {
  periferico: {
    concentracao: 40, velocidade: 20,
    nota: "Tabela: concentração abaixo de 40 mEq/L e velocidade abaixo de 20 mEq/h. O texto do capítulo descreve 40 a 60 mmol/L em 6 h por via periférica.",
  },
  central: {
    concentracao: 60, velocidade: 40,
    nota: "Tabela: concentração abaixo de 60 mEq/L e velocidade abaixo de 40 mEq/h, com solução mais concentrada, bomba e ECG.",
  },
};

export const ALTO_RISCO_K =
  "O texto menciona até 100 mmol/h diante de risco iminente de parada cardíaca. Esse valor não é opção do AVANEST e não deve virar regra de software: exige protocolo de ressuscitação, acesso central, ECG contínuo e supervisão especializada.";

export type InfusaoK = {
  concentracao: number;
  velocidade: number;
  volumeKclMl: number;
  alertas: string[];
  fonte: Fonte;
};

/**
 * Confere uma infusão que a pessoa montou: quanto de potássio, em quanto
 * volume, em quanto tempo. Devolve concentração e velocidade resultantes e
 * compara com os limites da tabela — não propõe o esquema.
 */
export function conferirInfusaoK(e: {
  mEq?: number; volumeMl?: number; horas?: number; acesso?: Acesso;
}): InfusaoK | undefined {
  const { mEq, volumeMl, horas } = e;
  if (!ok(mEq) || !ok(volumeMl) || !ok(horas) || volumeMl <= 0 || horas <= 0 || mEq <= 0) return undefined;

  const acesso = e.acesso ?? "periferico";
  const limite = LIMITES_K[acesso];
  const concentracao = arred((mEq / volumeMl) * 1000, 1);
  const velocidade = arred(mEq / horas, 1);
  const alertas: string[] = [];

  if (concentracao > limite.concentracao) {
    alertas.push(`Concentração de ${virgula(concentracao)} mEq/L acima do limite de ${limite.concentracao} mEq/L descrito para acesso ${acesso === "central" ? "central" : "periférico"}.`);
  }
  if (velocidade > limite.velocidade) {
    alertas.push(`Velocidade de ${virgula(velocidade)} mEq/h acima do limite de ${limite.velocidade} mEq/h descrito para acesso ${acesso === "central" ? "central" : "periférico"}.`);
  }

  return {
    concentracao, velocidade,
    volumeKclMl: arred(mEq / KCL_191.mEqPorMl, 1),
    alertas, fonte: SAESP("PDF pp. 2450-2452"),
  };
}

export const CONDUTA_K: Array<{ condicao: string; via: string; limite: string }> = [
  {
    condicao: "K entre 3,0 e 3,5 mmol/L",
    via: "KCl por via oral, quando possível.",
    limite: "Reavaliar causa e tendência.",
  },
  {
    condicao: "K abaixo de 3,0 mmol/L ou sintomático",
    via: "Via parenteral. KCl 19,1%, 1 mL = 2,5 mEq. Não diluir em glicose.",
    limite: "Periférico: concentração abaixo de 40 mEq/L, velocidade abaixo de 20 mEq/h.",
  },
  {
    condicao: "Acesso central disponível",
    via: "Solução mais concentrada, bomba de infusão e ECG.",
    limite: "Concentração abaixo de 60 mEq/L, velocidade abaixo de 40 mEq/h.",
  },
  {
    condicao: "Hipocalemia refratária",
    via: "Investigar hipomagnesemia.",
    limite: "A fonte cita reposição se Mg abaixo de 1,9 mg/dL, sem dar regime geral.",
  },
];

/* ------------------------------------------------------------------ *
 * Hipercalemia — estabilizar, deslocar, remover
 * ------------------------------------------------------------------ */

export type EtapaHiperK = {
  etapa: string;
  conduta: string;
  observacao: string;
};

export const HIPERCALEMIA: EtapaHiperK[] = [
  {
    etapa: "1. Estabilizar a membrana",
    conduta: "Gluconato de cálcio 10%: 10 mL IV lentamente em 2 a 3 min; repetir após 5 min se as alterações do ECG persistirem.",
    observacao: "Início em 1 a 3 min, duração de até 1 h. O cálcio não reduz o potássio. Cautela em uso de digitálico.",
  },
  {
    etapa: "2. Deslocar o potássio",
    conduta: "100 mL de glicose 50% com 10 UI de insulina regular, em 5 a 10 min.",
    observacao: "Glicose 50% = 0,5 g/mL, então 100 mL = 50 g, razão de 5 g por unidade. Monitorar a glicemia antes e depois.",
  },
  {
    etapa: "2. Se houver acidose",
    conduta: "Déficit de bicarbonato pela fórmula de Ash, corrigindo metade.",
    observacao: "Infusão descrita em 15 a 20 min. Contraindicações incluem edema pulmonar e hipocalcemia.",
  },
  {
    etapa: "2. Beta-2 adrenérgico",
    conduta: "Albuterol inalatório 10 a 20 mg em 5 mL de soro fisiológico, ou IV 0,5 mg em 100 mL de SG 5%.",
    observacao: "É adjuvante. Não substitui a estabilização nem a remoção.",
  },
  {
    etapa: "3. Remover",
    conduta: "Furosemida, resina de troca ou diálise, conforme o contexto.",
    observacao: "Função renal e urgência definem a estratégia.",
  },
];

export const FONTE_HIPERCALEMIA = SAESP("PDF pp. 2453-2455");

export const CONFERENCIA_HIPERCALEMIA =
  "A diretriz UK Kidney Association de 2023 atualizou dose e administração do cálcio e enfatiza a prevenção e a monitorização da hipoglicemia após a insulina. Como há diferença entre protocolos, o AVANEST não seleciona um regime bibliográfico: o esquema institucional versionado é que vale.";

/* ------------------------------------------------------------------ *
 * Bicarbonato
 * ------------------------------------------------------------------ */

export const FATOR_ASH = 0.3;
export const FATOR_ESPACO_BICARB = 0.6;

export type Bicarbonato = {
  deficit: number;
  metade: number;
  formula: string;
  aviso: string;
};

/**
 * Ash: peso × BE × 0,3, corrigindo metade.
 *
 * O BE entra negativo no laudo e representa déficit; a conta usa o módulo.
 */
export function deficitAsh(pesoKg?: number, be?: number): Bicarbonato | undefined {
  if (!ok(pesoKg) || !ok(be) || pesoKg <= 0 || be >= 0) return undefined;
  const deficit = arred(pesoKg * Math.abs(be) * FATOR_ASH, 1);
  return {
    deficit, metade: arred(deficit / 2, 1),
    formula: `Déficit = peso × |BE| × ${virgula(FATOR_ASH)}`,
    aviso: "A orientação do trecho é corrigir metade e reavaliar. Infusão descrita em 15 a 20 min; contraindicações incluem edema pulmonar e hipocalcemia.",
  };
}

/** (HCO3 desejado − atual) × peso × 0,6, a segunda fórmula permitida no guia. */
export function deficitPorAlvo(pesoKg?: number, hco3Atual?: number, hco3Desejado?: number): Bicarbonato | undefined {
  if (!ok(pesoKg) || !ok(hco3Atual) || !ok(hco3Desejado) || pesoKg <= 0) return undefined;
  if (hco3Desejado <= hco3Atual) return undefined;
  const deficit = arred((hco3Desejado - hco3Atual) * pesoKg * FATOR_ESPACO_BICARB, 1);
  return {
    deficit, metade: arred(deficit / 2, 1),
    formula: `Déficit = (HCO3 desejado − HCO3 atual) × peso × ${virgula(FATOR_ESPACO_BICARB)}`,
    aviso: "Sempre com rechecagem. A estimativa não substitui gasometria seriada.",
  };
}

/* ------------------------------------------------------------------ *
 * Cálcio, magnésio e fósforo — só alerta, dose bloqueada.
 * ------------------------------------------------------------------ */

export type SemRegime = {
  disturbio: string;
  sustentado: string;
  conduta: string;
  fonte: Fonte;
};

export const CA_MG_P: SemRegime[] = [
  {
    disturbio: "Hipocalcemia",
    sustentado: "As duas fontes destacam hipocalcemia por citrato e transfusão. O SAESP cita gluconato 10% 10 a 20 mL, ou cloreto 10% 2 a 5 mL, por 500 mL de sangue, no contexto de choque e hemoterapia.",
    conduta: "Não generalizar para toda hipocalcemia. Registrar cálcio iônico, ECG, contexto transfusional e acesso.",
    fonte: SAESP("PDF pp. 2450-2455"),
  },
  {
    disturbio: "Hipercalcemia",
    sustentado: "Emergência acima de 15 mg/dL. Expansão com soro fisiológico 200 a 400 mL/h e furosemida, no capítulo de hiperparatireoidismo, com monitorização cardíaca.",
    conduta: "Manter como contexto específico. Não usar em insuficiência cardíaca ou renal sem avaliação individual.",
    fonte: SAESP("PDF pp. 2450-2455"),
  },
  {
    disturbio: "Hipomagnesemia",
    sustentado: "O SAESP manda investigar na hipocalemia refratária e cita o limiar de 1,9 mg/dL, sem regime geral de reposição no capítulo.",
    conduta: "Dose e velocidade ficam nulas até haver fonte validada.",
    fonte: SAESP("PDF pp. 2450-2452"),
  },
  {
    disturbio: "Hipermagnesemia",
    sustentado: "O Miller discute a toxicidade do magnésio obstétrico e a interação com bloqueadores neuromusculares, sem algoritmo geral de correção.",
    conduta: "Registrar contexto, função renal, reflexos e ventilação. Sem cálculo automático.",
    fonte: MILLER("riscos perioperatórios e bloqueio neuromuscular"),
  },
  {
    disturbio: "Hipofosfatemia e hiperfosfatemia",
    sustentado: "Não foi localizado regime geral de correção explicitado nos trechos centrais.",
    conduta: "Não inventar dose. Exige fonte especializada adicional.",
    fonte: SAESP("PDF pp. 2428-2455"),
  },
];

/**
 * A correção do cálcio pela albumina existe no AVANEST desde antes deste guia,
 * e o guia manda não atribuí-la ao SAESP nem ao Miller — ela não foi
 * localizada de forma explícita nos trechos revistos. Fica, porque é de uso
 * corrente e o serviço pediu, mas com a procedência dita e a preferência pelo
 * iônico reforçada.
 */
export const PROCEDENCIA_CALCIO_CORRIGIDO =
  "Fórmula clássica de uso corrente, não localizada de modo explícito no SAESP nem no Miller. Havendo cálcio iônico, prefira interpretá-lo diretamente no contexto perioperatório.";

/* ------------------------------------------------------------------ *
 * Antes de calcular, e travas
 * ------------------------------------------------------------------ */

export const ANTES_DE_CALCULAR: string[] = [
  "Confirmar amostra, unidade, hemólise, glicemia, função renal, diurese, pH, volume circulante e sintomas.",
  "Emergência é definida por clínica, ECG e velocidade de instalação — não apenas pelo número.",
  "O cálculo prevê uma resposta aproximada: medir de novo e ajustar. Nunca programar toda a estimativa de déficit de uma vez.",
  "Crianças, gestantes, diálise, insuficiência hepática avançada e intoxicações exigem protocolo específico.",
];

export const TRAVAS: string[] = [
  "Déficit estimado nunca vira dose total automática.",
  "Potássio intravenoso exige diluente, volume final, via, bomba e plano de ECG e laboratório.",
  "Velocidade ou concentração acima do protocolo institucional geram alerta.",
  "Glicemia registrada antes e depois da insulina na hipercalemia.",
  "No sódio, o alerta é pela variação acumulada em janela móvel de 24 e 48 horas.",
  "A divergência do SAESP entre texto e figura sobre o “+1” fica exibida, e a versão usada é a validada pela governança.",
];

export const AVISO_MODULO =
  "Módulo adulto, para orientar raciocínio, cálculo e monitorização. Não é prescrição. Reposição intravenosa concentrada, salina hipertônica, cálcio, insulina e potássio exigem ambiente monitorizado, acesso adequado, bomba de infusão e dupla checagem.";

export const AVISO_FAIXAS =
  "As faixas de referência usadas na classificação são valores gerais de adulto, sem fonte citada — troque pelas do laboratório do seu serviço. Os limiares com fonte aparecem identificados ao lado de cada distúrbio.";
