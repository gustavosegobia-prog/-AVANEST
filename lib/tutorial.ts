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
//
// ---------------------------------------------------------------------------
// POR QUE ELE FICOU MAIS LONGO
//
// A primeira versão tinha uma etapa por área e dizia ONDE ficava cada coisa.
// Um mês de uso mostrou que isso não basta: as perguntas que chegaram — "onde
// dou baixa quando a produção é paga?", "como mando a planilha para o
// contador?", "onde escolho o mês?" — são todas de gente que ACHOU a área e
// não soube o que fazer dentro dela. Saber onde fica a Escala não ensina a
// passar um plantão a um colega.
//
// A ordem continua sendo a do dia de trabalho, e não a do menu. Quem organiza
// pelo menu ensina o menu; quem organiza pelo dia ensina o trabalho.
//
// AS ETAPAS DE PREPARO VÊM PRIMEIRO, e só para quem administra. Um serviço que
// entra sem valor de consulta cadastrado vê o Financeiro inteiro em R$ 0,00 e
// conclui que a conta está quebrada — quando o que falta é uma tabela que
// ninguém preencheu. Corrigir isso depois custa mais que ensinar antes.
// ===========================================================================

export type Etapa = {
  /** Onde a pessoa está, na linguagem dela. */
  titulo: string;
  /** O que fazer ali, em uma ou duas frases. */
  texto: string;
  /** A área que a etapa apresenta. Nula quando é abertura, preparo ou fecho. */
  area?: "medico" | "recepcao" | "financeiro" | "admin" | "plantoes";
  /**
   * O seletor do que a etapa aponta na tela.
   *
   * Quando ele acha o elemento, o tutorial recorta a escuridão em volta dele e
   * encosta a janela ao lado — a pessoa lê "em Médico você faz a avaliação"
   * olhando para o botão Médico aceso. Não achando, a janela volta ao centro e
   * a etapa continua valendo: o texto sozinho já era suficiente antes, e é ele
   * que sobrevive a um botão que mudou de lugar.
   *
   * Todo seletor daqui foi conferido contra o código. Um alvo que não existe
   * não quebra nada, mas apaga em silêncio o destaque que é metade da etapa —
   * foi o que aconteceu com `[data-secao="producao"]`, que nunca existiu.
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
 * Só entram etapas das áreas que a pessoa tem. Uma recepcionista não recebe a
 * etapa da escala, e um anestesiologista sem acesso ao financeiro não recebe a
 * do faturamento — ele clicaria e encontraria uma porta fechada.
 */
export function passosDoTutorial(papel: Papel): Etapa[] {
  const tem = (a: string) => papel.areas.includes(a);
  const nome = primeiroNome(papel.nome);
  // Quem monta a casa. As etapas de preparo são só destes: mandar um
  // anestesiologista cadastrar valor de convênio é mandá-lo a uma tela que o
  // recusa.
  const monta = ["owner", "admin"].includes(papel.role) || tem("admin");

  const etapas: Etapa[] = [{
    titulo: nome ? `Bem-vindo, ${nome}` : "Bem-vindo ao AVANEST",
    // Texto provisório: o definitivo é escrito no fim desta função, quando já
    // se sabe quantas etapas esta pessoa vai receber.
    texto: "",
  }];

  // ── 1. Recepção: por onde o paciente entra ───────────────────────────────
  if (tem("recepcao")) {
    etapas.push({
      area: "recepcao",
      alvo: '[data-area="recepcao"]',
      titulo: "Recepção: por onde o paciente entra",
      texto: "É a primeira porta. Na coluna da esquerda: Agenda com as consultas do dia, Consultas de hoje para marcar quem chegou, e Pesquisar paciente para achar quem já é cadastrado.",
    });
    etapas.push({
      area: "recepcao",
      titulo: "Novo paciente",
      texto: "O botão + Novo paciente abre a ficha inteira: dados pessoais, endereço, hospital e cirurgia. O CPF é conferido na hora — se já existir, o sistema avisa antes de duplicar o cadastro.",
    });
    etapas.push({
      area: "recepcao",
      titulo: "Convênio ou particular",
      texto: "Escolhendo um convênio, aparecem carteirinha e plano. Escolhendo Particular, aparecem o valor e a forma de pagamento: preenchidos, o recebimento entra no Financeiro na hora, já quitado. Em branco, é só um agendamento.",
    });
    etapas.push({
      area: "recepcao",
      titulo: "Data, horário e a fila",
      texto: "Deixe o horário em branco e o sistema usa o próximo livre da agenda. Depois, quando a pessoa chegar, marque Presente em Consultas de hoje — é isso que a põe na fila do anestesiologista.",
    });
  }

  // ── 2. Médico: a avaliação ───────────────────────────────────────────────
  if (tem("medico")) {
    etapas.push({
      area: "medico",
      alvo: '[data-area="medico"]',
      titulo: "Médico: a sua fila",
      texto: "Aqui estão os pacientes que a recepção marcou como presentes. Em cada um: Seguir consulta, se a avaliação já foi começada, ou Nova avaliação.",
    });
    etapas.push({
      area: "medico",
      titulo: "Paciente que não passou pela recepção",
      // O caso do hospital, que não tem balcão. Sem esta etapa a pessoa
      // conclui que precisa de uma recepcionista para avaliar alguém.
      texto: "Dentro do hospital não há balcão. Use + Novo paciente aqui mesmo: você cadastra e já entra na avaliação, sem passar pela Recepção.",
    });
    etapas.push({
      area: "medico",
      titulo: "A avaliação, em nove etapas",
      texto: "Identificação, anamnese, medicamentos, exames, exame físico, via aérea, escores, plano anestésico e conclusão. O texto é salvo enquanto você digita: fechar a tela no meio não perde nada.",
    });
    etapas.push({
      area: "medico",
      titulo: "O que já vem respondido",
      texto: "A via aérea começa preenchida como normal — você só mexe no que for diferente. Os preditores são etiquetas: marque as presentes, o resto é ausência. O risco de via aérea difícil e os escores ASA, Lee, STOP-Bang e Apfel são calculados sozinhos, como sugestão.",
    });
    etapas.push({
      area: "medico",
      alvo: '[data-area="medico"]',
      titulo: "Central Operacional e histórico",
      texto: "Na coluna da esquerda: Central Operacional reúne o que ficou para trás — avaliação começada e não concluída, exame pendente, alerta de alergia. E Histórico de avaliações guarda tudo o que já foi feito, com busca.",
    });
    etapas.push({
      area: "medico",
      titulo: "No fim, três papéis",
      texto: "Concluída a avaliação saem a ficha, o termo de consentimento e as orientações ao paciente, prontos para imprimir. O medicamento que precisa ser suspenso já sai com o prazo escrito.",
    });
  }

  // ── 3. Escala ────────────────────────────────────────────────────────────
  if (tem("plantoes")) {
    etapas.push({
      area: "plantoes",
      alvo: '[data-area="plantoes"]',
      titulo: "Escala: uma por hospital",
      texto: "Na coluna da esquerda há uma escala para cada hospital cadastrado, e Minha escala, que junta todos os seus plantões de todos os lugares num calendário só.",
    });
    etapas.push({
      area: "plantoes",
      alvo: ".plantaoGrade",
      titulo: "Montar a escala",
      texto: "Clique num dia do calendário para lançar um plantão. Quem administra lança para qualquer colega; cada um lança para si. Modelos guarda os turnos que se repetem, para não redigitar horário toda vez.",
    });
    etapas.push({
      area: "plantoes",
      alvo: ".plantaoGrade",
      titulo: "Confirmar o plantão vale no dia",
      // Regra que surpreende, e surpresa sobre pagamento é a pior de todas.
      texto: "A confirmação só pode ser feita no dia do plantão, até o fim do turno. É ela que faz o turno entrar no fechamento do mês — o que ninguém confirmar aparece no relatório marcado como pendente.",
    });
    etapas.push({
      area: "plantoes",
      titulo: "Trocas de plantão",
      texto: "Escala → Trocas. No plantão, use Trocar: ofereça ao grupo inteiro, e qualquer um assume, ou convide uma pessoa. Quem recebe vê na aba Trocas e no sino, e a escala se ajusta sozinha quando alguém aceita.",
    });
    etapas.push({
      area: "plantoes",
      titulo: "Produção do dia",
      texto: "Escala → Produção. Anote quem você anestesiou: paciente, convênio e cirurgia numa linha. Dá para fotografar a ficha de internação e os campos vêm preenchidos.",
    });
    etapas.push({
      area: "plantoes",
      titulo: "Baixa e planilha para o contador",
      texto: "Ainda em Produção: quando o dinheiro cair, mude a situação da linha para Recebido — a data entra sozinha e o mês do caixa fica certo. Os botões Planilha baixam um Excel de verdade, por hospital, por quem paga ou por convênio, para mandar a quem emite a nota.",
    });
    etapas.push({
      area: "plantoes",
      titulo: "Meu financeiro",
      texto: "Escala → Meu financeiro. Mostra só o seu: quanto entrou, quanto falta receber, o gráfico do ano e o valor por hora de cada hospital. Mesmo num grupo, essa parte é sua e ninguém mais vê.",
    });
  }

  // ── 4. Financeiro ────────────────────────────────────────────────────────
  if (tem("financeiro")) {
    etapas.push({
      area: "financeiro",
      alvo: '[data-area="financeiro"]',
      titulo: "Financeiro: o caixa do serviço",
      texto: "A coluna da esquerda é a lista do que fazer, em três blocos: Operação, Análise e Configuração. Uma tarefa de cada vez, em vez de tudo empilhado numa tela só.",
    });
    etapas.push({
      area: "financeiro",
      titulo: "Operação: o dia a dia",
      texto: "Lançamentos traz o que veio da recepção, agrupado por convênio. Recebimentos mostra o que ainda falta receber e registra a baixa. Notas fiscais avisa quando uma nota passa de quinze dias sem pagamento.",
    });
    etapas.push({
      area: "financeiro",
      titulo: "Despesas, lotes e repasses",
      texto: "Despesas é o outro lado do caixa: aluguel, material, imposto — sem elas não é fluxo de caixa, é faturamento. Lotes de cobrança agrupa por convênio para enviar. Produção da equipe reúne o que os colegas anotaram, e Repasses divide o que cabe a cada um.",
    });
    etapas.push({
      area: "financeiro",
      titulo: "Análise: os números do mês",
      texto: "Resultado do mês fecha entradas menos saídas. Origem da receita mostra as três fontes — consulta, plantão e produção. Cobranças em atraso diz há quanto tempo cada convênio está devendo. Gráficos e Faturado por convênio mostram a evolução.",
    });
    etapas.push({
      area: "financeiro",
      titulo: "Fechamento e configuração",
      texto: "Fechamento do mês tranca a competência e registra na auditoria. Extrato de pagamentos lista o que entrou. E Valores por convênio é onde se cadastra quanto vale cada um — enquanto essa tabela estiver vazia, todo atendimento entra valendo R$ 0,00.",
    });
    etapas.push({
      area: "financeiro",
      titulo: "O olho esconde os números",
      texto: "O ícone de olho apaga os valores da tela. Use quando alguém estiver olhando junto — a tela do financeiro num consultório fica visível para mais gente do que se imagina.",
    });
  }

  // ── 5. Admin, no fim: é ajuste, não rotina ───────────────────────────────
  if (monta) {
    etapas.push({
      area: "admin",
      alvo: '[data-area="admin"]',
      titulo: "Admin: a sua organização",
      texto: "Aqui se monta a casa. Usuários e permissões lista a equipe: você adiciona, muda a função de cada um — anestesiologista, recepção, financeiro, administrador — e desativa quem saiu.",
    });
    etapas.push({
      area: "admin",
      titulo: "Convites",
      texto: "Admin → Convites. Envie por e-mail ou gere um link para mandar no WhatsApp. Quem não usa o sistema pode ser cadastrado sem e-mail: entra na escala e no faturamento, e não recebe login.",
    });
    etapas.push({
      area: "admin",
      titulo: "Locais de atendimento",
      texto: "Admin → Locais de atendimento. Cadastre cada hospital com o logo: é ele que aparece no cabeçalho da ficha, do termo e dos relatórios. Sem local cadastrado a escala não tem onde pendurar o plantão.",
    });
    etapas.push({
      area: "admin",
      titulo: "Dados, assinatura e auditoria",
      texto: "Dados da organização guarda nome, CNPJ e contato, que saem nos documentos. Assinatura mostra o plano e a data de renovação. Auditoria registra quem fez o quê, e é consulta, não rotina.",
    });
  }

  // ── Fecho: vale para qualquer papel ──────────────────────────────────────
  etapas.push({
    alvo: ".avisosSino",
    titulo: "O sino, no alto da tela",
    texto: "Plantão oferecido por um colega, resposta do suporte, mensagem da equipe e o que ficou para trás no faturamento aparecem ali. O número conta só o que espera resposta sua.",
  });

  etapas.push({
    alvo: ".userMenuTrigger",
    titulo: "Avisos no telefone",
    texto: "No menu do seu nome você liga as notificações: escala publicada e troca de plantão chegam com o aplicativo fechado. No iPhone é preciso antes adicionar o AVANEST à Tela de Início — o Safari só entrega aviso assim.",
  });

  etapas.push({
    alvo: ".userMenuTrigger",
    titulo: "Para rever isto",
    texto: "Este tutorial fica no menu do seu nome, em Ver o tutorial. Se ficar em dúvida em qualquer tela, o balão de conversa no canto chama o suporte.",
  });

  /**
   * A abertura diz o TAMANHO, e só agora dá para saber qual é.
   *
   * A primeira reação a um tutorial é procurar o X, e quem fecha no primeiro
   * passo não volta. Dizer quanto custa desarma isso — mas o custo varia muito:
   * a recepcionista recebe seis etapas e quem administra o serviço inteiro
   * recebe vinte e uma. Um "dois minutos" fixo seria verdade para uma e mentira
   * para a outra, e tutorial que mente sobre o próprio tamanho é abandonado no
   * passo dez.
   */
  etapas[0].texto = `São ${etapas.length} passos rápidos, mostrando onde fica cada coisa e como se faz o essencial. `
    + "Você pode sair a qualquer momento, e reabrir depois pelo menu do seu nome.";

  return etapas;
}

/**
 * A chave do aparelho.
 *
 * A versão sobe quando o tutorial muda DE VERDADE — como agora, que ele deixou
 * de dizer só onde ficam as coisas e passou a ensinar o que fazer. Subir a
 * versão reapresenta o tutorial a quem já tinha visto o antigo; deixar como
 * estava esconderia o conteúdo novo justamente de quem já usa o sistema.
 */
export const CHAVE_TUTORIAL = "avanest_tutorial_v3";
