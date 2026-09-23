/**
 * O texto de um laudo, venha ele como PDF ou como foto.
 *
 * DUAS FONTES, DUAS QUALIDADES MUITO DIFERENTES, e é por isso que os dois
 * caminhos existem em vez de um só:
 *
 *   PDF do laboratório → o texto já está lá dentro, exato. Nada é "reconhecido",
 *     nada é adivinhado: 12,47 sai 12,47. É de longe o melhor caminho, e é o
 *     que o paciente recebe por e-mail ou baixa do portal.
 *
 *   FOTO do papel → OCR, que erra. Serve para o laudo impresso que chegou na
 *     mão, e é a razão de a leitura ter faixa plausível e aviso de conferência
 *     em `exames-leitura.ts`.
 *
 * Quando existe o PDF, usar a foto dele é jogar fora precisão de graça. Por
 * isso a tela aceita os dois e esta função decide sozinha, pelo tipo do
 * arquivo — não é escolha que se deva pedir a quem está atendendo.
 *
 * Os dois motores entram por IMPORT DINÂMICO: são pesados, e quem nunca ler um
 * laudo nunca os baixa. Se um deles não carregar, quem chama trata o erro e a
 * tela continua servindo para digitar.
 */

/** PDF pelo tipo declarado ou pela extensão — nem todo navegador preenche o tipo. */
export function ehPdf(arquivo: { type?: string; name?: string }): boolean {
  if (String(arquivo.type ?? "").toLowerCase().includes("pdf")) return true;
  return /\.pdf$/i.test(String(arquivo.name ?? ""));
}

/**
 * Junta o texto de todas as páginas do PDF.
 *
 * O laudo do Pronto Análise tem quatro páginas e espalha os exames entre elas:
 * hemograma na primeira, ureia e creatinina na segunda. Ler só a primeira
 * deixaria a creatinina de fora — que é justamente o exame que mais muda
 * conduta anestésica.
 *
 * O `\n` entre os pedaços não é enfeite: `lerExames` mede a distância entre o
 * rótulo e o número, e sem separador o fim de uma linha encostaria no começo da
 * outra, criando números que não existem no papel.
 */
async function textoDoPdf(arquivo: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // O worker é obrigatório na biblioteca. Apontar para o arquivo do próprio
  // pacote deixa o empacotador resolver o caminho — sem isso, a leitura falha
  // só em produção, que é o pior lugar para descobrir.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const tarefa = pdfjs.getDocument({ data: await arquivo.arrayBuffer() });
  const documento = await tarefa.promise;
  const paginas: string[] = [];
  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n);
    const conteudo = await pagina.getTextContent();
    paginas.push(
      conteudo.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" "),
    );
  }
  // Libera o worker: sem isto, ler vários laudos seguidos deixa um processo
  // por laudo pendurado no navegador do aparelho. Quem encerra é a TAREFA de
  // carregamento, e não o documento — `destroy()` mora nela.
  await tarefa.destroy();
  return paginas.join("\n");
}

async function textoDaImagem(arquivo: File): Promise<string> {
  const { default: Tesseract } = await import("tesseract.js");
  const { data } = await Tesseract.recognize(arquivo, "por");
  return data.text;
}

export async function textoDoArquivo(arquivo: File): Promise<string> {
  return ehPdf(arquivo) ? textoDoPdf(arquivo) : textoDaImagem(arquivo);
}
