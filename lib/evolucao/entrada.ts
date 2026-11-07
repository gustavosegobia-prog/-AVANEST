// ===========================================================================
// A entrada da ficha anestésica: achar o paciente do dia com o mínimo de toques
// ===========================================================================
// Pedido de 06/11/2026: "melhorar para não ter que ficar abrindo um monte de
// coisa para fazer uma função só, que no final é a ficha anestésica" — e "vai
// usar no ambulatório, que daí não tem mapa cirúrgico. Tem que ficar bom pra
// todo mundo".
//
// A entrada tem uma caixa de busca só. Sem nada escrito, ela mostra a lista do
// dia: o mapa cirúrgico do hospital, quando há (lib/evolucao/mapa-do-dia.ts), e
// os pacientes avaliados hoje que ainda não têm ficha — o ambulatório, onde a
// consulta pré-anestésica vem logo antes do procedimento. Com o nome escrito,
// a mesma caixa filtra o mapa na hora e busca no cadastro inteiro.
//
// Tudo aqui é puro; a tela é app/evolucao/nova-folha.tsx.
// ===========================================================================

import { dataLocal } from "../data-local.ts";
import { semAcento } from "./mapa-do-dia.ts";

/** O que a busca e a lista do dia mostram de cada paciente cadastrado. */
export type PacienteAchado = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  idade_anos: number | null;
  sexo: string | null;
  convenio: string | null;
  hospital: string | null;
  cirurgia: string | null;
  procedimento: string | null;
  /** A avaliação que vai para o topo da ficha; nula quando não há; ausente quando não deu para saber. */
  avaliacao?: { em: string; rascunho: boolean; cirurgia: string } | null;
  /** A ficha que o paciente já tem aberta, se tiver. */
  aberta: string | null;
};

/**
 * O nome casa com o que foi digitado: todas as palavras, sem acento, em
 * qualquer ordem e em qualquer parte do nome. "joao silva" acha "JOÃO DA
 * SILVA"; "silva jo" também.
 */
export function casaComONome(nome: string, termo: string): boolean {
  const palavras = semAcento(termo).split(" ").filter(Boolean);
  if (!palavras.length) return true;
  const alvo = semAcento(nome);
  return palavras.every((p) => alvo.includes(p));
}

export type AvaliacaoDoDia = {
  patient_id: string;
  created_at: string;
  concluida_at: string | null;
  cirurgia: string | null;
  paciente: Omit<PacienteAchado, "avaliacao" | "aberta"> | Array<Omit<PacienteAchado, "avaliacao" | "aberta">> | null;
};

/**
 * Os pacientes avaliados hoje (avaliação começada ou concluída hoje, no fuso
 * do serviço) que ainda não têm ficha começada hoje. Um por paciente, o mais
 * recente primeiro. Quem já está no mapa do dia não se repete aqui.
 */
export function avaliadosDeHoje(
  avaliacoes: AvaliacaoDoDia[],
  o: { hoje: string; comFichaHoje: Iterable<string>; noMapa?: Iterable<string>; limite?: number },
): PacienteAchado[] {
  const fora = new Set([...o.comFichaHoje, ...(o.noMapa ?? [])]);
  const doDia = (iso: string | null) => Boolean(iso) && dataLocal(new Date(iso!)) === o.hoje;
  const ordem = [...avaliacoes].sort((a, b) =>
    (b.concluida_at ?? b.created_at).localeCompare(a.concluida_at ?? a.created_at));
  const vistos = new Set<string>();
  const lista: PacienteAchado[] = [];
  const limite = o.limite ?? 12;
  for (const a of ordem) {
    if (lista.length >= limite) break;
    const p = Array.isArray(a.paciente) ? a.paciente[0] : a.paciente;
    if (!p || vistos.has(a.patient_id) || fora.has(a.patient_id)) continue;
    if (!doDia(a.created_at) && !doDia(a.concluida_at)) continue;
    vistos.add(a.patient_id);
    lista.push({
      ...p,
      avaliacao: { em: a.concluida_at ?? a.created_at, rascunho: !a.concluida_at, cirurgia: a.cirurgia?.trim() ?? "" },
      aberta: null,
    });
  }
  return lista;
}

/**
 * A sala como a linha da ficha em andamento escreve: "2" vira "Sala 2", e o
 * que já vem com "Sala" (o mapa escreve "Sala 2") fica como está. Antes saía
 * "Sala Sala 2".
 */
export function nomeDaSala(sala: string | null | undefined): string {
  const s = (sala ?? "").trim();
  if (!s) return "";
  return /^sala(\s|$)/i.test(s) ? s : `Sala ${s}`;
}
