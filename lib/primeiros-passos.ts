// OS PRIMEIROS PASSOS DE QUEM ACABOU DE ASSINAR (22/11/2026).
//
// O primeiro assinante criou a conta, fez uma avaliação, abriu uma ficha que
// ficou vazia — e não voltou mais, embora a mensalidade tenha sido cobrada. O
// tutorial do primeiro acesso mostra ONDE fica cada coisa; esta lista diz O QUE
// FAZER primeiro, e vai sendo riscada pelo próprio uso: cada passo se marca
// sozinho quando a coisa existe no banco, sem a pessoa ter de dizer que fez.
//
// Aparece para quem é dono ou administra a organização, nos 30 primeiros dias
// dela, até os passos acabarem — ou até a pessoa fechar.

export type EstadoDosPassos = {
  /** Tem plantão na escala (dele). */
  escala: boolean;
  /** A organização tem alguma avaliação pré-anestésica. */
  avaliacao: boolean;
  /** Tem ficha anestésica com algum registro; nulo quando a ficha não está liberada. */
  ficha: boolean | null;
  /** Tem mais alguém na organização; nulo na conta individual. */
  equipe: boolean | null;
};

export type Passo = {
  chave: "escala" | "avaliacao" | "ficha" | "equipe";
  titulo: string;
  detalhe: string;
  feito: boolean;
  /** Para onde o toque leva: uma área do painel, ou um endereço. */
  destino: { area: "plantoes" | "medico" | "admin" } | { href: string };
};

export function primeirosPassos(e: EstadoDosPassos): Passo[] {
  const passos: Passo[] = [
    {
      chave: "escala", feito: e.escala, destino: { area: "plantoes" },
      titulo: "Ponha a escala do mês",
      detalhe: "Importe a planilha, o PDF ou o print que você recebe — ou lance os plantões.",
    },
    {
      chave: "avaliacao", feito: e.avaliacao, destino: { area: "medico" },
      titulo: "Faça uma consulta pré-anestésica",
      detalhe: "Cadastre o paciente e preencha a avaliação; os documentos saem prontos para imprimir.",
    },
  ];
  if (e.ficha !== null) {
    passos.push({
      chave: "ficha", feito: e.ficha, destino: { href: "/evolucao" },
      titulo: "Use a ficha anestésica numa cirurgia",
      detalhe: "Sinais vitais, medicação e eventos no tablet ou no celular, e a folha impressa no fim.",
    });
  }
  if (e.equipe !== null) {
    passos.push({
      chave: "equipe", feito: e.equipe, destino: { area: "admin" },
      titulo: "Convide os colegas do grupo",
      detalhe: "Cada um entra com o próprio login, confirma os seus plantões e vê a escala do grupo.",
    });
  }
  return passos;
}

/** A organização está nos seus 30 primeiros dias? */
export function noPrimeiroMes(criadaEm: string | null | undefined, agora: Date): boolean {
  const criada = criadaEm ? new Date(criadaEm).getTime() : NaN;
  return Number.isFinite(criada) && agora.getTime() - criada <= 30 * 86_400_000;
}

/** Os 30 primeiros dias da organização, para quem a administra, e só enquanto falta algum passo. */
export function mostrarPrimeirosPassos(o: {
  criadaEm: string | null | undefined; agora: Date; papel: string; passos: readonly Passo[];
}): boolean {
  if (!["owner", "admin"].includes(o.papel) || !noPrimeiroMes(o.criadaEm, o.agora)) return false;
  return o.passos.some((p) => !p.feito);
}
