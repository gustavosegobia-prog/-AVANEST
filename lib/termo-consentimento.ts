// ===========================================================================
// O termo de consentimento anestésico, editável por cada organização
// ===========================================================================
// O texto de fábrica abaixo é o que sempre saiu impresso, e continua sendo o
// que sai para quem nunca mexeu em nada. O que muda é que agora a organização
// PODE mexer — e é um pedido legítimo: o termo é documento jurídico da clínica,
// não da plataforma, e cada serviço tem o seu, revisado pelo advogado dele.
//
// ---------------------------------------------------------------------------
// POR QUE VERSÕES, E POR QUE NADA AQUI É APAGADO OU CORRIGIDO
//
// Este é o texto que o paciente ASSINA. Se editar o termo mudasse o que já foi
// impresso, reimprimir uma avaliação de março traria um papel diferente do que
// aquele paciente assinou em março — e o papel guardado no prontuário deixaria
// de bater com o que o sistema diz que foi assinado. Num processo, é a
// diferença entre ter e não ter consentimento documentado.
//
// Por isso cada edição GRAVA UMA VERSÃO NOVA, e nenhuma versão é alterada nem
// removida (a tabela não tem política de update nem de delete — ver
// supabase/migrations/202609140001_termo_editavel.sql). Na hora de imprimir, a
// escolha é pela data: vale a versão que estava valendo quando a avaliação foi
// concluída. É a mesma regra que já rege `local_snapshot` e
// `snapshot_conclusao`, e pela mesma razão — um documento de março não pode
// ser carimbado com o hospital, nem com o termo, de hoje.
//
// A vantagem de escolher pela data em vez de gravar o texto dentro da avaliação
// é que nada precisa mudar no momento de concluir: as duas rotas de conclusão
// (a tela e a RPC) seguem intocadas, e as avaliações antigas — que nunca
// souberam de termo nenhum — continuam imprimindo o texto de fábrica.
//
// ---------------------------------------------------------------------------
// O QUE É EDITÁVEL E O QUE NÃO É
//
// Editável: os itens numerados, a lista de riscos e o parágrafo da autorização.
// Isto é prosa, e prosa é o que o advogado da organização revisa.
//
// Não editável: o parágrafo de abertura, o cabeçalho e as linhas de assinatura.
// Esses são MONTADOS COM O CADASTRO — nome do paciente, nome e logo do local,
// cidade —, e é justamente por serem montados que não precisam ser digitados:
// quem cadastrou o grupo e o local uma vez já tem tudo isso saindo na ficha e
// no termo, sozinho. Deixá-los editáveis convidaria a digitar à mão um nome que
// o sistema já sabe, e o dia em que o cadastro mudasse o papel passaria a
// mentir.
//
// Para quem quiser citar esses dados DENTRO do texto editável, existem as
// marcações de {{chave}} logo abaixo — elas são preenchidas na impressão, com
// o mesmo cadastro. Assim "editar o termo" nunca obriga a repetir dado.
// ===========================================================================

/** As três partes de prosa que a organização pode reescrever. */
export type TermoDeConsentimento = {
  /** Itens numerados. Os dois primeiros saem como 2 e 3; o resto, de 5 em diante. */
  itens: string[];
  /** A lista do item 4 — o que pode acontecer. */
  riscos: string[];
  /** O parágrafo do fecho, logo acima das assinaturas. */
  autorizacao: string;
};

/** Uma versão gravada, com o instante em que passou a valer. */
export type VersaoDoTermo = TermoDeConsentimento & { criado_em: string };

// A numeração impressa sai de como o bloco é montado na impressão: os dois
// primeiros itens viram 2 e 3, os riscos viram o item 4, e o resto segue de 5
// em diante. Mexer na ordem daqui muda os números no papel.
//
// Nada aqui cita clínica nem hospital pelo nome: quem assina o termo é a
// organização que está usando o sistema, e o nome dela entra pelo cadastro.
// Um nome fixo no texto já foi motivo de retrabalho uma vez.
//
// Isto é documento jurídico. Foi escrito para ser claro para quem vai assinar
// — frases curtas, sem juridiquês desnecessário — mas continua sendo texto que
// o advogado da organização deve ler antes de virar rotina.
export const ITENS_PADRAO: readonly string[] = [
  "Foi claramente exposto a mim que os cuidados propostos seguirão os princípios éticos da medicina: respeito à pessoa, busca do maior benefício possível e redução dos danos e riscos previsíveis.",
  "Minha decisão é voluntária e foi tomada depois de receber informações sobre a natureza, as consequências e os riscos dos procedimentos, e de poder discuti-las. Entendo que qualquer procedimento anestésico pode exigir procedimentos complementares, mesmo com todo o cuidado e a perícia da equipe, e que não existe anestesia sem risco: todas, ainda que em graus diferentes, envolvem risco de vida.",
  "Aceito o fato de que o tabagismo e o uso de álcool ou de outras drogas, embora não impeçam a realização da anestesia, aumentam a chance das complicações descritas acima.",
  "Reconheço que, durante o ato anestésico, podem surgir situações que não era possível prever antes. Por isso autorizo o médico anestesiologista e a equipe que o auxilia a realizar as técnicas e os tratamentos necessários à condução segura da anestesia — inclusive mudar a técnica combinada, se for preciso —, além de procedimentos de urgência e a transferência para terapia intensiva, na própria instituição ou em outra.",
  "Entendo que o médico anestesiologista e sua equipe se comprometem a empregar todos os meios ao seu alcance para alcançar o melhor resultado, mas não podem garantir o resultado em si. A medicina não é uma ciência exata, e não é possível prever com certeza o desfecho de nenhum procedimento anestésico.",
  "Compreendo que, no dia da cirurgia, a anestesia pode ser aplicada por um anestesiologista diferente do que me avaliou, por escala ou plantão. Nesse caso, estou ciente de que ele lerá esta avaliação e seguirá os mesmos cuidados de segurança.",
  "Se minha cirurgia for realizada em hospital de ensino, aceito que médicos residentes participem do meu atendimento, sempre sob supervisão do médico anestesiologista responsável.",
  "Concordo em seguir as orientações que me forem dadas, por escrito ou verbalmente, até minha recuperação — em especial o tempo de jejum e a orientação sobre quais dos meus medicamentos manter e quais suspender. Estou ciente de que não seguir essas orientações pode levar ao adiamento da cirurgia e aumentar o risco do procedimento.",
  "Autorizo o registro dos dados necessários à minha avaliação e à realização da anestesia, em prontuário em papel ou eletrônico. Estou ciente de que esses dados são protegidos por sigilo profissional e pela Lei Geral de Proteção de Dados, e de que só serão compartilhados com quem participa do meu cuidado ou com quem tenha direito legal de acesso.",
  "Tive a oportunidade de fazer perguntas e todas foram respondidas em linguagem que compreendi. Estou ciente de que posso recusar o procedimento ou retirar este consentimento a qualquer momento antes do início da anestesia, sem que isso prejudique o meu atendimento.",
];

// A repetição do "Poderá ocorrer" é de propósito. Sem ela a lista vira um
// rol de coisas que vão acontecer, e não de coisas que podem acontecer —
// e é exatamente essa a diferença que o paciente precisa entender.
export const RISCOS_PADRAO: readonly string[] = [
  "Poderá ocorrer dor de garganta, rouquidão, lesão ou perda de dentes, pequeno sangramento pelo nariz ou pela boca e dormência em partes da língua, relacionados à colocação do tubo respiratório.",
  "Poderá ocorrer dor de cabeça, dor lombar, dores musculares, tontura, vertigem, dificuldade para respirar e desmaio durante a recuperação da anestesia e nos dias seguintes.",
  "Poderá ocorrer sede e fome, pelo tempo de jejum e pelos medicamentos usados.",
  "Poderá ocorrer dor no local das punções de veia ou artéria, além de inflamação da veia (flebite), pelos materiais e medicamentos utilizados.",
  "Poderá ocorrer ardência nos olhos, lesão da córnea, deslocamento de lentes de contato e queda de pelos.",
  "Poderá ocorrer frio, tremores e áreas com falta de sensibilidade, por posicionamento durante a cirurgia ou após bloqueios. Em geral são passageiras, podem durar um tempo indeterminado e, muito raramente, ser permanentes.",
  "Poderá ocorrer alteração do humor e da memória, mais comumente na forma de ansiedade e confusão passageira, e, embora raros, quadros psicológicos mais complexos.",
];

export const AUTORIZACAO_PADRAO =
  "Entendo que os meios utilizados para assegurar a compreensão adequada das informações foram observados e, embora saiba que os procedimentos aos quais me submeterei, além de serem de risco, poderão ocasionar as alterações descritas acima e limitação das minhas atividades cotidianas por período indeterminado, aceito e autorizo que os profissionais acima designados realizem os procedimentos constantes neste termo de autorização.";

/** O termo de fábrica, inteiro. É o que vale enquanto ninguém editar nada. */
export const TERMO_PADRAO: TermoDeConsentimento = {
  itens: [...ITENS_PADRAO],
  riscos: [...RISCOS_PADRAO],
  autorizacao: AUTORIZACAO_PADRAO,
};

/** Cópia nova a cada chamada: quem edita mexe no próprio rascunho, não no padrão. */
export const copiaDoPadrao = (): TermoDeConsentimento => ({
  itens: [...ITENS_PADRAO],
  riscos: [...RISCOS_PADRAO],
  autorizacao: AUTORIZACAO_PADRAO,
});

/**
 * O que o cadastro já sabe, e que o texto editado pode citar sem redigitar.
 *
 * A lista é curta de propósito. Cada marcação a mais é um jeito a mais de o
 * termo sair com um buraco no dia em que o campo estiver vazio, e num
 * documento assinado um buraco é pior do que uma frase genérica.
 */
export const MARCACOES: ReadonlyArray<{ chave: string; descricao: string }> = [
  { chave: "clinica",  descricao: "Nome do local de atendimento (ou da organização, quando não há local)" },
  { chave: "cidade",   descricao: "Cidade e estado do local" },
  { chave: "paciente", descricao: "Nome do paciente" },
];

export type DadosDoTermo = Partial<Record<"clinica" | "cidade" | "paciente", string>>;

const MARCACAO = /\{\{\s*([a-z_]+)\s*\}\}/gi;

/**
 * Troca as {{marcações}} pelo que está no cadastro.
 *
 * Marcação que o sistema não conhece FICA COMO ESTÁ, visível no papel. Apagar
 * seria esconder um erro de digitação dentro de um documento jurídico, e quem
 * revisasse o termo impresso não teria como notar a falta. Aparecendo, o erro
 * se denuncia na primeira impressão — e o editor, no Admin, avisa antes disso.
 *
 * Marcação conhecida mas sem dado também fica como está, pela mesma razão: um
 * termo que diz "autorizo {{clinica}}" pede correção; um que diz "autorizo "
 * parece pronto.
 */
export function aplicarDados(texto: string, dados: DadosDoTermo): string {
  return texto.replace(MARCACAO, (inteiro, chave: string) => {
    const valor = dados[chave.toLowerCase() as keyof DadosDoTermo];
    return valor && valor.trim() ? valor.trim() : inteiro;
  });
}

/** As marcações escritas no texto que o sistema não sabe preencher. */
export function marcacoesDesconhecidas(termo: TermoDeConsentimento): string[] {
  const conhecidas = new Set(MARCACOES.map((m) => m.chave));
  const achadas = new Set<string>();
  for (const texto of [...termo.itens, ...termo.riscos, termo.autorizacao]) {
    for (const [, chave] of texto.matchAll(MARCACAO)) {
      if (!conhecidas.has(chave.toLowerCase())) achadas.add(chave);
    }
  }
  return [...achadas];
}

/**
 * A versão que estava valendo em determinado instante.
 *
 * `quando` é a conclusão da avaliação — o momento em que o papel foi gerado e
 * assinado. Rascunho não tem conclusão, e aí vale a versão de agora: é o texto
 * que vai ser impresso e assinado daqui a pouco.
 *
 * Sem nenhuma versão anterior àquele instante, vale o padrão. É o caso de toda
 * avaliação concluída antes de a organização editar o termo pela primeira vez
 * — e delas é a maioria.
 */
export function termoVigenteEm(
  versoes: readonly VersaoDoTermo[],
  quando: Date | string | null | undefined,
): TermoDeConsentimento {
  const instante = quando ? new Date(quando).getTime() : Date.now();
  if (Number.isNaN(instante)) return copiaDoPadrao();
  let escolhida: VersaoDoTermo | null = null;
  for (const versao of versoes) {
    const nasceu = new Date(versao.criado_em).getTime();
    if (Number.isNaN(nasceu) || nasceu > instante) continue;
    if (!escolhida || nasceu > new Date(escolhida.criado_em).getTime()) escolhida = versao;
  }
  if (!escolhida) return copiaDoPadrao();
  return { itens: [...escolhida.itens], riscos: [...escolhida.riscos], autorizacao: escolhida.autorizacao };
}

/** Se o texto continua sendo, palavra por palavra, o de fábrica. */
export const ehOPadrao = (termo: TermoDeConsentimento): boolean =>
  termo.autorizacao.trim() === AUTORIZACAO_PADRAO
  && termo.itens.length === ITENS_PADRAO.length
  && termo.riscos.length === RISCOS_PADRAO.length
  && termo.itens.every((t, i) => t.trim() === ITENS_PADRAO[i])
  && termo.riscos.every((t, i) => t.trim() === RISCOS_PADRAO[i]);

/** Tira espaços e descarta linhas em branco — é o que vai para o banco. */
export const limpar = (termo: TermoDeConsentimento): TermoDeConsentimento => ({
  itens: termo.itens.map((t) => t.trim()).filter(Boolean),
  riscos: termo.riscos.map((t) => t.trim()).filter(Boolean),
  autorizacao: termo.autorizacao.trim(),
});

/**
 * O que impede de gravar.
 *
 * Curto de propósito: o sistema não é revisor jurídico e não tem como julgar o
 * texto de ninguém. O que ele barra é o termo que deixaria de ser um termo —
 * sem itens, sem riscos ou sem o parágrafo que o paciente autoriza. Um papel
 * assim seria pior do que não ter papel nenhum, porque pareceria consentimento.
 */
export function problemasDoTermo(termo: TermoDeConsentimento): string[] {
  const limpo = limpar(termo);
  const problemas: string[] = [];
  if (!limpo.itens.length) problemas.push("O termo precisa de pelo menos um item numerado.");
  if (!limpo.riscos.length) problemas.push("O termo precisa de pelo menos um risco esclarecido — é o item 4.");
  if (!limpo.autorizacao) problemas.push("O parágrafo da autorização não pode ficar vazio: é o que o paciente assina.");
  const soltas = marcacoesDesconhecidas(limpo);
  if (soltas.length) {
    problemas.push(`O sistema não sabe preencher ${soltas.map((c) => `{{${c}}}`).join(", ")}`
      + ` — sairia impresso assim mesmo. Use ${MARCACOES.map((m) => `{{${m.chave}}}`).join(", ")}.`);
  }
  return problemas;
}
