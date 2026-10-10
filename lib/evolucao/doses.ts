// Conferência de dose — o motor de regras. Prioridade: pediatria.
//
// ============================================================================
// O QUE ESTE ARQUIVO NÃO TEM: NENHUM VALOR DE DOSE.
// ============================================================================
// As faixas vêm de regras_de_dose, no banco, e cada regra carrega fonte,
// edição, ano, página, revisor, versão e o estado de aprovação. Só regra
// APROVADA vale para o alerta. Sem regra aprovada para aquele medicamento, via,
// indicação, idade e peso, o resultado é "indisponível" — e a tela diz
// "Referência de dose indisponível para esta situação", sem declarar a dose
// segura nem insegura.
//
// O motor APOIA a decisão; não decide. Alerta clínico pode ser confirmado pelo
// médico com justificativa, que fica gravada junto da administração. Erro
// técnico — unidade que não conversa, peso ausente para uma regra por kg —
// não é "confirmável": é dado inválido e não deixa gravar.

import { converterMassa, mesmoMedicamento, type UnidadeDeDose } from "./medicamentos.ts";

export type RegraDeDose = {
  id: string;
  medicamento: string;
  apresentacao?: string | null;
  via: string;
  indicacao: string;
  idade_min_dias?: number | null;
  idade_max_dias?: number | null;
  peso_min_kg?: number | null;
  peso_max_kg?: number | null;
  unidade_por_kg: "mg/kg" | "mcg/kg" | "UI/kg" | "mEq/kg";
  dose_habitual_min?: number | null;
  dose_habitual_max?: number | null;
  dose_critica_max?: number | null;
  dose_maxima_absoluta?: number | null;
  unidade_maxima_absoluta?: "g" | "mg" | "mcg" | "UI" | "mEq" | null;
  dose_acumulada_max_por_kg?: number | null;
  intervalo_minimo_min?: number | null;
  fonte: string;
  edicao: string;
  ano: number;
  pagina?: string | null;
  revisado_em?: string | null;
  revisor?: string | null;
  versao: number;
  aprovada: boolean;
};

export type ContextoDaDose = {
  medicamento: string;
  via: string;
  indicacao: string;
  dose: number;
  unidade: UnidadeDeDose;
  pesoKg: number | null;
  idadeDias: number | null;
  /** Já administrado ANTES desta dose, na unidade da dose. */
  acumuladoAntes: number;
  /** Minutos desde a última administração do mesmo medicamento, se houver. */
  minutosDesdeUltima: number | null;
};

export type Nivel = "verde" | "amarelo" | "vermelho" | "indisponivel" | "erro";

export type Avaliacao = {
  nivel: Nivel;
  /** Dose por kg na unidade da regra (ou da dose, sem regra). */
  porKg: number | null;
  unidadePorKg: string | null;
  motivos: string[];
  regra: RegraDeDose | null;
  /** Alerta amarelo ou vermelho pede justificativa para seguir. */
  exigeJustificativa: boolean;
};

export const SEM_REFERENCIA = "Referência de dose indisponível para esta situação";

const doDia = (anos: number) => Math.round(anos * 365.25);
export const idadeEmDias = (nascimentoIso: string | null | undefined, em: Date = new Date()) => {
  if (!nascimentoIso) return null;
  const n = Date.parse(`${nascimentoIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(n)) return null;
  return Math.floor((em.getTime() - n) / 86400000);
};
export { doDia as anosEmDias };

/** A regra aprovada que cobre o caso, ou nenhuma. */
export function regraAplicavel(regras: readonly RegraDeDose[], c: ContextoDaDose): RegraDeDose | null {
  const candidatas = regras.filter((r) => r.aprovada
    && mesmoMedicamento(r.medicamento, c.medicamento)
    && r.via === c.via
    && mesmoMedicamento(r.indicacao, c.indicacao)
    && (r.idade_min_dias == null || (c.idadeDias !== null && c.idadeDias >= r.idade_min_dias))
    && (r.idade_max_dias == null || (c.idadeDias !== null && c.idadeDias <= r.idade_max_dias))
    && (r.peso_min_kg == null || (c.pesoKg !== null && c.pesoKg >= r.peso_min_kg))
    && (r.peso_max_kg == null || (c.pesoKg !== null && c.pesoKg <= r.peso_max_kg)));
  // Mais de uma regra cobrindo o mesmo caso: vale a de versão mais nova.
  return candidatas.sort((a, b) => b.versao - a.versao)[0] ?? null;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const citar = (r: RegraDeDose) =>
  `${r.fonte}, ${r.edicao} (${r.ano})${r.pagina ? `, ${r.pagina}` : ""} — regra v${r.versao}`;

export function avaliarDose(regras: readonly RegraDeDose[], c: ContextoDaDose): Avaliacao {
  const base = { regra: null, exigeJustificativa: false };
  if (!(c.dose > 0)) {
    return { ...base, nivel: "erro", porKg: null, unidadePorKg: null, motivos: ["Dose inválida."] };
  }
  const regra = regraAplicavel(regras, c);
  // Sem regra: mostra a conta (se houver peso), mas não julga.
  if (!regra) {
    const porKg = c.pesoKg && c.unidade !== "mL" ? Math.round((c.dose / c.pesoKg) * 10000) / 10000 : null;
    return {
      ...base, nivel: "indisponivel", porKg,
      unidadePorKg: porKg === null ? null : `${c.unidade}/kg`,
      motivos: [SEM_REFERENCIA + "."],
    };
  }
  const unidadeRegra = regra.unidade_por_kg.split("/")[0];
  const naUnidade = (v: number) => c.unidade === unidadeRegra ? v : converterMassa(v, c.unidade, unidadeRegra);
  const dose = naUnidade(c.dose);
  if (dose === null) {
    return { ...base, regra, nivel: "erro", porKg: null, unidadePorKg: regra.unidade_por_kg,
      motivos: [`A dose está em ${c.unidade} e a referência em ${regra.unidade_por_kg}: as unidades não se convertem.`] };
  }
  if (!(c.pesoKg && c.pesoKg > 0)) {
    return { ...base, regra, nivel: "erro", porKg: null, unidadePorKg: regra.unidade_por_kg,
      motivos: ["Sem peso registrado na folha não há como calcular a dose por kg."] };
  }
  const porKg = Math.round((dose / c.pesoKg) * 10000) / 10000;
  const acumulado = naUnidade(c.acumuladoAntes) ?? 0;
  const acumuladoPorKg = (acumulado + dose) / c.pesoKg;
  const vermelho: string[] = [];
  const amarelo: string[] = [];

  if (regra.dose_critica_max != null && porKg > regra.dose_critica_max) {
    vermelho.push(`${fmt(porKg)} ${regra.unidade_por_kg} passa do limite crítico de ${fmt(regra.dose_critica_max)} ${regra.unidade_por_kg}.`);
  }
  if (regra.dose_maxima_absoluta != null && regra.unidade_maxima_absoluta) {
    const absoluta = c.unidade === regra.unidade_maxima_absoluta ? c.dose
      : converterMassa(c.dose, c.unidade, regra.unidade_maxima_absoluta);
    if (absoluta !== null && absoluta > regra.dose_maxima_absoluta) {
      vermelho.push(`A dose passa do máximo absoluto de ${fmt(regra.dose_maxima_absoluta)} ${regra.unidade_maxima_absoluta}.`);
    }
  }
  if (regra.dose_acumulada_max_por_kg != null && acumuladoPorKg > regra.dose_acumulada_max_por_kg) {
    vermelho.push(`Com esta dose, o acumulado chega a ${fmt(Math.round(acumuladoPorKg * 1000) / 1000)} ${regra.unidade_por_kg}, acima do máximo acumulado de ${fmt(regra.dose_acumulada_max_por_kg)}.`);
  }
  if (regra.dose_habitual_min != null && porKg < regra.dose_habitual_min) {
    amarelo.push(`${fmt(porKg)} ${regra.unidade_por_kg} está abaixo da faixa habitual (${fmt(regra.dose_habitual_min)}–${fmt(regra.dose_habitual_max ?? regra.dose_habitual_min)}).`);
  }
  if (regra.dose_habitual_max != null && porKg > regra.dose_habitual_max && !vermelho.length) {
    amarelo.push(`${fmt(porKg)} ${regra.unidade_por_kg} está acima da faixa habitual (${fmt(regra.dose_habitual_min ?? 0)}–${fmt(regra.dose_habitual_max)}).`);
  }
  if (regra.intervalo_minimo_min != null && c.minutosDesdeUltima !== null && c.minutosDesdeUltima < regra.intervalo_minimo_min) {
    amarelo.push(`Última dose há ${Math.round(c.minutosDesdeUltima)} min; o intervalo mínimo da referência é ${regra.intervalo_minimo_min} min.`);
  }
  if (c.idadeDias === null && (regra.idade_min_dias != null || regra.idade_max_dias != null)) {
    amarelo.push("Idade não registrada: confira a faixa etária da referência.");
  }

  const fonte = `Fonte: ${citar(regra)}.`;
  if (vermelho.length) {
    return { regra, nivel: "vermelho", porKg, unidadePorKg: regra.unidade_por_kg,
      motivos: [...vermelho, ...amarelo, fonte], exigeJustificativa: true };
  }
  if (amarelo.length) {
    return { regra, nivel: "amarelo", porKg, unidadePorKg: regra.unidade_por_kg,
      motivos: [...amarelo, fonte], exigeJustificativa: true };
  }
  return { regra, nivel: "verde", porKg, unidadePorKg: regra.unidade_por_kg,
    motivos: [`${fmt(porKg)} ${regra.unidade_por_kg}, dentro da faixa da referência.`, fonte],
    exigeJustificativa: false };
}
