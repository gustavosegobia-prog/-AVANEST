// ===========================================================================
// Avisos: o que espera você, num lugar só
// ===========================================================================
// A escolha de fundo aqui é NÃO ter tabela de notificação.
//
// Uma tabela de avisos parece o caminho óbvio, e é a que apodrece primeiro:
// cada lugar que cria um fato — oferecer plantão, responder um chamado, mandar
// mensagem — passa a ter de lembrar de inserir a linha do aviso também. O
// primeiro que esquecer produz um plantão oferecido sem aviso nenhum, e o
// defeito é invisível: não dá erro, só não avisa. Pior ainda, o aviso guardado
// envelhece separado do fato — a troca é cancelada e o aviso continua lá
// dizendo que alguém espera resposta.
//
// Aqui os avisos são DERIVADOS das tabelas que já guardam a verdade. Uma troca
// pendente é um aviso porque está pendente; quando alguém responde, ela deixa
// de ser aviso no mesmo instante, sem ninguém precisar apagar nada. Não há o
// que sincronizar porque não há cópia.
//
// O preço disso é que "lido" precisa de outro lugar para morar — e só para os
// avisos que não somem sozinhos. Um plantão oferecido some quando você responde;
// já "o Matheus assumiu seu plantão" é notícia, não tarefa, e ficaria para
// sempre se não houvesse um marcador. É esse, e só esse, o papel de `vistoEm`.
// ===========================================================================

export type TipoDeAviso =
  | "troca_pedida" | "troca_resolvida" | "chat" | "suporte"
  | "a_faturar" | "a_receber" | "plantao_a_receber" | "a_confirmar";

export type Aviso = {
  /** Estável entre recargas: é o id da linha que originou o aviso. */
  id: string;
  tipo: TipoDeAviso;
  titulo: string;
  detalhe: string;
  /** ISO. Ordena a lista e decide o que é novo. */
  quando: string;
  /** Para onde o clique leva. */
  area: "plantoes" | "chat" | "suporte" | "producao";
  /**
   * Pede uma resposta sua, ou só informa?
   *
   * A diferença muda o que a tela faz: o que pede resposta conta no número
   * vermelho e não some sozinho; o que informa some quando você abre a lista.
   * Misturar os dois faz o contador virar enfeite — um "3" que não some depois
   * de resolver as três coisas ensina a pessoa a ignorar o contador.
   */
  acao: boolean;
};

export type TrocaParaAviso = {
  id: string;
  plantao_id: string;
  solicitante_id: string;
  destinatario_id: string | null;
  status: string;
  respondido_por: string | null;
  respondido_em: string | null;
  created_at: string;
};

export type PlantaoParaAviso = { data: string; hora_inicio: string; hora_fim: string };

export type ChamadoParaAviso = {
  id: string; assunto: string; status: string;
  ultima_em: string; visto_autor_em: string | null;
};

export type EntradaDeAvisos = {
  perfilId: string;
  trocas: TrocaParaAviso[];
  /** Plantão por id, para o aviso dizer QUAL dia — "12/09" e não "um plantão". */
  plantoes: Map<string, PlantaoParaAviso>;
  /**
   * Nome por id, JÁ pronto para aparecer na tela.
   *
   * Quem monta o mapa é quem encurta — o cadastro guarda "GUSTAVO SEGOBIA DA
   * SILVA" e o aviso mostra "Gustavo Segobia". A regra de encurtar já existe
   * uma vez em lib/escala; tê-la aqui de novo criaria duas versões do mesmo
   * nome, e a hora em que elas discordassem seria a hora em que o mesmo colega
   * apareceria diferente no aviso e no calendário.
   */
  nomes: Map<string, string>;
  /** Mensagens da sala depois do seu último olhar, e quando foi a última. */
  chat: { novas: number; ultima: string | null };
  chamados: ChamadoParaAviso[];
  /** Quando você abriu esta lista pela última vez. */
  vistoEm: string | null;
};

/** "2026-09-12" -> "12/09" */
const diaCurto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "07:00:00" -> "07h"; "07:30" -> "07h30" */
const horaCurta = (hhmmss: string) => {
  const [h, m] = hhmmss.split(":");
  return m && m !== "00" ? `${h}h${m}` : `${h}h`;
};

function quandoEOnde(plantao: PlantaoParaAviso | undefined): string {
  if (!plantao) return "plantão";
  return `${diaCurto(plantao.data)}, ${horaCurta(plantao.hora_inicio)}–${horaCurta(plantao.hora_fim)}`;
}

/**
 * Tudo o que espera você, do mais recente para o mais antigo.
 *
 * Função pura de propósito. Quem decide se um plantão oferecido pelo próprio
 * usuário deve aparecer na lista dele — não deve — é uma regra de produto, e
 * regra de produto conferida só abrindo o navegador é regra que ninguém
 * confere. Aqui ela cabe num teste de três linhas.
 */
export function montarAvisos(entrada: EntradaDeAvisos): Aviso[] {
  const { perfilId, trocas, plantoes, nomes, chat, chamados, vistoEm } = entrada;
  const avisos: Aviso[] = [];
  // Quem saiu do cadastro não deixa o aviso sem sujeito: vira "Um colega", e a
  // frase continua de pé. Um aviso que começa com "undefined" é pior do que
  // um aviso genérico.
  const nome = (id: string | null) => (id && nomes.get(id)) || "Um colega";

  for (const t of trocas) {
    const onde = quandoEOnde(plantoes.get(t.plantao_id));

    // 1. Alguém oferece um plantão e espera VOCÊ. Nunca o seu próprio pedido:
    //    ver o próprio anúncio na caixa de avisos é o contador pedindo uma ação
    //    que não é sua.
    if (t.status === "pendente"
        && t.solicitante_id !== perfilId
        && (t.destinatario_id === null || t.destinatario_id === perfilId)) {
      avisos.push({
        id: t.id, tipo: "troca_pedida", area: "plantoes", acao: true,
        quando: t.created_at,
        titulo: t.destinatario_id === perfilId
          ? `${nome(t.solicitante_id)} quer passar um plantão para você`
          : `${nome(t.solicitante_id)} ofereceu um plantão ao grupo`,
        detalhe: onde,
      });
      continue;
    }

    // 2. O SEU pedido foi respondido. Notícia, não tarefa: some ao ser vista.
    //    Sem isto, quem oferece um plantão e sai do sistema só descobre que
    //    alguém assumiu quando abre a escala — ou no dia, no pior caso.
    if (t.solicitante_id === perfilId
        && (t.status === "aceita" || t.status === "recusada")
        && t.respondido_em
        && (!vistoEm || t.respondido_em > vistoEm)) {
      avisos.push({
        id: t.id, tipo: "troca_resolvida", area: "plantoes", acao: false,
        quando: t.respondido_em,
        titulo: t.status === "aceita"
          ? `${nome(t.respondido_por)} assumiu seu plantão`
          : `${nome(t.respondido_por)} não pôde assumir seu plantão`,
        detalhe: onde,
      });
    }
  }

  // 3. Chat da equipe. Uma linha só, com a contagem — trinta mensagens novas
  //    não são trinta avisos, são uma conversa que você não leu.
  if (chat.novas > 0 && chat.ultima) {
    avisos.push({
      id: "chat", tipo: "chat", area: "chat", acao: false, quando: chat.ultima,
      titulo: chat.novas === 1 ? "Uma mensagem nova da equipe" : `${chat.novas} mensagens novas da equipe`,
      detalhe: "Sala da equipe",
    });
  }

  // 4. Suporte respondeu e você ainda não olhou. Este tem marcador próprio na
  //    tabela de chamados, escrito quando a conversa é aberta — por isso não
  //    depende do `vistoEm` geral: abrir a caixa de avisos não é ler a resposta.
  for (const c of chamados) {
    if (c.status === "respondido" && (!c.visto_autor_em || c.ultima_em > c.visto_autor_em)) {
      avisos.push({
        id: c.id, tipo: "suporte", area: "suporte", acao: true, quando: c.ultima_em,
        titulo: "O suporte respondeu você", detalhe: c.assunto,
      });
    }
  }

  return avisos.sort((a, b) => b.quando.localeCompare(a.quando));
}

// ---------------------------------------------------------------------------
// Lembretes de dinheiro
// ---------------------------------------------------------------------------

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
               "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const nomeDoMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes} `
  + `de ${mes.slice(0, 4)}`;

const dinheiro = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const contar = (n: number, um: string, muitos: string) =>
  `${n} ${n === 1 ? um : muitos}`;

export type LinhaDeDinheiro = { data: string; situacao: string; valor: number };

/**
 * O que ficou para trás no dinheiro, mês a mês.
 *
 * Isto existe porque o esquecimento aqui é caro e silencioso. O anestesiologista
 * anota o paciente no dia, e a cobrança acontece semanas depois, noutra tela,
 * quando ninguém mais se lembra de que ela existe. Particular é o pior caso: o
 * convênio ainda deixa rastro no faturamento do hospital, o particular não
 * deixa rastro nenhum — o valor simplesmente não entra, e ninguém nota.
 *
 * SÓ MÊS FECHADO. O mês corrente não está atrasado, está acontecendo: cobrar um
 * paciente de anteontem não é dívida, é o fluxo normal. Um lembrete que aparece
 * no dia seguinte ao ato ensina a pessoa a ignorar lembretes — e aí o de agosto,
 * que era de verdade, passa junto.
 *
 * Três meses no máximo, do mais recente para o mais antigo. Quem largou o
 * faturamento por dois anos não precisa de vinte e quatro linhas dizendo isso:
 * precisa abrir a tela. Vinte e quatro linhas são um muro, e muro se ignora
 * inteiro.
 */
export function lembretesDoDinheiro(entrada: {
  /** "AAAA-MM-DD". Vem de fora para o teste não depender do relógio. */
  hoje: string;
  /** Os SEUS plantões. Valor combinado, e quem recebeu já está marcado. */
  plantoes: LinhaDeDinheiro[];
  /** As SUAS anotações de produção: quem você anestesiou e por quanto. */
  producao: LinhaDeDinheiro[];
}): Aviso[] {
  const mesCorrente = entrada.hoje.slice(0, 7);
  const avisos: Aviso[] = [];

  const porMes = (linhas: LinhaDeDinheiro[], vale: (s: string) => boolean) => {
    const mapa = new Map<string, { quantos: number; valor: number }>();
    for (const l of linhas) {
      const mes = l.data.slice(0, 7);
      // `>=` e não `>`: o mês corrente fica de fora inteiro. O futuro também —
      // um plantão lançado para outubro não é uma conta atrasada.
      if (mes >= mesCorrente || !vale(l.situacao)) continue;
      const antes = mapa.get(mes) ?? { quantos: 0, valor: 0 };
      mapa.set(mes, { quantos: antes.quantos + 1, valor: antes.valor + Number(l.valor || 0) });
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
  };

  // 1. Anestesiou e ainda não cobrou. O primeiro da lista porque é o único em
  //    que o dinheiro ainda não saiu de lugar nenhum: não há guia, não há nota,
  //    não há ninguém do outro lado esperando pagar.
  for (const [mes, { quantos, valor }] of porMes(entrada.producao, (s) => s === "a_cobrar")) {
    avisos.push({
      id: `faturar-${mes}`, tipo: "a_faturar", area: "producao", acao: true,
      quando: `${mes}-28T12:00:00Z`,
      titulo: `${contar(quantos, "paciente", "pacientes")} de ${nomeDoMes(mes)} sem cobrança`,
      detalhe: `${dinheiro(valor)} anotados e ainda não faturados`,
    });
  }

  // 2. Cobrou e não recebeu. Glosado fica de fora: glosa não se espera, se
  //    recorre — e um lembrete que diz "aguardando" sobre uma glosa mente.
  for (const [mes, { quantos, valor }] of porMes(entrada.producao, (s) => s === "faturado")) {
    avisos.push({
      id: `receber-${mes}`, tipo: "a_receber", area: "producao", acao: true,
      quando: `${mes}-27T12:00:00Z`,
      titulo: `${dinheiro(valor)} de ${nomeDoMes(mes)} faturados e não recebidos`,
      detalhe: `${contar(quantos, "paciente", "pacientes")} aguardando pagamento`,
    });
  }

  // 3. Plantão trabalhado e não pago. Cancelado não conta — não houve trabalho.
  for (const [mes, { quantos, valor }] of porMes(
    entrada.plantoes, (s) => s !== "pago" && s !== "cancelado",
  )) {
    if (valor <= 0) continue; // Plantão sem valor combinado não é conta a receber.
    avisos.push({
      id: `plantao-${mes}`, tipo: "plantao_a_receber", area: "plantoes", acao: true,
      quando: `${mes}-26T12:00:00Z`,
      titulo: `${contar(quantos, "plantão", "plantões")} de ${nomeDoMes(mes)} sem receber`,
      detalhe: `${dinheiro(valor)} combinados`,
    });
  }

  return avisos;
}

export type PlantaoParaConfirmar = {
  data: string; situacao: string; confirmado_em: string | null;
};

/**
 * "Confirme o plantão que você fez."
 *
 * Separado dos lembretes de dinheiro por causa de UMA regra que é o oposto da
 * de lá: aqui o mês corrente conta, e o dia de hoje conta mais que todos. O
 * lembrete de faturamento espera o mês fechar porque cobrar anteontem não é
 * atraso; a confirmação é o contrário — ela vale no dia, enquanto a pessoa
 * lembra se ficou até as 13h ou até as 19h, se trocou com alguém, se a sala
 * fechou. Uma semana depois ninguém lembra, e a folha de pagamento sai de uma
 * memória e não de um registro.
 *
 * Um aviso só para todos os pendentes, e não um por plantão. Quem voltou de
 * férias tem doze para confirmar, e doze linhas iguais na caixa empurram para
 * fora tudo o mais que estava lá.
 */
export function lembreteDeConfirmacao(entrada: {
  hoje: string;
  /** Só os SEUS plantões. Confirmar plantão de outro o banco recusa. */
  plantoes: PlantaoParaConfirmar[];
}): Aviso[] {
  const pendentes = entrada.plantoes.filter((p) =>
    !p.confirmado_em && p.situacao !== "cancelado" && p.data <= entrada.hoje);
  if (pendentes.length === 0) return [];

  // O mais recente decide a posição na lista: um plantão de hoje sobe para o
  // alto da caixa, que é onde ele precisa estar hoje.
  const maisNovo = pendentes.reduce((a, b) => (a.data > b.data ? a : b));
  const deHoje = maisNovo.data === entrada.hoje;

  return [{
    id: "confirmar", tipo: "a_confirmar", area: "plantoes", acao: true,
    quando: `${maisNovo.data}T23:00:00Z`,
    titulo: pendentes.length === 1
      ? (deHoje ? "Confirme o plantão de hoje" : `Confirme o plantão de ${diaCurto(maisNovo.data)}`)
      : `${pendentes.length} plantões esperando sua confirmação`,
    detalhe: "Só o que você confirmar entra no fechamento do mês",
  }];
}

/**
 * O número vermelho: só o que pede resposta SUA.
 *
 * Contar notícia junto faria o contador não zerar nunca — e um contador que
 * não zera é um contador que a pessoa aprende a ignorar, inclusive no dia em
 * que ele estiver certo.
 */
export function quantosPedemResposta(avisos: Aviso[]): number {
  return avisos.filter((a) => a.acao).length;
}
