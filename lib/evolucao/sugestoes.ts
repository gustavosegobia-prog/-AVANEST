// Doses sugeridas na ficha anestésica.
//
// O pedido do serviço: no adulto, as doses padrão já à vista para escolher; na
// criança, a dose calculada pelo peso e pela idade — e o médico pode mudar.
//
// OS NÚMEROS NÃO NASCEM AQUI. Vêm da calculadora de doses
// (lib/calculos/doses.ts), a tabela que já tem fonte, data de revisão e
// situação — só cartão "validado" calcula. Este arquivo só escolhe quais
// cartões valem para o fármaco, a via e a faixa etária do paciente da ficha, e
// leva o resultado para a unidade em que a ficha escreve aquele fármaco.
//
// A SUGESTÃO PREENCHE; NÃO REGISTRA. O médico vê o número, muda se quiser e
// confirma. A conferência de dose (doses.ts) continua julgando o que for
// gravado, e a alergia continua pedindo justificativa.

import {
  AVISO_TITULAVEL, CATALOGO as TABELA, ROTULO_NIVEL, ROTULO_POPULACAO, bupivacainaIntratecal, calcular, citar,
  doseCefazolina, doseCetorolaco, faixaEtaria, porMl, virgula,
  type DosePorKg, type Medicamento, type Populacao, type Unidade,
} from "../calculos/doses.ts";
import { concentracaoNaUnidade, converterMassa, mesmoFarmaco, type UnidadeDeConcentracao, type UnidadeDeDose } from "./medicamentos.ts";
import { ehPediatrico, profundidadeOral, sugerirTubo } from "../calculos/via-aerea-pediatrica.ts";
import { pesoDaDose, ROTULO_BASE, type Antropometria } from "../calculos/peso.ts";

export type Sugestao = {
  chave: string;
  /** O cartão da tabela: "Propofol — indução". */
  titulo: string;
  /** "Mínima", "Usual", "Máxima". */
  nivel: string;
  /** Na unidade pedida pela ficha. */
  dose: number;
  unidade: UnidadeDeDose;
  /** A dose da tabela: "2 mg/kg" ou "dose fixa". */
  base: string;
  /** A via na grafia da ficha (EV, IM, intratecal…). */
  via: string;
  indicacao?: string;
  observacao?: string;
  /** O teto absoluto da tabela cortou a conta. */
  limitada?: boolean;
};

/** Um cartão da tabela, com as doses dele lado a lado. */
export type CartaoSugerido = {
  titulo: string;
  base: string;
  via: string;
  indicacao?: string;
  observacao?: string;
  fonte: string;
  doses: Sugestao[];
};

/** Anestésico local: a tabela dá o MÁXIMO, que não é dose a aplicar. */
export type TetoSugerido = { titulo: string; dose: number; unidade: UnidadeDeDose; base: string; fonte: string };

export type SugestoesDaFicha = {
  populacao: Populacao | null;
  rotulo: string | null;
  cartoes: CartaoSugerido[];
  tetos: TetoSugerido[];
  /** Por que falta número: sem idade, sem peso. */
  aviso: string | null;
};

export type PacienteDaFicha = {
  /** Idade em meses (da data de nascimento, ou dos anos informados). */
  idadeMeses: number | null;
  pesoKg: number | null;
  /** Da avaliação pré-anestésica: com sexo, dá o peso ideal, ajustado e magro do obeso. */
  alturaCm?: number | null;
  sexo?: string | null;
};

/** O peso de um cartão para o paciente da ficha (lib/calculos/peso.ts). */
function pesoDoCartao(m: Medicamento, p: PacienteDaFicha) {
  const corpo: Antropometria = {
    pesoKg: p.pesoKg, alturaCm: p.alturaCm ?? null, sexo: p.sexo ?? null,
    idadeAnos: p.idadeMeses !== null ? p.idadeMeses / 12 : null,
  };
  const r = pesoDaDose(m.pesoBase, corpo);
  return { ...r, rotulo: r.base !== "atual" && r.kg !== null ? `${ROTULO_BASE[r.base]} ${virgula(r.kg)} kg` : null };
}

const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Os fármacos de um cartão: "Propofol — indução" → Propofol; "Dipirona ou paracetamol" → os dois. */
export function farmacosDoCartao(m: Medicamento): string[] {
  const base = m.nome.split(" — ")[0].replace(/\s+(IV|intratecal)$/i, "").trim();
  return base.split(/\s+ou\s+/i).map((n) => n.charAt(0).toUpperCase() + n.slice(1));
}

/** A via do cartão na grafia da ficha. Bomba fica de fora: não é dose em bolus. */
export function viaDaFicha(via: string): string | null {
  const v = via.toLowerCase();
  if (v.includes("infusão contínua")) return null;
  if (v === "iv") return "EV";
  if (v === "im") return "IM";
  if (v.startsWith("vo")) return "VO";
  if (v === "retal") return "retal";
  if (v === "intratecal") return "intratecal";
  if (v.startsWith("infiltração")) return "perineural";
  return "outra";
}

/** Arredonda como se aspira: inteiro acima de 100, uma casa até 10, duas abaixo. */
export function arredondarDose(v: number): number {
  if (v >= 100) return Math.round(v);
  if (v >= 10) return Math.round(v * 10) / 10;
  if (v >= 1) return Math.round(v * 100) / 100;
  return Math.round(v * 1000) / 1000;
}

const escreverBase = (d: DosePorKg, valor?: number) => {
  if (d.por === "fixa") return "dose fixa";
  const faixa = valor !== undefined ? virgula(valor)
    : [d.min, d.usual, d.max].filter((x): x is number => x !== undefined).map(virgula).join("–");
  return `${faixa} ${d.unidade}/kg`;
};

/** A idade da ficha em meses: a data de nascimento manda; sem ela, os anos informados. */
export function idadeEmMesesDaFicha(idadeDias: number | null, idadeAnos: number | null | undefined): number | null {
  if (idadeDias !== null && idadeDias >= 0) return Math.floor(idadeDias / 30.4375);
  if (typeof idadeAnos === "number" && idadeAnos >= 0) return idadeAnos * 12;
  return null;
}

/**
 * As doses da tabela para um fármaco da ficha.
 *
 * `unidade` é a unidade em que a ficha escreve o fármaco (fentanil em mcg,
 * cefazolina em g): a dose vem convertida para ela. `via`, quando dada, deixa
 * só os cartões daquela via — a linha da lista tem via fixa. `contexto`
 * "sedacao" põe os cartões de sedação na frente (e só eles, se houver).
 */
export function sugerirDoses(nome: string, paciente: PacienteDaFicha, opcoes: {
  unidade: UnidadeDeDose; via?: string; contexto?: "sedacao" | "geral" | "neuroeixo" | "bloqueio" | "outro";
}): SugestoesDaFicha {
  const vazio = (aviso: string | null, populacao: Populacao | null = null): SugestoesDaFicha =>
    ({ populacao, rotulo: populacao ? ROTULO_POPULACAO[populacao] : null, cartoes: [], tetos: [], aviso });
  const populacao = paciente.idadeMeses !== null ? faixaEtaria(paciente.idadeMeses) ?? null : null;
  if (!populacao) return vazio("Sem idade na ficha: a tabela de doses depende da faixa etária.");
  const peso = ok(paciente.pesoKg) ? paciente.pesoKg : null;
  const idadeAnos = (paciente.idadeMeses ?? 0) / 12;

  let cartoes = TABELA.filter((m) => m.situacao === "validado" && !m.oculto && m.dose
    && m.populacoes.includes(populacao) && farmacosDoCartao(m).some((f) => mesmoFarmaco(f, nome)));

  const cartoesSugeridos: CartaoSugerido[] = [];
  const tetos: TetoSugerido[] = [];
  let faltouPeso = false;

  const naUnidade = (valor: number, de: Unidade): { dose: number; unidade: UnidadeDeDose } | null => {
    if (de === opcoes.unidade) return { dose: valor, unidade: opcoes.unidade };
    const v = converterMassa(valor, de, opcoes.unidade);
    return v === null ? null : { dose: v, unidade: opcoes.unidade };
  };

  // Raquianestesia pediátrica: a bupivacaína intratecal tem regra por peso,
  // fora do catálogo (a calculadora a mostra num cartão próprio).
  if (populacao !== "adulto" && mesmoFarmaco(nome, "Bupivacaína") && (!opcoes.via || opcoes.via === "intratecal")) {
    const faixa = peso !== null ? bupivacainaIntratecal(peso) : undefined;
    if (peso === null) faltouPeso = true;
    else if (faixa) {
      const conta = naUnidade(faixa.mgPorKg * peso, "mg");
      if (conta) {
        cartoesSugeridos.push({
          titulo: "Bupivacaína — raquianestesia pediátrica", base: `${virgula(faixa.mgPorKg)} mg/kg`, via: "intratecal",
          fonte: citar({ obra: "SAESP, Tratado de Anestesiologia", local: "capítulo pediátrico" }),
          observacao: `Referência prática para ${faixa.pesoMin}–${faixa.pesoMax} kg.`,
          doses: [{ chave: "raqui-ped", titulo: "Bupivacaína — raquianestesia pediátrica", nivel: "Usual",
            dose: arredondarDose(conta.dose), unidade: conta.unidade, base: `${virgula(faixa.mgPorKg)} mg/kg`, via: "intratecal" }],
        });
      }
    }
  }

  if (opcoes.contexto === "sedacao") {
    const deSedacao = cartoes.filter((m) => /seda|titula/i.test(`${m.nome} ${m.indicacao ?? ""}`));
    if (deSedacao.length) cartoes = deSedacao;
  } else {
    // Fora da sedação, o cartão de indução vem primeiro.
    cartoes = [...cartoes].sort((a, b) => Number(/indução/i.test(b.nome)) - Number(/indução/i.test(a.nome)));
  }

  const pesoDaBalanca = peso;
  for (const m of cartoes) {
    const via = viaDaFicha(m.via);
    if (!via || m.grupo === "bic") continue;
    // No obeso, o peso ideal, ajustado ou magro do fármaco (avaliação pré-anestésica).
    const pc = pesoDoCartao(m, paciente);
    const peso = pesoDaBalanca === null ? null : pc.kg;
    if (opcoes.via && via !== opcoes.via) continue;
    // A neostigmina depende da monitorização do bloqueio: a calculadora não dá
    // número sem ela, e a ficha também não.
    if (m.regra === "neostigmina") continue;

    let dose = m.dose!;
    let observacao = m.alerta ?? m.observacao;
    // Cefazolina e cetorolaco mudam de dose com peso e idade: a calculadora
    // escolhe, e diz por quê.
    const condicional = m.regra === "cefazolina" ? doseCefazolina(peso ?? undefined)
      : m.regra === "cetorolaco" ? doseCetorolaco({ idadeAnos, pesoKg: peso ?? undefined }) : null;
    if (condicional) {
      dose = condicional.dose;
      observacao = [condicional.motivo, m.alerta].filter(Boolean).join(" ");
    }
    if (m.titulavel) observacao = observacao ?? AVISO_TITULAVEL;
    if (pc.aviso) observacao = [observacao, pc.aviso].filter(Boolean).join(" ");
    const doPeso = pc.rotulo ? ` · ${pc.rotulo}` : "";

    const fonte = m.fonte ? citar(m.fonte) : "";
    // Só o máximo: é teto (anestésico local), não dose a aplicar.
    if (dose.max !== undefined && dose.min === undefined && dose.usual === undefined) {
      if (peso === null && dose.por !== "fixa") { faltouPeso = true; continue; }
      const [conta] = calcular(dose, peso ?? 1, undefined, m.tetoAbsoluto);
      const v = conta && naUnidade(conta.doseTotal, conta.unidadeDose);
      if (v) tetos.push({ titulo: m.nome, dose: arredondarDose(v.dose), unidade: v.unidade, base: `máximo ${escreverBase(dose)}${doPeso}`, fonte });
      continue;
    }
    if (peso === null && dose.por !== "fixa") { faltouPeso = true; continue; }
    const contas = calcular(dose, peso ?? 1, undefined, m.tetoAbsoluto);
    const doses: Sugestao[] = [];
    for (const c of contas) {
      const v = naUnidade(c.doseTotal, c.unidadeDose);
      if (!v) continue;
      const valor = arredondarDose(v.dose);
      // Duas doses iguais depois do arredondamento (ou do teto) viram uma só.
      if (doses.some((d) => d.dose === valor)) continue;
      doses.push({
        chave: `${m.id}-${c.nivel}`, titulo: m.nome, nivel: ROTULO_NIVEL[c.nivel], dose: valor, unidade: v.unidade,
        base: escreverBase(dose, c.dosePorKg), via, indicacao: m.indicacao, observacao,
        ...(c.limitada ? { limitada: true } : {}),
      });
    }
    if (doses.length) {
      cartoesSugeridos.push({ titulo: m.nome, base: `${escreverBase(dose)}${doPeso}`, via, indicacao: m.indicacao, observacao, fonte, doses });
    }
  }

  const aviso = !cartoesSugeridos.length && !tetos.length
    ? (faltouPeso ? "Sem peso na ficha: informe o peso para calcular a dose por kg." : null)
    : faltouPeso ? "Algumas doses são por kg e precisam do peso na ficha." : null;
  return { populacao, rotulo: ROTULO_POPULACAO[populacao], cartoes: cartoesSugeridos, tetos, aviso };
}

// ---------------------------------------------------------------------------
// TOT na criança
// ---------------------------------------------------------------------------
// O calibre e a profundidade vêm da calculadora de via aérea pediátrica
// (lib/calculos/via-aerea-pediatrica.ts): acima de 1 ano, a fórmula da idade;
// abaixo, a tabela por peso. Um toque escreve o tubo na linha "TOT" da ficha.

export type TuboSugerido = {
  /** De onde veio: "fórmula da idade" ou "tabela por peso". */
  origem: string;
  opcoes: Array<{ rotulo: string; numero: string; profundidade?: string }>;
  aviso?: string;
};

const comVirgula = (v: number) => v.toFixed(1).replace(".", ",");

export function tuboDaFicha(p: PacienteDaFicha): TuboSugerido | null {
  if (p.idadeMeses === null || !ehPediatrico(p.idadeMeses)) return null;
  const paciente = { idadeMeses: p.idadeMeses, pesoKg: ok(p.pesoKg) ? p.pesoKg : undefined };
  const s = sugerirTubo(paciente);
  if (!s) return null;
  if (s.aviso && !s.comCuff && !s.semCuff) return { origem: s.origem, opcoes: [], aviso: s.aviso };
  const opcoes: TuboSugerido["opcoes"] = [];
  for (const [tipo, balonete] of [["comCuff", "com balonete"], ["semCuff", "sem balonete"]] as const) {
    const o = s[tipo];
    if (!o) continue;
    const calibre = comVirgula(o.sugerido);
    opcoes.push({
      rotulo: `${calibre} ${balonete}`,
      numero: `${calibre} ${balonete}`,
      profundidade: profundidadeOral(paciente, o.sugerido)?.sugerida,
    });
  }
  return { origem: s.origem, opcoes };
}

// ---------------------------------------------------------------------------
// Velocidade da bomba
// ---------------------------------------------------------------------------
// Os cartões de infusão contínua da mesma tabela (remifentanil, dexmedetomidina,
// propofol em sedação, cetamina, clonidina): a faixa em mcg/kg/min ou mg/kg/h
// e, quando a concentração da seringa está escrita, a mesma faixa em mL/h pelo
// peso. Um toque preenche a velocidade; o médico confirma.

/** As unidades em que a ficha registra a bomba. */
export type UnidadeSugerida = "mcg/kg/min" | "mcg/kg/h" | "mg/kg/h" | "mcg/min" | "mg/min" | "UI/min" | "mcg/h" | "mg/h";

export type VelocidadeSugerida = {
  chave: string;
  nivel: string;
  /** Na unidade da tabela (0,1 mcg/kg/min), ou já multiplicada pelo peso do fármaco (6,2 mcg/min). */
  valor: number;
  unidade: UnidadeSugerida;
  /** A mesma velocidade em mL/h, quando há peso e concentração. */
  mlPorHora: number | null;
};

/** Uma diluição da tabela: o rótulo vai para "Diluição" e a concentração para o campo dela. */
export type DiluicaoSugerida = { rotulo: string; valor: number; unidade: UnidadeDeConcentracao };

export type CartaoDeBomba = {
  titulo: string; base: string; fonte: string; observacao?: string;
  opcoes: VelocidadeSugerida[];
  diluicoes: DiluicaoSugerida[];
};

/**
 * A bomba do fármaco: a faixa da tabela e, com a concentração da seringa, a
 * mesma faixa em mL/h. Por minuto sem peso (vasopressina, nitroglicerina,
 * amiodarona) não pede peso. No obeso, quando o fármaco vai pelo peso ideal,
 * ajustado ou magro, a velocidade sai já multiplicada por ele (mcg/min, mg/h):
 * registrada em mcg/kg/min, a ficha somaria a dose pelo peso da balança.
 */
export function sugerirVelocidades(nome: string, paciente: PacienteDaFicha,
  concentracao: { valor: number; unidade: UnidadeDeConcentracao } | null): { rotulo: string | null; cartoes: CartaoDeBomba[]; aviso: string | null } {
  const populacao = paciente.idadeMeses !== null ? faixaEtaria(paciente.idadeMeses) ?? null : null;
  if (!populacao) return { rotulo: null, cartoes: [], aviso: "Sem idade na ficha: a tabela depende da faixa etária." };
  const cartoes: CartaoDeBomba[] = [];
  let faltouPeso = false;
  for (const m of TABELA) {
    const d = m.dose;
    if (m.situacao !== "validado" || !d || (d.por !== "kg/min" && d.por !== "kg/h" && d.por !== "min")) continue;
    if (!m.populacoes.includes(populacao) || !farmacosDoCartao(m).some((f) => mesmoFarmaco(f, nome))) continue;
    const porKg = d.por !== "min";
    const tempo = d.por === "kg/h" ? "h" : "min";
    const naTabela = (porKg ? `${d.unidade}/kg/${tempo}` : `${d.unidade}/min`) as UnidadeSugerida;
    if (!["mcg/kg/min", "mcg/kg/h", "mg/kg/h", "mcg/min", "mg/min", "UI/min"].includes(naTabela)) continue;
    const pc = pesoDoCartao(m, paciente);
    const peso = porKg ? pc.kg : 1;
    if (porKg && peso === null) faltouPeso = true;
    // Pelo peso do fármaco, e não da balança: a velocidade vai multiplicada.
    const multiplicar = porKg && pc.base !== "atual" && peso !== null;
    // Concentração na unidade da dose (mcg/mL para mcg/kg/min), para o mL/h.
    const porMlDaSeringa = concentracao ? concentracaoNaUnidade(concentracao, d.unidade as UnidadeDeDose) : null;
    const niveis: Array<[string, number | undefined]> = [["Mínima", d.min], ["Usual", d.usual], ["Máxima", d.max]];
    const opcoes: VelocidadeSugerida[] = niveis.filter(([, v]) => v !== undefined).map(([nivel, v]) => {
      const porTempo = peso !== null ? v! * peso : null;
      const porHora = porTempo !== null ? porTempo * (tempo === "min" ? 60 : 1) : null;
      const mlPorHora = porHora !== null && porMlDaSeringa ? Math.round((porHora / porMlDaSeringa) * 10) / 10 : null;
      if (multiplicar) {
        return {
          chave: `${m.id}-${nivel}`, nivel: `${nivel} · ${virgula(v!)} ${naTabela}`,
          valor: Math.round(porTempo! * 100) / 100, unidade: `${d.unidade}/${tempo}` as UnidadeSugerida, mlPorHora,
        };
      }
      return { chave: `${m.id}-${nivel}`, nivel, valor: v!, unidade: naTabela, mlPorHora };
    });
    if (opcoes.length) {
      const faixa = [d.min, d.usual, d.max].filter((v): v is number => v !== undefined).map(virgula).join("–");
      cartoes.push({
        titulo: m.nome, base: `${faixa} ${naTabela}${pc.rotulo ? ` · ${pc.rotulo}` : ""}`,
        fonte: m.fonte ? citar(m.fonte) : "",
        observacao: [m.alerta ?? m.observacao, pc.aviso].filter(Boolean).join(" ") || undefined,
        opcoes,
        diluicoes: m.apresentacoes.map((a) => ({
          rotulo: a.rotulo, valor: Math.round(porMl(a) * 10000) / 10000, unidade: `${a.unidade}/mL` as UnidadeDeConcentracao,
        })),
      });
    }
  }
  const aviso = cartoes.length && (faltouPeso || !concentracao)
    ? "Com o peso e a concentração da seringa, a velocidade aparece também em mL/h." : null;
  return { rotulo: ROTULO_POPULACAO[populacao], cartoes, aviso };
}
