// As novidades que aparecem no painel, na área em que a novidade mora.
//
// Uma por vez, a mais recente, e só para quem vai usar: a novidade da recepção
// não aparece para o financeiro. Some com "Entendi" (guardado no aparelho) e,
// de qualquer jeito, na data de "ate": aviso de novidade que fica para sempre
// vira papel de parede, e ninguém lê o próximo.

export type AreaDaNovidade = "recepcao" | "medico";

export type Novidade = {
  id: string;
  /** Dia em que o aviso deixa de aparecer sozinho (AAAA-MM-DD, exclusive). */
  ate: string;
  titulo: string;
  /** O texto muda com a área: cada um lê o que vai fazer. */
  texto: Partial<Record<AreaDaNovidade, string>>;
  /** Os pontos da novidade, com o rótulo em negrito. */
  itens?: { rotulo: string; texto: string }[];
  /** A frase de fecho, em negrito. */
  assinatura?: string;
  /**
   * O que precisa estar no banco para a novidade existir de fato. Sem isso, o
   * aviso anunciaria um botão que dá erro: ele espera, e aparece sozinho no
   * dia em que o banco estiver pronto.
   */
  requer?: "questionario-pre";
};

const TEXTO_DO_QUESTIONARIO =
  "Agora, a recepção pode enviar o questionário pré-anestésico diretamente para o WhatsApp do paciente, permitindo que ele responda com antecedência, de forma simples e prática.";

export const NOVIDADES: Novidade[] = [
  {
    id: "questionario-whatsapp",
    ate: "2026-12-11",
    // Texto do Dr. Gustavo (10/11/2026), igual para a recepção e o médico.
    titulo: "🚀 Novidade no AVANEST: Questionário Pré-Anestésico pelo WhatsApp!",
    requer: "questionario-pre",
    texto: {
      recepcao: TEXTO_DO_QUESTIONARIO,
      medico: TEXTO_DO_QUESTIONARIO,
    },
    itens: [
      { rotulo: "Mais agilidade", texto: "o paciente preenche suas informações antes da avaliação." },
      {
        rotulo: "Alertas automáticos",
        texto: "o sistema destaca informações importantes, como alergias, uso de anticoagulantes e medicamentos para emagrecimento, incluindo as canetas emagrecedoras.",
      },
      {
        rotulo: "Preenchimento inteligente",
        texto: "com o botão “Trazer as respostas”, as informações fornecidas pelo paciente são incorporadas à avaliação pré-anestésica, preenchendo apenas os campos vazios, sem substituir os dados já registrados.",
      },
      { rotulo: "Mais segurança", texto: "o anestesiologista revisa e valida as informações antes de concluir a avaliação." },
    ],
    assinatura: "AVANEST — Menos burocracia, mais agilidade e segurança em cada etapa do cuidado anestésico.",
  },
];

export const chaveDaNovidade = (perfilId: string, id: string) => `novidade-vista:${perfilId}:${id}`;

/** A novidade a mostrar agora nesta área, ou nenhuma. */
export function novidadeDaArea(
  area: string,
  hoje: string,
  vistas: (id: string) => boolean,
  lista: Novidade[] = NOVIDADES,
  pronto: (requisito: NonNullable<Novidade["requer"]>) => boolean = () => true,
): (Novidade & { textoDaArea: string }) | null {
  for (const n of lista) {
    const texto = n.texto[area as AreaDaNovidade];
    if (!texto || hoje >= n.ate || vistas(n.id)) continue;
    if (n.requer && !pronto(n.requer)) continue;
    return { ...n, textoDaArea: texto };
  }
  return null;
}
