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
};

export const NOVIDADES: Novidade[] = [
  {
    id: "questionario-whatsapp",
    ate: "2026-12-11",
    titulo: "Questionário pré-anestésico pelo WhatsApp",
    texto: {
      recepcao:
        "Na agenda, toque em Mais ▾ na consulta e escolha Enviar questionário pelo WhatsApp. O paciente responde pelo celular antes de vir, e ao lado do nome você vê se ele já respondeu.",
      medico:
        "A recepção já pode mandar ao paciente um questionário pelo WhatsApp. Quando ele responde, a avaliação abre com os alertas (alergia, remédio que afina o sangue, caneta para emagrecer) e o botão Trazer as respostas, que preenche só o que está vazio.",
    },
  },
];

export const chaveDaNovidade = (perfilId: string, id: string) => `novidade-vista:${perfilId}:${id}`;

/** A novidade a mostrar agora nesta área, ou nenhuma. */
export function novidadeDaArea(
  area: string,
  hoje: string,
  vistas: (id: string) => boolean,
  lista: Novidade[] = NOVIDADES,
): (Novidade & { textoDaArea: string }) | null {
  for (const n of lista) {
    const texto = n.texto[area as AreaDaNovidade];
    if (!texto || hoje >= n.ate || vistas(n.id)) continue;
    return { ...n, textoDaArea: texto };
  }
  return null;
}
