/**
 * Leitura de nome, convênio e procedimento a partir da foto de uma ficha de
 * internação.
 *
 * O reconhecimento da imagem acontece em outro lugar; aqui entra o texto bruto
 * e saem os três campos. A separação é o que torna esta parte testável: dá
 * para escrever à mão o texto de uma ficha e conferir o que sai, sem foto
 * nenhuma — é a mesma divisão que a leitura de gasometria já usa.
 *
 * A regra que sustenta a segurança disto é a desconfiança. Não existe formato
 * de ficha de internação: cada hospital imprime a sua, e o OCR de um papel
 * amassado no bolso do jaleco erra bastante. Então nada aqui preenche por
 * palpite — o que não passar nos testes de plausibilidade sai vazio, porque
 * campo vazio o anestesiologista vê e preenche, enquanto campo com o nome
 * errado passa despercebido e vira cobrança do paciente errado.
 *
 * O que esta função NÃO faz: adivinhar. Se a ficha traz três nomes — o do
 * paciente, o da mãe e o do cirurgião —, ela usa o que estiver rotulado como
 * paciente. Sem rótulo, prefere não responder.
 */

type Campo = "paciente" | "convenio" | "procedimento";

export type DadosDaFicha = { paciente?: string; convenio?: string; procedimento?: string };

/**
 * Como cada campo aparece nas fichas.
 *
 * A ordem importa: "paciente" ganha de "nome" porque uma ficha costuma ter
 * vários nomes e só um deles é o do paciente. O acento some na normalização,
 * então basta a forma sem ele.
 */
const ROTULOS: Array<{ campo: Campo; apelidos: string[] }> = [
  { campo: "paciente", apelidos: [
    // "10 - nome" é o campo do paciente na guia TISS, e vem antes de "nome"
    // por um motivo que custou caro: aquela guia tem CINCO campos chamados
    // "Nome" — do contratado, do profissional solicitante, do hospital
    // solicitado, do hospital autorizado e do beneficiário. Sem o número, o
    // leitor pegava o primeiro que aparecesse e o nome do cirurgião entrava
    // como nome do paciente.
    "10 - nome", "10-nome", "nome do beneficiario", "beneficiario",
    "nome do paciente", "paciente", "nome completo", "nome civil", "nome",
  ] },
  { campo: "convenio", apelidos: [
    "convenio", "plano de saude", "operadora", "fonte pagadora", "plano",
    "seguradora", "carteira", "beneficiario de",
  ] },
  { campo: "procedimento", apelidos: [
    "descricao do procedimento", "procedimento proposto", "cirurgia proposta",
    "procedimento cirurgico", "procedimento solicitado", "procedimento",
    "cirurgia", "ato cirurgico",
  ] },
];

/**
 * Rótulos que aparecem em ficha e nunca são valor.
 *
 * Sem esta lista, uma ficha em que o rótulo está numa linha e o valor na
 * seguinte devolveria "Data de nascimento" como nome do paciente — que é
 * exatamente o tipo de erro que passa despercebido.
 */
const NUNCA_E_VALOR = [
  "data de nascimento", "nascimento", "idade", "sexo", "registro", "prontuario",
  "atendimento", "leito", "quarto", "enfermaria", "matricula", "cpf", "rg",
  "telefone", "endereco", "cidade", "estado", "bairro", "cep", "mae", "pai",
  "responsavel", "medico", "cirurgiao", "anestesista", "anestesiologista",
  "especialidade", "clinica", "hospital", "unidade", "setor", "data", "hora",
  "assinatura", "carimbo", "crm", "diagnostico", "cid", "observacoes",
  "acomodacao", "internacao", "admissao", "guia", "senha", "validade",
  // Do laudo de AIH do SUS, que é a ficha da maioria das cirurgias em
  // hospital filantrópico. Sem eles, "Nome do estabelecimento executante"
  // vira nome de paciente e "Nome do profissional responsável" vira o nome
  // do cirurgião no lugar do doente.
  "estabelecimento", "nome do estabelecimento solicitante",
  "nome do estabelecimento executante", "nome da mae ou responsavel",
  "nome do profissional responsavel", "nome do profissional autorizador",
  "cartao nacional de saude", "cns", "cnes", "municipio de residencia",
  "codigo do procedimento", "carater da internacao", "documento",
  "raca/cor", "raca", "etnia", "uf", "serie", "cbo", "cnpj", "cnae",
  "solicitacao", "internamento", "laudo", "reserva", "orgao emissor",
  // Da guia TISS de solicitação de internação. Todos começam com "Nome" e
  // nenhum é o paciente: são o médico, o hospital e a operadora. Sem esta
  // lista, "Nome do Contratado EDSON LUIZ MICHALKIEWICZ" virava o nome do
  // doente na anotação de produção — e a cobrança sairia no nome errado.
  "nome do contratado", "nome do profissional solicitante",
  "nome do profissional executante", "nome do hospital/local solicitado",
  "nome do hospital / local solicitado", "nome do hospital/local autorizado",
  "nome do hospital / local autorizado", "nome do hospital", "nome do local",
  "nome do contratado executante", "nome do solicitante",
  "registro ans", "numero da guia", "numero da carteira", "codigo na operadora",
  "codigo do contratado", "numero no conselho", "conselho profissional",
  "carater do atendimento", "tipo de internacao", "regime de internacao",
  "indicacao clinica", "data de solicitacao", "data da autorizacao",
  "validade da carteira", "atendimento a rn", "tipo da acomodacao autorizada",
  "qtde. diarias solicitadas", "qtde diarias solicitadas",
  "qtde. diarias autorizadas", "qtde diarias autorizadas",
  "data provavel da admissao hospitalar", "codigo cbo", "codigo cnes",
];

/**
 * Operadoras reconhecidas pela marca, e não pelo rótulo.
 *
 * Da maior para a menor: "unimed" antes de "med" evitaria confusão se um dia
 * "med" entrasse aqui. A lista é curta de propósito — nome genérico demais
 * casaria com palavra comum do formulário e trocaria o convênio do paciente.
 */
const OPERADORAS = [
  "Unimed", "Bradesco Saúde", "SulAmérica", "Amil", "Hapvida", "NotreDame",
  "Cassi", "Golden Cross", "Porto Seguro", "Allianz", "Caixa Saúde",
  "Sompo", "Prevent Senior", "São Cristóvão", "Med Tour", "Life Empresarial",
  "Care Plus", "Omint", "Ampla", "Bradesco",
].sort((a, b) => b.length - a.length);

/** Tira acento, baixa a caixa e junta espaços. */
const normalizar = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Sem acento e em minúsculas, mas SEM juntar espaços.
 *
 * Serve para procurar rótulo dentro do texto e usar a posição achada para
 * cortar o original. Juntar espaços mudaria o comprimento, e a posição
 * apontaria para outra letra — cortando o nome do paciente no meio.
 */
const achatar = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Todo rótulo que uma ficha pode ter, do mais longo para o mais curto.
 *
 * O comprimento manda para "nome do paciente" ser testado antes de "nome":
 * casando o curto primeiro, o corte cairia no lugar errado.
 */
const TODOS_ROTULOS = [...new Set([
  ...ROTULOS.flatMap((r) => r.apelidos), ...NUNCA_E_VALOR,
])].sort((a, b) => b.length - a.length);

/**
 * Rótulos compridos o bastante para serem reconhecidos sem os dois-pontos.
 *
 * O OCR perde os dois-pontos com frequência, e sem eles "Paciente FULANO DE
 * TAL Data de nascimento 01/01/1980" ficaria inteiro no campo do nome. Mas
 * cortar em rótulo curto é perigoso: "data", "hora" e "leito" aparecem dentro
 * de descrição de procedimento, e o corte comeria o texto. Oito letras é onde
 * a palavra deixa de ser comum e passa a ser rótulo de formulário.
 */
const ROTULOS_INCONFUNDIVEIS = TODOS_ROTULOS.filter((r) => r.length >= 8);

/**
 * Este pedaço de texto COMEÇA com um rótulo?
 *
 * Se começa, ele é a linha do campo seguinte, e não o valor deste. É o teste
 * que precisa vir ANTES do corte: "DATA DE NASCIMENTO: 02/05/1970" cortado no
 * próximo rótulo vira "DATA DE" — duas palavras, sem dígito, com cara de nome
 * de gente. O corte serve para separar valor de rótulo, não para fabricar
 * valor a partir de rótulo.
 *
 * `exigeDoisPontos` para o procedimento: ele é descrição livre, e uma cirurgia
 * pode legitimamente começar com uma palavra que também é rótulo de ficha.
 * Com os dois-pontos, "Clínica geral" passa e "Clínica: São Lucas" não.
 */
function comecaComRotulo(valor: string, apenasCompostos = false): boolean {
  // O número do campo sai antes. Na ficha do SUS o rótulo vem numerado —
  // "26 - CÓDIGO DO PROCEDIMENTO" — e sem tirar o "26 - " ele não é
  // reconhecido como rótulo: virava a descrição da cirurgia.
  const plano = achatar(valor.trim()).replace(/^\d{1,2}\s*[-–—.:+]\s*/u, "");
  const lista = apenasCompostos
    ? TODOS_ROTULOS.filter((r) => r.includes(" "))
    : TODOS_ROTULOS;
  return lista.some((rotulo) => new RegExp(
    `^${escaparRegex(rotulo).replace(/ /g, "\\s+")}(?!\\p{L})`, "u",
  ).test(plano));
}

/**
 * Este trecho é o começo de um rótulo que nunca é valor?
 *
 * Existe por causa de "11 - NOME DA MÃE OU RESPONSÁVEL". O apelido "nome"
 * casa ali, e o resto da linha — "DA MÃE OU RESPONSÁVEL..." — era cortado no
 * próximo rótulo e virava "DA MÃE OU": três palavras, sem dígito, aceito como
 * nome de paciente. O nome da mãe da paciente não é a paciente, e um erro
 * desses vira cobrança no nome errado.
 *
 * A checagem é feita na POSIÇÃO do rótulo curto: se o que começa ali é um
 * rótulo mais longo e proibido, o casamento inteiro é descartado.
 */
function ehRotuloProibidoMaisLongo(trecho: string): boolean {
  return NUNCA_E_VALOR.some((rotulo) => rotulo.includes(" ") && new RegExp(
    `^${escaparRegex(rotulo).replace(/ /g, "\\s+")}(?!\\p{L})`, "u",
  ).test(trecho));
}

/**
 * Corta o valor onde começa o próximo rótulo.
 *
 * É o conserto do caso mais comum de ficha de hospital: duas colunas que o
 * reconhecimento junta numa linha só. "Paciente: FULANO DE TAL Data de
 * nascimento: 01/01/1980" tem o nome certo lá dentro, mas o campo inteiro era
 * recusado por conter dígitos — e a tela dizia que não reconheceu nada, tendo
 * reconhecido tudo.
 *
 * `agressivo` liga o corte em rótulo sem dois-pontos. Vale para nome e
 * convênio, que são curtos e nunca contêm palavra de formulário; não vale
 * para procedimento, que é descrição livre e perderia texto legítimo.
 */
/**
 * Corta o valor onde começa um número de documento.
 *
 * Na ficha do SUS o rótulo fica numa linha e o valor na de baixo — e a linha
 * de baixo traz também o valor da coluna vizinha, sem rótulo nenhum entre os
 * dois: "MARTINA SIQUEIRA BRAGA 4.407.256" é nome e prontuário grudados.
 * Não há rótulo em que cortar; o que separa é o número.
 *
 * Quatro dígitos no mesmo pedaço, e não qualquer dígito: prontuário, carteira,
 * CPF, data e código de procedimento têm todos mais que isso, enquanto "Amil
 * 400" e "Cesárea 2x" têm menos e ficam inteiros.
 */
function cortarNoNumero(valor: string): string {
  const partes = valor.split(/(\s+)/);
  let saida = "";
  for (const parte of partes) {
    if ((parte.match(/\d/g) ?? []).length >= 4) break;
    saida += parte;
  }
  return saida.trim() || valor.trim();
}

export function cortarNoProximoRotulo(valor: string, agressivo = false): string {
  const plano = achatar(valor);
  // Índice fora de sincronia: melhor devolver inteiro do que cortar errado.
  if (plano.length !== valor.length) return valor;

  let corte = valor.length;
  const procurar = (rotulo: string, exigeDoisPontos: boolean) => {
    // (?<!\p{L}) para "nome" não casar dentro de "sobrenome".
    const re = new RegExp(
      `(?<!\\p{L})${escaparRegex(rotulo)}\\s*${exigeDoisPontos ? ":" : "\\b"}`, "gu");
    for (const achado of plano.matchAll(re)) {
      // Posição 0 é o próprio rótulo que trouxe este valor até aqui.
      if (achado.index > 0 && achado.index < corte) corte = achado.index;
    }
  };
  for (const rotulo of TODOS_ROTULOS) procurar(rotulo, true);
  if (agressivo) for (const rotulo of ROTULOS_INCONFUNDIVEIS) procurar(rotulo, false);

  if (agressivo) {
    // O rótulo vizinho nem sempre é lido direito: "Carteira" saiu como
    // "“ca rteira" numa foto com sombra, e o corte por nome não o reconheceu.
    // Mas os dois-pontos sobreviveram — e nome de pessoa e de operadora nunca
    // os contêm. Onde houver dois-pontos, houve rótulo: corta ali, voltando
    // até o começo da palavra que os carrega.
    const doisPontos = valor.indexOf(":");
    if (doisPontos > 0) {
      let k = doisPontos;
      while (k > 0 && !/\s/.test(valor[k - 1])) k--;
      if (k > 0) corte = Math.min(corte, k);
    }
  }

  const cortado = valor.slice(0, corte).trim();
  return agressivo ? semSobraDeRotulo(cortado) : cortado;
}

/**
 * Tira o cotoco que sobra do rótulo cortado.
 *
 * "UNIMED CAMPO MOURAO “ca" — o "“ca" é o começo de "Carteira" que o
 * reconhecimento partiu ao meio. Só sai o que é curto E tem sinal que não
 * pertence a nome nenhum: assim "Bradesco Saúde S/A" fica inteiro, porque a
 * barra é sinal legítimo de razão social.
 */
function semSobraDeRotulo(valor: string): string {
  const partes = valor.split(/\s+/);
  while (partes.length > 1) {
    const ultima = partes[partes.length - 1];
    if (ultima.length <= 3 && /[^\p{L}\d&./-]/u.test(ultima)) partes.pop();
    else break;
  }
  return partes.join(" ").trim();
}

/** Um rótulo sozinho na linha não é valor de nada. */
function pareceRotulo(valor: string): boolean {
  const n = normalizar(valor).replace(/[:.\-]+$/, "");
  if (!n) return true;
  if (NUNCA_E_VALOR.includes(n)) return true;
  return ROTULOS.some((r) => r.apelidos.includes(n));
}

/**
 * Isto pode ser o nome de uma pessoa?
 *
 * Duas palavras no mínimo, porque ficha com primeiro nome só não serve para
 * cobrar de ninguém. Sem dígito, porque número na linha quer dizer que o OCR
 * colou o registro no nome. E um teto de tamanho, porque quando o
 * reconhecimento junta duas linhas o resultado é uma frase, não um nome.
 */
export function pareceNome(valor: string): boolean {
  const limpo = valor.trim();
  if (limpo.length < 5 || limpo.length > 70) return false;
  if (/\d/.test(limpo)) return false;
  if (pareceRotulo(limpo)) return false;
  const palavras = limpo.split(/\s+/).filter((p) => p.length > 1);
  if (palavras.length < 2) return false;
  // Letras, espaço, hífen e apóstrofo. Qualquer outro sinal indica que o
  // reconhecimento trouxe junto a borda da tabela ou um carimbo.
  return /^[\p{L}\s'’.-]+$/u.test(limpo);
}

/** Convênio é nome curto de operadora, e não uma frase. */
function pareceConvenio(valor: string): boolean {
  const limpo = valor.trim();
  if (limpo.length < 3 || limpo.length > 45) return false;
  if (pareceRotulo(limpo)) return false;
  return limpo.split(/\s+/).length <= 6;
}

/** Procedimento é uma descrição: aceita mais coisa, mas não um documento. */
function pareceProcedimento(valor: string): boolean {
  const limpo = valor.trim();
  if (limpo.length < 4 || limpo.length > 120) return false;
  if (pareceRotulo(limpo)) return false;
  return /\p{L}{3}/u.test(limpo);
}

const VALIDA: Record<Campo, (v: string) => boolean> = {
  paciente: pareceNome,
  convenio: pareceConvenio,
  procedimento: pareceProcedimento,
};

/**
 * Tira a borda da tabela colada na frente da linha.
 *
 * "|", "[", "»" e o quadradinho de marcar são o que a linha impressa vira no
 * reconhecimento. Só na frente: o ")" de "(UNILATERAL)" pertence ao texto.
 */
const semBorda = (l: string) => l.replace(/^[^\p{L}\d]+/u, "");

/** Tira a pontuação de borda que o OCR costuma colar no valor. */
const limparValor = (v: string) =>
  v.replace(/^[\s:;.\-–—|]+/, "").replace(/[\s:;.\-–—|]+$/, "").trim();

/**
 * O laudo de AIH do SUS.
 *
 * Ele tem tratamento próprio porque é o mesmo formulário em todo hospital do
 * país — e porque a leitura dele quebra a regra geral: o rótulo do campo 5,
 * "NOME DO PACIENTE", saiu do reconhecimento como "bos Sdl". Não sobrou rótulo
 * nenhum para casar, e o nome estava ali na linha de baixo.
 *
 * O que salva é a vizinhança fixa do formulário. O campo 5 divide a linha de
 * cabeçalho com o 6, "Nº PRONTUÁRIO", e os valores dos dois vêm juntos na
 * linha seguinte: "MARTINA SIQUEIRA BRAGA 4.407.256". O prontuário é palavra
 * comprida e sobrevive ao reconhecimento; ele vira a âncora, e o número separa
 * o nome do resto.
 *
 * Isto só roda depois de o laudo ser reconhecido pelo título. Fora dele, uma
 * regra que lê "a linha depois de prontuário" acertaria por acaso e erraria em
 * silêncio.
 */
const EH_LAUDO_SUS =
  /autorizacao de internacao hospitalar|laudo para solicitacao de autorizacao/;

const ANCORAS_SUS: Array<[RegExp, Campo]> = [
  // Campo 6, ao lado do 5 (nome do paciente).
  [/(?:^|\s)n\s*[.ºo°]?\s*prontuario/u, "paciente"],
  // Campo 25, com o 26 (código) ao lado.
  [/descricao do procedimento|codigo do procedimento/u, "procedimento"],
];

function lerLaudoDoSUS(linhas: string[], dados: DadosDaFicha): void {
  const inteiro = normalizar(linhas.join(" "));
  if (!EH_LAUDO_SUS.test(inteiro)) return;

  for (let i = 0; i < linhas.length - 1; i++) {
    const cabecalho = normalizar(linhas[i]);
    for (const [marca, campo] of ANCORAS_SUS) {
      if (dados[campo] || !marca.test(cabecalho)) continue;
      const abaixo = cortarNoNumero(limparValor(semBorda(linhas[i + 1] ?? "")));
      if (abaixo && !comecaComRotulo(abaixo) && VALIDA[campo](abaixo)) {
        dados[campo] = abaixo;
      }
    }
  }

  // Quem paga é o SUS, e o laudo é o documento que diz isso. Não é palpite:
  // paciente com convênio ou particular não entra por AIH. Sem esta linha o
  // campo ficaria em "Particular", que é o padrão do formulário — e cobrar
  // como particular um caso do SUS é o erro mais caro que esta tela pode
  // produzir.
  if (!dados.convenio) dados.convenio = "SUS";
}

/**
 * Lê a ficha.
 *
 * Percorre linha a linha procurando "rótulo: valor". Quando o valor não vem na
 * mesma linha, olha a seguinte — em ficha impressa o rótulo em cima do campo é
 * tão comum quanto ao lado.
 *
 * Vence o rótulo MAIS ESPECÍFICO da ficha inteira, não o que aparecer antes.
 * No laudo de AIH do SUS há um "Cirurgia Eletiva: 4.022.875" no topo — que é o
 * número da solicitação — e o procedimento de verdade só aparece no campo 25,
 * lá embaixo. Pela ordem de leitura, o número ganhava; pela especificidade,
 * "descrição do procedimento" ganha de "cirurgia", esteja onde estiver.
 */
export function lerFichaDeInternacao(texto: string): {
  dados: DadosDaFicha; naoEncontrados: Campo[];
} {
  const linhas = String(texto ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const dados: DadosDaFicha = {};
  // Quanto vale o rótulo que trouxe cada valor: posição na lista de apelidos,
  // menor é mais específico.
  const peso: Partial<Record<Campo, number>> = {};

  for (let i = 0; i < linhas.length; i++) {
    // A borda da tabela e o quadradinho de marcar entram no reconhecimento
    // como "|", "[", "»". Sem tirá-los da frente, a linha "| Paciente: ..."
    // não começa com rótulo nenhum e a ficha inteira passava batida.
    const linha = semBorda(linhas[i]);
    // A busca do rótulo é feita aqui, e não no texto de espaços juntados: a
    // posição encontrada vai recortar a LINHA, e só bate com ela se os dois
    // tiverem o mesmo comprimento. Com espaços juntados, uma ficha com espaço
    // duplo cortava o nome do paciente uma letra fora do lugar.
    const plano = achatar(linha);
    if (plano.length !== linha.length) continue;

    for (const { campo, apelidos } of ROTULOS) {
      for (let k = 0; k < apelidos.length; k++) {
        // Já temos um rótulo igual ou mais específico para este campo.
        if (peso[campo] !== undefined && peso[campo]! <= k) break;
        const apelido = apelidos[k];
        // \s+ no lugar do espaço: o reconhecimento espaça o rótulo como quer.
        const achado = new RegExp(
          `(?<!\\p{L})${escaparRegex(apelido).replace(/ /g, "\\s+")}\\s*(:)?`, "u",
        ).exec(plano);
        if (!achado) continue;

        // No começo da linha vale sem dois-pontos. No meio dela vale com os
        // dois-pontos — que é o que sobra quando o reconhecimento junta duas
        // colunas numa linha só — ou depois de um número de campo, que é como
        // a ficha do SUS numera tudo: "p— 5- NOME DO PACIENTE 6+Nº PRONTUÁRIO".
        // Sem essas condições, "nome" no meio de uma frase é palavra comum e
        // devolveria pedaço de texto solto.
        const numerado = /\d{1,2}\s*[-–—.:+]\s*$/u.test(plano.slice(0, achado.index));
        if (achado.index > 0 && !achado[1] && !numerado) continue;
        // "nome" casa dentro de "NOME DA MÃE OU RESPONSÁVEL". O rótulo mais
        // longo manda, e ele é proibido: a mãe da paciente não é a paciente.
        if (ehRotuloProibidoMaisLongo(plano.slice(achado.index))) continue;

        // O corte tira o que veio da coluna ao lado: sem ele, "FULANO DE TAL
        // Data de nascimento: 01/01/1980" é recusado inteiro por ter dígito.
        const agressivo = campo !== "procedimento";
        const brutos = [
          limparValor(linha.slice(achado.index + achado[0].length)),
          // A linha de baixo passa pela mesma limpeza de borda que a de cima:
          // o valor da ficha do SUS vem com "[" colado na frente, e sem tirá-lo
          // a cirurgia era gravada como "[HERNIOPLASTIA...".
          limparValor(semBorda(linhas[i + 1] ?? "")),
        ];
        for (const bruto of brutos) {
          // Recusar ANTES de cortar. Um pedaço que começa com rótulo é a linha
          // do campo seguinte, e cortá-lo fabricaria valor a partir de rótulo.
          if (!bruto || comecaComRotulo(bruto, !agressivo)) continue;
          const c = cortarNoNumero(cortarNoProximoRotulo(bruto, agressivo));
          if (c && VALIDA[campo](c)) { dados[campo] = c; peso[campo] = k; break; }
        }
        break;
      }
    }
  }

  lerLaudoDoSUS(linhas, dados);

  // "Particular" raramente vem rotulado: aparece carimbado ou marcado num
  // quadradinho. Se a palavra está na ficha e nenhum convênio foi encontrado,
  // é a resposta — e é justamente o caso em que esquecer de cobrar custa o
  // valor inteiro, porque particular não deixa rastro no faturamento.
  // A operadora pela MARCA, quando não vem rotulada.
  //
  // A guia TISS de solicitação de internação não tem campo "Convênio": a
  // operadora está no logotipo, que é imagem e não texto, e no cabeçalho —
  // "Unimed Campo Mourão". O nome quase sempre sobra em algum canto do
  // reconhecimento, e achá-lo é melhor do que devolver o campo vazio e obrigar
  // a digitar em toda guia da mesma operadora.
  //
  // Só entra quando NENHUM rótulo respondeu: rótulo explícito sempre ganha da
  // marca solta, senão uma guia da Unimed que cobre um paciente Bradesco
  // sairia com a operadora errada.
  if (!dados.convenio) {
    const achada = OPERADORAS.find((o) => new RegExp(`\\b${escaparRegex(o.toLowerCase())}\\b`)
      .test(normalizar(texto)));
    if (achada) dados.convenio = achada;
  }

  if (!dados.convenio && /\bparticular\b/i.test(normalizar(texto))) {
    dados.convenio = "Particular";
  }

  const naoEncontrados = (["paciente", "convenio", "procedimento"] as Campo[])
    .filter((c) => !dados[c]);

  return { dados, naoEncontrados };
}

export const AVISO_FICHA =
  "Confira o que foi reconhecido antes de salvar. A leitura da foto erra, e todos os campos continuam editáveis.";

export const ROTULO_CAMPO: Record<Campo, string> = {
  paciente: "nome", convenio: "convênio", procedimento: "procedimento",
};
