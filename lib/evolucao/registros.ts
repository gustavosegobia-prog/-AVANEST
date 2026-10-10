// Os registros da folha no tempo, e como se lê o estado atual deles.
//
// A tabela evolucao_registros não aceita UPDATE nem DELETE. Corrigir é
// inserir um registro novo com `substitui_id` apontando o velho; excluir é
// inserir um `anulado` apontando o velho, com motivo. O estado atual são os
// registros que ninguém substituiu — a mesma regra da função
// registros_vigentes_evolucao no banco, escrita aqui para a tela e para a
// impressão.

export type TipoDeRegistro = "sinal" | "medicamento" | "infusao" | "gas" | "liquido" | "evento";
export type Origem = "manual" | "estimado" | "importado";

export type Registro = {
  id: string;
  evolucao_id: string;
  tipo: TipoDeRegistro;
  /** Horário clínico, ISO com fuso. É ele que posiciona o registro na folha. */
  momento: string;
  dados: Record<string, unknown>;
  origem: Origem;
  substitui_id: string | null;
  anulado: boolean;
  motivo: string | null;
  created_by: string | null;
  created_at: string | null;
};

/** Os que valem agora: nem substituídos, nem exclusões. Em ordem de horário. */
export function vigentes(registros: readonly Registro[]): Registro[] {
  const substituidos = new Set(
    registros.filter((r) => r.substitui_id).map((r) => r.substitui_id as string),
  );
  return registros
    .filter((r) => !r.anulado && !substituidos.has(r.id))
    .sort(porMomento);
}

export function porMomento(a: Registro, b: Registro) {
  const d = Date.parse(a.momento) - Date.parse(b.momento);
  if (d !== 0) return d;
  return Date.parse(a.created_at ?? a.momento) - Date.parse(b.created_at ?? b.momento);
}

/**
 * A cadeia de um registro, do primeiro lançamento à versão atual (ou à
 * exclusão). É o "histórico da alteração" que a tela mostra ao abrir um ponto.
 */
export function historicoDe(id: string, registros: readonly Registro[]): Registro[] {
  const porId = new Map(registros.map((r) => [r.id, r]));
  const sucessor = new Map<string, Registro>();
  for (const r of registros) if (r.substitui_id) sucessor.set(r.substitui_id, r);
  // Volta até a origem…
  let inicio = porId.get(id);
  while (inicio?.substitui_id && porId.has(inicio.substitui_id)) inicio = porId.get(inicio.substitui_id);
  // …e anda para a frente.
  const cadeia: Registro[] = [];
  for (let r = inicio; r; r = sucessor.get(r.id)) cadeia.push(r);
  return cadeia;
}

export const minutosEntre = (a: string | Date, b: string | Date) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 60000;

/** Número de um campo do JSON, ou nulo. Texto não vira número aqui. */
export function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
