// ===========================================================================
// O tutorial do primeiro acesso
// ===========================================================================
// As etapas moram aqui, e não dentro do componente, por um motivo prático: o
// que este arquivo decide é O QUE a pessoa vê no primeiro minuto de uso, e isso
// depende do papel dela. Um anestesiologista que abre o sistema e recebe
// instruções sobre faturamento conclui que errou de tela.
//
// Regra que vale para todas as etapas: cada uma aponta para algo que existe
// hoje, na área que aquela pessoa tem. Tutorial que ensina a clicar num botão
// que não está lá é pior do que tutorial nenhum — ele ensina que o sistema está
// quebrado.
// ===========================================================================

export type Etapa = {
  /** Onde a pessoa está, na linguagem dela. */
  titulo: string;
  /** O que fazer ali, em uma ou duas frases. */
  texto: string;
  /** A área que a etapa apresenta. Nula quando é abertura ou fecho. */
  area?: "medico" | "recepcao" | "financeiro" | "admin" | "plantoes";
  /**
   * O seletor do que a etapa aponta na tela.
   *
   * Quando ele acha o elemento, o tutorial recorta a escuridão em volta dele e
   * encosta a janela ao lado — a pessoa lê "em Médico você faz a avaliação"
   * olhando para o botão Médico aceso. Não achando, a janela volta ao centro e
   * a etapa continua valendo: o texto sozinho já era suficiente antes, e é ele
   * que sobrevive a um botão que mudou de lugar.
   */
  alvo?: string;
};

export type Papel = { role: string; areas: string[]; nome: string };

/** O primeiro nome, para o "Bem-vindo" não gritar o nome inteiro do cadastro. */
const primeiroNome = (nome: string) => {
  const p = (nome || "").trim().split(/\s+/).filter(Boolean);
  const semTitulo = p.filter((x, i) => !(i === 0 && /^(dr|dra|drs|dras)\.?$/i.test(x)));
  const escolhido = (semTitulo[0] ?? p[0] ?? "").trim();
  return escolhido ? escolhido.charAt(0).toUpperCase() + escolhido.slice(1).toLowerCase() : "";
};

/**
 * As etapas do tutorial, para esta pessoa.
 *
 * A ordem segue o dia de trabalho, e não o menu: o anestesiologista vê primeiro
 * a avaliação, que é o que ele faz antes do paciente entrar, e a escala depois.
 * Quem organiza a lista pelo menu ensina o menu; quem organiza pelo dia ensina
 * o trabalho.
 *
 * Só entram etapas das áreas que a pessoa tem. Uma recepcionista não recebe a
 * etapa da escala, e um anestesiologista sem acesso ao financeiro não recebe a
 * do faturamento — ele clicaria e encontraria uma porta fechada.
 */
export function passosDoTutorial(papel: Papel): Etapa[] {
  const tem = (a: string) => papel.areas.includes(a);
  const nome = primeiroNome(papel.nome);

  const etapas: Etapa[] = [{
    titulo: nome ? `Bem-vindo, ${nome}` : "Bem-vindo ao AVANEST",
    // A abertura diz quanto tempo custa. Sem isso, a primeira reação a um
    // tutorial é procurar o X — e quem fecha no primeiro passo não volta.
    texto: "Um minuto para mostrar onde fica cada coisa. Você pode sair a qualquer momento, e reabrir depois pelo menu do seu nome.",
  }];

  if (tem("medico")) {
    etapas.push({
      area: "medico",
      alvo: '[data-area="medico"]',
      titulo: "A avaliação pré-anestésica",
      texto: "Em Médico você cadastra o paciente e faz a avaliação em nove etapas. O texto é salvo enquanto você digita: fechar a tela no meio não perde nada. No fim saem a ficha, o termo de consentimento e as orientações, prontos para imprimir.",
    });
  }

  if (tem("recepcao")) {
    etapas.push({
      area: "recepcao",
      alvo: '[data-area="recepcao"]',
      titulo: "A fila do dia",
      texto: "Em Recepção ficam o cadastro do paciente e a agenda. Marque quem chegou como presente — é isso que põe o paciente na fila do anestesiologista.",
    });
  }

  if (tem("plantoes")) {
    etapas.push({
      area: "plantoes",
      alvo: '[data-area="plantoes"]',
      titulo: "A escala",
      texto: "Escala do serviço, uma por hospital, e Minha escala, que reúne todos os seus plantões num calendário só. Clique num dia para lançar, passar um plantão a um colega ou confirmar o que você fez.",
    });
    etapas.push({
      area: "plantoes",
      alvo: ".plantaoGrade",
      titulo: "Confirmar o plantão vale no dia",
      // Esta etapa existe por causa de uma regra que surpreende, e surpresa
      // sobre pagamento é a pior de todas. Melhor descobrir aqui do que no
      // fim do mês.
      texto: "A confirmação só pode ser feita no dia do plantão, até o fim do turno. É ela que faz o turno entrar no fechamento do mês — o que ninguém confirmar aparece no relatório marcado como pendente.",
    });
    etapas.push({
      area: "plantoes",
      alvo: '[data-secao="producao"]',
      titulo: "A produção do dia",
      texto: "Ainda na Escala, anote quem você anestesiou: paciente, convênio e cirurgia numa linha. Dá para fotografar a ficha de internação e os campos vêm preenchidos.",
    });
  }

  if (tem("financeiro")) {
    etapas.push({
      area: "financeiro",
      alvo: '[data-area="financeiro"]',
      titulo: "O financeiro",
      texto: "Aqui ficam o faturamento do serviço, os recebimentos e o fechamento do mês.",
    });
  }

  if (tem("admin")) {
    etapas.push({
      area: "admin",
      alvo: '[data-area="admin"]',
      titulo: "A organização",
      texto: "Em Admin ficam a equipe, os convites e os locais de atendimento. Cadastre os hospitais com o logo: é ele que aparece no cabeçalho da ficha, do termo e dos relatórios.",
    });
  }

  etapas.push({
    alvo: ".avisosSino",
    titulo: "O sino, no alto da tela",
    texto: "Plantão oferecido por um colega, resposta do suporte, mensagem da equipe e o que ficou para trás no faturamento aparecem ali. O número conta só o que espera resposta sua.",
  });

  return etapas;
}

/** A chave do aparelho. A versão no nome permite reapresentar o tutorial quando ele mudar de verdade. */
export const CHAVE_TUTORIAL = "avanest_tutorial_v1";
