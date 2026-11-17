// O caminho do paciente sem nada em dobro (17/11/2026: "teste a integração do
// site, desde o ambulatório até o financeiro; não quero nada duplicado").
//
// O banco recusa o segundo registro (supabase/migrations/202611170001): uma
// avaliação em rascunho e uma ficha aberta por paciente, e a ficha acha a
// anotação à mão da Produção pelo nome sem acento. Estas são as regras do lado
// da tela: quando o banco recusa, levar ao registro que já existe; e avisar
// antes onde o banco não tem como saber (dois procedimentos do mesmo paciente
// no mesmo dia existem).

import { nomeSimples } from "./honorarios.ts";

/** O código do Postgres para "já existe" (chave única). */
export const JA_EXISTE = "23505";

export const ehJaExiste = (erro: { code?: string } | null | undefined) => erro?.code === JA_EXISTE;

/**
 * A anotação do mesmo paciente já na Produção do dia. A ficha anestésica
 * encerrada lança a linha sozinha: anotar à mão depois contava o paciente duas
 * vezes. Mesmo nome com outra grafia ("Jose" e "José") é o mesmo paciente.
 */
export function jaAnotadoNoDia<T extends { paciente: string }>(itens: readonly T[], nome: string): T | null {
  const chave = nomeSimples(nome);
  if (!chave) return null;
  return itens.find((i) => nomeSimples(i.paciente) === chave) ?? null;
}

/** O aviso da anotação repetida; o segundo toque em "Anotar" confirma. */
export function avisoDeAnotacaoRepetida(item: { paciente: string; evolucao_id?: string | null }): string {
  const deOnde = item.evolucao_id ? " — veio da ficha anestésica" : "";
  return `${item.paciente} já está na produção deste dia${deOnde}. Se for outro procedimento do mesmo paciente, toque em "+ Anotar" de novo.`;
}

/**
 * O cadastro do mesmo paciente que nasceu sem CPF — pela ficha anestésica ou
 * pelo mapa cirúrgico — e chega agora à recepção. Mesmo nome e mesma data de
 * nascimento, e o cadastro antigo sem CPF (com outro CPF, é outra pessoa).
 */
export function mesmoPacienteSemCpf<T extends { nome: string; cpf?: string | null }>(
  candidatos: readonly T[], nome: string,
): T | null {
  const chave = nomeSimples(nome);
  if (!chave) return null;
  return candidatos.find((c) => !String(c.cpf ?? "").replace(/\D/g, "") && nomeSimples(c.nome) === chave) ?? null;
}

/**
 * A ficha que já está aberta para o paciente, quando o banco recusa abrir
 * outra. No mesmo hospital (ou sem hospital marcado), continua-se nela; em
 * outro, a pessoa precisa saber onde ela está antes de abrir uma nova.
 */
export function destinoDaFichaAberta(
  aberta: { id: string; localId: string | null; localNome: string | null },
  localDaSessao: string | null,
): { id: string } | { erro: string } {
  if (!aberta.localId || !localDaSessao || aberta.localId === localDaSessao) return { id: aberta.id };
  const onde = aberta.localNome?.trim() ? ` em ${aberta.localNome.trim()}` : " em outro hospital";
  return { erro: `Este paciente já tem uma ficha aberta${onde}. Encerre aquela ficha antes de abrir outra.` };
}
