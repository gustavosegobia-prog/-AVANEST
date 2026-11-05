// ===========================================================================
// Como os dados são protegidos — a lista única
// ===========================================================================
// Três páginas falam disso: a Política de Privacidade (seção "Como os dados
// são protegidos"), o /recursos (bloco "O sigilo e a segurança") e o
// /seguranca, o resumo para hospital e cooperativa. Cada uma tinha a sua lista,
// escrita à mão, e uma dizia coisas que a outra não dizia. Agora as três leem
// esta, e o que muda aqui muda nas três.
//
// SÓ ENTRA O QUE O SISTEMA FAZ HOJE. Cada item já estava escrito na política
// ou no /recursos antes desta lista existir; nada aqui é novo como promessa.
//
// A VERIFICAÇÃO EM DUAS ETAPAS NÃO ENTRA, e não é esquecimento: ela está
// desligada desde 18/10/2026 (`DUAS_ETAPAS_LIGADA` em lib/duas-etapas.ts) e os
// cadastros de código foram apagados. Prometer a hospital uma proteção que
// não está ligada é pior do que não falar dela. Religada, ela entra aqui — e o
// teste de lib/seguranca.test.ts confere as duas coisas juntas.
// ===========================================================================

export type MedidaDeSeguranca = {
  id: string;
  /** O título do cartão, no /recursos e no /seguranca. */
  titulo: string;
  /** A explicação, no /recursos e no /seguranca. */
  texto: string;
  /**
   * A mesma medida em uma linha, como ela sai na Política de Privacidade.
   * `destaque` vai em negrito, antes do resto.
   */
  naPolitica: { destaque?: string; texto: string };
};

export const MEDIDAS_DE_SEGURANCA: readonly MedidaDeSeguranca[] = [
  {
    id: "isolamento",
    titulo: "Os dados da sua clínica não se misturam com os de outra",
    texto: "Todo pedido de informação sai identificado com a sua organização, e quem não é dela não "
      + "recebe resposta. A trava fica no banco de dados, e não apenas na tela: esconder um botão "
      + "impede o clique, não o pedido.",
    naPolitica: {
      destaque: "Isolamento por organização aplicado no banco de dados",
      texto: ", e não apenas na tela: cada consulta é filtrada pela organização de quem a fez.",
    },
  },
  {
    id: "perfis",
    titulo: "Cada um vê apenas o que precisa para trabalhar",
    texto: "A recepção conduz a fila do dia sem abrir a avaliação clínica, e o financeiro não vê a "
      + "avaliação. É o princípio da necessidade previsto na LGPD: quanto menos gente com acesso ao "
      + "dado do paciente, menor o risco para ele e para você.",
    naPolitica: { texto: "Perfis de acesso: a recepção não vê conteúdo clínico; o financeiro não vê avaliação." },
  },
  {
    id: "auditoria",
    titulo: "Fica registrado quem fez o quê, e quando",
    texto: "Cada cadastro, alteração e exclusão guarda o autor, a data e a hora. Se um dia alguém "
      + "perguntar quem mudou aquele campo, a resposta existe.",
    naPolitica: { texto: "Registro de auditoria das ações relevantes." },
  },
  {
    id: "cifragem",
    titulo: "Conexão cifrada e dados cifrados em repouso",
    texto: "O tráfego entre o aparelho e o sistema passa por HTTPS, e os dados guardados ficam "
      + "cifrados em repouso pela infraestrutura.",
    naPolitica: { texto: "Tráfego cifrado (HTTPS) e dados cifrados em repouso pela infraestrutura." },
  },
  {
    id: "senhas",
    titulo: "Ninguém no AVANEST consegue ler a sua senha",
    texto: "A senha é guardada com hash, e não como foi digitada.",
    naPolitica: { texto: "Senhas guardadas com hash — ninguém no AVANEST consegue ler a sua." },
  },
  {
    id: "anti-robo",
    titulo: "Verificação anti-robô nas portas de entrada",
    texto: "O login, o cadastro e a recuperação de senha passam por uma verificação anti-robô.",
    naPolitica: { texto: "Verificação anti-robô no login, no cadastro e na recuperação de senha." },
  },
  {
    id: "backup",
    titulo: "Backup automático",
    texto: "A base de dados tem cópias de segurança automáticas.",
    naPolitica: { texto: "Backups automáticos da base." },
  },
];

/**
 * O encarregado pelo tratamento de dados pessoais (DPO), como a Política de
 * Privacidade o declara na seção "Encarregado (DPO) e contato". O CNPJ é o
 * mesmo do rodapé e da marcação da empresa (lib/schema.ts) — o teste confere.
 */
export const ENCARREGADO = {
  quem: "G. Segobia Serviços Médicos Ltda.",
  cnpj: "55.965.276/0001-04",
  email: "contato@avanest.com.br",
} as const;
