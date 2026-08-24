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
    "nome do paciente", "paciente", "nome completo", "nome civil", "nome",
  ] },
  { campo: "convenio", apelidos: [
    "convenio", "plano de saude", "operadora", "fonte pagadora", "plano",
    "seguradora", "carteira", "beneficiario de",
  ] },
  { campo: "procedimento", apelidos: [
    "procedimento proposto", "cirurgia proposta", "procedimento cirurgico",
    "descricao do procedimento", "procedimento", "cirurgia", "ato cirurgico",
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
];

/** Tira acento, baixa a caixa e junta espaços. */
const normalizar = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();

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

/** Tira a pontuação de borda que o OCR costuma colar no valor. */
const limparValor = (v: string) =>
  v.replace(/^[\s:;.\-–—|]+/, "").replace(/[\s:;.\-–—|]+$/, "").trim();

/**
 * Lê a ficha.
 *
 * Percorre linha a linha procurando "rótulo: valor". Quando o valor não vem na
 * mesma linha, olha a seguinte — em ficha impressa o rótulo em cima do campo é
 * tão comum quanto ao lado. O primeiro valor plausível de cada campo vence: as
 * fichas trazem o dado principal no topo, e o que vem depois costuma ser
 * repetição de rodapé ou segunda via.
 */
export function lerFichaDeInternacao(texto: string): {
  dados: DadosDaFicha; naoEncontrados: Campo[];
} {
  const linhas = String(texto ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const dados: DadosDaFicha = {};

  for (let i = 0; i < linhas.length; i++) {
    const n = normalizar(linhas[i]);
    for (const { campo, apelidos } of ROTULOS) {
      if (dados[campo]) continue;
      for (const apelido of apelidos) {
        // O rótulo tem de começar a linha. "nome" no meio de uma frase é
        // palavra comum, e casar com ela devolveria pedaço de texto solto.
        if (!n.startsWith(apelido)) continue;
        const resto = limparValor(linhas[i].slice(apelido.length));
        const candidatos = [resto, limparValor(linhas[i + 1] ?? "")];
        for (const c of candidatos) {
          if (c && VALIDA[campo](c)) { dados[campo] = c; break; }
        }
        break;
      }
    }
  }

  // "Particular" raramente vem rotulado: aparece carimbado ou marcado num
  // quadradinho. Se a palavra está na ficha e nenhum convênio foi encontrado,
  // é a resposta — e é justamente o caso em que esquecer de cobrar custa o
  // valor inteiro, porque particular não deixa rastro no faturamento.
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
