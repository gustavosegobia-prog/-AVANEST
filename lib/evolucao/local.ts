// As fichas de um hospital não aparecem no outro.
//
// A ficha guarda o hospital em que foi aberta em `dados.local_atendimento_id`
// (o escolhido em "Onde você vai atender hoje?"). A que ainda não tem —
// anterior à separação — vale em todos, para não sumir de lista nenhuma, e
// ganha o hospital na próxima vez que for aberta. O id vem do banco
// (meus_locais), nunca do que a pessoa digita.

/** Filtro `or` do PostgREST para as fichas de um hospital. */
export const fichasDoLocal = (localId: string) =>
  `dados->>local_atendimento_id.eq.${localId},dados->>local_atendimento_id.is.null`;

/** O mesmo para as avaliações, que guardam o hospital numa coluna própria. */
export const avaliacoesDoLocal = (localId: string) =>
  `local_atendimento_id.eq.${localId},local_atendimento_id.is.null`;
