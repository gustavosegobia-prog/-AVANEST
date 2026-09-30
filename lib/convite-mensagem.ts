// A mensagem do convite por link, pronta para o WhatsApp.
//
// Veio de InvitePanel, sem mudar o texto. A razão de ser curta continua a
// mesma: o primeiro convite de verdade mostrou que o WhatsApp entrega tudo
// num parágrafo só, e que oito linhas antes do link afastam o dedo do link.
// Uma frase por papel, dizendo onde a pessoa vai trabalhar — o papel muda o
// sistema inteiro, e prometer a escala a quem não a terá é começar com uma
// decepção.

export const ONDE_TRABALHA: Record<string, string> = {
  medico: "É onde ficam a escala do serviço, os seus plantões e as avaliações pré-anestésicas, com ficha e termo prontos para imprimir.",
  recepcao: "É onde ficam o cadastro dos pacientes e a agenda das consultas pré-anestésicas.",
  financeiro: "É onde ficam o faturamento do serviço e o controle dos recebimentos.",
  admin: "É onde ficam a equipe, os locais de atendimento e a organização do serviço.",
  owner: "É onde ficam a equipe, os locais de atendimento e a organização do serviço.",
};

export const NOME_DO_PAPEL_NO_CONVITE: Record<string, string> = {
  medico: "Anestesiologista", recepcao: "Recepção", financeiro: "Financeiro",
  admin: "Administrador", owner: "Proprietário",
};

export const linkDoConvite = (origem: string, token: string) => `${origem}/convite/${token}`;

export function mensagemDoConvite(
  convite: { role: string; email: string; expires_at: string },
  organizacao: string | null,
  link: string,
): string {
  const papel = NOME_DO_PAPEL_NO_CONVITE[convite.role] ?? convite.role;
  const validade = new Date(convite.expires_at).toLocaleDateString("pt-BR");
  return [
    `Olá! Você foi convidado para o AVANEST — ${organizacao ?? "nossa organização"}, como ${papel}.`,
    "",
    ONDE_TRABALHA[convite.role] ?? "",
    "",
    `Crie seu acesso: ${link}`,
    "",
    `Válido até ${validade}, apenas para o e-mail ${convite.email}.`,
  // Sem a linha vazia quando não há frase para o papel: duas quebras seguidas
  // viram um buraco no meio da mensagem.
  ].filter((l, i, todas) => l !== "" || todas[i - 1] !== "").join("\n");
}
