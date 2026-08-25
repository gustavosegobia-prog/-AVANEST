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

export type TipoDeAviso = "troca_pedida" | "troca_resolvida" | "chat" | "suporte";

export type Aviso = {
  /** Estável entre recargas: é o id da linha que originou o aviso. */
  id: string;
  tipo: TipoDeAviso;
  titulo: string;
  detalhe: string;
  /** ISO. Ordena a lista e decide o que é novo. */
  quando: string;
  /** Para onde o clique leva. */
  area: "plantoes" | "chat" | "suporte";
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
