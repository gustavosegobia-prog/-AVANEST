// Quem pode pedir que o servidor toque o telefone de outra pessoa.
//
// A rota /api/push/avisar usa a chave de serviço para achar os aparelhos, e
// o texto do aviso sai em nome de quem pediu ("Fulano assumiu o seu
// plantão"). A tela só pede o aviso depois de gravar o fato — mas a rota não
// conferia nada disso: qualquer pessoa da equipe, chamando a rota direto,
// fazia chegar ao colega "❌ Plantão cancelado" de um plantão que continua
// valendo, ou "Fulano recusou o seu plantão" de uma troca que Fulano nem viu.
// Um anestesiologista que acredita no primeiro não aparece no plantão.
//
// A regra é a mesma para todos os tipos: o aviso só sai de quem FEZ o que
// ele conta, e só se o fato está gravado.

export type TrocaDoAviso = {
  solicitante_id: string;
  respondido_por: string | null;
  status: string;
};

export type PlantaoDoAviso = {
  situacao: string;
};

/** O motivo da recusa, ou `null` quando o aviso pode sair. */
export function recusaDoAvisoDeTroca(
  tipo: "troca" | "troca_resolvida",
  troca: TrocaDoAviso,
  eu: string,
): string | null {
  if (tipo === "troca") {
    if (troca.solicitante_id !== eu) return "Só quem pediu a troca avisa sobre ela.";
    if (troca.status !== "pendente") return "Esta troca já não está aberta.";
    return null;
  }
  if (troca.respondido_por !== eu) return "Só quem respondeu a troca avisa a resposta.";
  if (troca.status !== "aceita" && troca.status !== "recusada") return "Esta troca ainda não foi respondida.";
  return null;
}

/**
 * Aviso sobre o plantão de OUTRA pessoa. O próprio plantão nem chega aqui —
 * a rota não avisa a pessoa sobre o que ela mesma fez.
 */
export function recusaDoAvisoDePlantao(
  tipo: "plantao_novo" | "plantao_alterado" | "plantao_cancelado",
  plantao: PlantaoDoAviso,
  podeMontarEscala: boolean,
): string | null {
  if (!podeMontarEscala) return "Só quem monta a escala avisa sobre o plantão de um colega.";
  const cancelado = plantao.situacao === "cancelado";
  if (tipo === "plantao_cancelado" && !cancelado) return "Este plantão não está cancelado.";
  if (tipo !== "plantao_cancelado" && cancelado) return "Este plantão está cancelado.";
  return null;
}
