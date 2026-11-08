// Excluir o médico sem conta junto com os plantões dele (08/11/2026: "onde
// apaga tudo"; "coloca pra funcionar"). A regra mora no banco
// (supabase/migrations/202611080001, excluir_cadastro_com_plantoes); aqui, o
// que a tela decide e diz antes do toque, a partir de o_que_sai_com_o_cadastro.

export type SaiComOCadastro = {
  plantoes: number;
  pacientes_no_mapa: number;
  /** Produção, trocas e atendimentos faturados: com eles, não sai. */
  outros: number;
  clinico: number;
  sem_conta: boolean;
};

/** Sai com os plantões: cadastro sem conta, só com plantões ligados. */
export const saiComPlantoes = (s: SaiComOCadastro | null): s is SaiComOCadastro =>
  Boolean(s && s.sem_conta && s.plantoes > 0 && s.outros === 0 && s.clinico === 0);

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** O botão e o aviso do diálogo de excluir, com os números. */
export function textoDaExclusao(nome: string, s: SaiComOCadastro): { botao: string; aviso: string } {
  const mapa = s.pacientes_no_mapa > 0
    ? ` ${plural(s.pacientes_no_mapa, "paciente do mapa fica", "pacientes do mapa ficam")} sem anestesista.`
    : "";
  return {
    botao: `Excluir com ${plural(s.plantoes, "plantão", "plantões")}`,
    aviso: `${nome} não tem conta, produção nem faturamento: só plantões. Junto com o cadastro `
      + `${s.plantoes === 1 ? "sai o plantão dele" : `saem os ${s.plantoes} plantões dele`} na escala.${mapa} `
      + "Os plantões apagados ficam no histórico de atividades, com dia, horário e local. Não tem volta.",
  };
}
