import { feriadosDoMes } from "./feriados.ts";
import {
  PALETA_DA_FOLHA, TURNOS_DO_DIA, mesEmMaiusculas, nomeCurto,
  ordemDentroDoDia, partesDoPlantao, turnosCobertos,
  type PlantaoImpresso,
} from "./escala.ts";
import { Pagina, corDeHex, cortarTexto, larguraDoTexto, montarPdf } from "./pdf.ts";

/**
 * A escala do mês desenhada em PDF, numa folha A4 deitada.
 *
 * Este arquivo existe pelo motivo que está escrito em `lib/pdf.ts`: no iPhone
 * não há como mandar o navegador imprimir uma folha deitada, e cinco tentativas
 * de contorná-lo saíram no papel como a TELA do aplicativo. Aqui a folha é
 * desenhada, e não pedida. O que o aparelho faz é abrir um PDF pronto.
 *
 * A folha é UMA, sempre. A escala é pregada na parede: a segunda página com os
 * quatro últimos dias do mês não é pregada por ninguém, e o mês some pela
 * metade. Quando o mês está cheio demais, o que encolhe é a letra — e há um
 * piso, abaixo do qual o nome deixa de ser legível a um passo da parede e a
 * pastilha passa a ser cortada.
 */

/** A4 deitada, em pontos. É a medida do formato, não uma escolha. */
export const A4_DEITADA = { largura: 841.89, altura: 595.28 };

const MARGEM = 22;
const CINZA_TINTA = corDeHex("#1c2733");
const CINZA_FRACO = corDeHex("#7b8794");
const CINZA_LINHA = corDeHex("#c9d3dc");
const CINZA_CABECA = corDeHex("#eef3f7");
const FUNDO_FDS = corDeHex("#f4f7fa");
const FUNDO_FERIADO = corDeHex("#fdf3e3");
const BRANCO = corDeHex("#ffffff");

const DIAS_DA_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export type FolhaDaEscala = {
  doGrupo: boolean;
  mes: string;            // "2026-08"
  nomeMes: string;
  ano: number;
  diasNoMes: number;
  primeiroDiaSemana: number;
  plantoes: PlantaoImpresso[];
  impressoEm: Date;
  instituicao?: { nome: string } | null;
  /** As MESMAS cores da tela, por rótulo. Ver `corpoDaFolha`. */
  cores?: Map<string, number>;
  apelidos?: Map<string, string>;
  /** Preto e branco: a impressora do centro cirúrgico raramente tem cor. */
  emCores?: boolean;
};

/** Uma pastilha a desenhar: o texto e o índice da cor. */
type Pastilha = { texto: string; cor: number };
/** Uma faixa da célula: a letra da esquerda (M/T/N) e o que há nela. */
type Faixa = { letra: string; pastilhas: Pastilha[]; hospital?: string };

/**
 * O conteúdo de cada dia, já resolvido — antes de saber de que tamanho a letra
 * vai ser.
 *
 * Separar "o que vai na célula" de "de que tamanho cabe" é o que permite medir
 * a folha inteira, descobrir que ela não cabe, diminuir a fonte e medir de
 * novo, sem refazer a leitura dos plantões a cada tentativa.
 */
export function conteudoDosDias(f: FolhaDaEscala): Map<number, Faixa[]> {
  const comoEscrever = (nome: string) => f.apelidos?.get(nome) || nomeCurto(nome);
  const hospitais = [...new Set(f.plantoes.map((p) => p.local).filter(Boolean))];
  const variosHospitais = hospitais.length > 1;
  const cor = (texto: string) => f.cores?.get(texto) ?? PALETA_DA_FOLHA.length - 1;

  const porDia = new Map<number, Faixa[]>();
  for (let d = 1; d <= f.diasNoMes; d++) {
    const dia = `${f.mes}-${String(d).padStart(2, "0")}`;
    const doDia = f.plantoes.filter((p) => p.data === dia);
    if (!doDia.length) { porDia.set(d, []); continue; }

    if (f.doGrupo) {
      // O turno agrupa as pessoas, e o hospital entra na chave: o das 07h da
      // Santa Casa e o das 07h da Unimed não são o mesmo turno.
      const turnos = Object.values(doDia.reduce<Record<string, {
        local: string; inicio: string; fim: string; gente: string[];
      }>>((acc, p) => {
        const chave = `${p.local}|${p.hora_inicio}|${p.hora_fim}`;
        acc[chave] ??= { local: p.local, inicio: p.hora_inicio, fim: p.hora_fim, gente: [] };
        acc[chave].gente.push(comoEscrever(p.profissional));
        return acc;
      }, {}));
      // Quem cobre mais turnos do dia vem primeiro em todas as faixas, para a
      // emenda de manhã com tarde se ler na vertical.
      const ordem = ordemDentroDoDia(TURNOS_DO_DIA.map((faixaDoDia) => turnos
        .filter((t) => turnosCobertos(t.inicio, t.fim).includes(faixaDoDia.id))
        .flatMap((t) => t.gente)));
      porDia.set(d, TURNOS_DO_DIA.map((faixaDoDia) => {
        const blocos = turnos
          .filter((t) => turnosCobertos(t.inicio, t.fim).includes(faixaDoDia.id))
          .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.local.localeCompare(b.local));
        return {
          letra: faixaDoDia.letra,
          hospital: variosHospitais ? blocos.map((t) => t.local).filter(Boolean)[0] : undefined,
          pastilhas: blocos.flatMap((t) => [...t.gente].sort(ordem)
            .map((nome) => ({ texto: nome, cor: cor(nome) }))),
        };
      }));
      continue;
    }

    // Na folha pessoal todo turno é seu: pintar o próprio nome não separaria
    // nada, e a pergunta passa a ser "em que hospital?".
    porDia.set(d, doDia.flatMap((p) => partesDoPlantao(p.hora_inicio, p.hora_fim)
      .map((parte) => ({
        letra: parte.rotulo,
        pastilhas: [{ texto: p.local || "Sem local", cor: cor(p.local || "Sem local") }],
      }))));
  }
  return porDia;
}

/** O título da folha — o mesmo da versão em HTML, para os dois não divergirem. */
export function tituloDaFolha(f: FolhaDaEscala): string {
  const hospitais = [...new Set(f.plantoes.map((p) => p.local).filter(Boolean))];
  return f.doGrupo
    ? `Escala da equipe${hospitais.length === 1 ? ` — ${hospitais[0]}` : ""} — ${mesEmMaiusculas(f.nomeMes)} de ${f.ano}`
    : `Meus plantões — ${mesEmMaiusculas(f.nomeMes)} de ${f.ano}`;
}

/**
 * O recuo do dia: onde as pastilhas começam, depois do rótulo da faixa.
 *
 * Não é um número fixo, e essa foi a correção. Na folha do grupo o rótulo é uma
 * letra — "M", "T", "N" —, e um recuo de uma letra e meia bastava. Na folha
 * PESSOAL o rótulo é o turno por extenso: "07-13h", "Diurno", "Noturno". Com o
 * recuo fixo, a pastilha do hospital era desenhada POR CIMA do rótulo, e a
 * folha saía com "Diu" e "Not" espiando debaixo do azul.
 *
 * O recuo sai medido do rótulo mais largo DA CÉLULA, para as pastilhas do
 * mesmo dia começarem todas na mesma coluna — que é o que deixa ler o dia de
 * cima para baixo.
 */
export function recuoDoDia(faixas: Faixa[], fonte: number): number {
  let maior = 0;
  for (const faixa of faixas)
    maior = Math.max(maior, larguraDoTexto(faixa.letra, fonte - 0.4, true));
  return maior + fonte * 0.5;
}

/**
 * Quantas linhas de pastilha uma faixa ocupa numa largura dada.
 *
 * É esta conta que decide se a folha cabe: com três anestesistas de manhã numa
 * célula de 110pt, a faixa "M" ocupa duas linhas, e seis dias assim empurram a
 * grade para além do papel.
 */
function linhasDaFaixa(faixa: Faixa, largura: number, fonte: number): number {
  if (!faixa.pastilhas.length) return 1;
  let linhas = 1, usado = 0;
  for (const p of faixa.pastilhas) {
    const l = Math.min(larguraDoTexto(p.texto, fonte, true) + fonte * 0.9, largura);
    if (usado > 0 && usado + l > largura) { linhas++; usado = l + 2; }
    else usado += l + 2;
  }
  return linhas;
}

/**
 * Desenha a folha e devolve o PDF pronto, como texto de bytes.
 *
 * O tamanho da letra não é escolhido: é procurado. A função desenha do maior
 * para o menor e para no primeiro que couber na altura do papel — é o mesmo
 * que a versão em HTML fazia com zoom, só que aqui a medida é minha e não
 * depende de o navegador ter aplicado a folha de estilo.
 */
export function escalaEmPdf(f: FolhaDaEscala): string {
  const emCores = f.emCores !== false;
  const paleta = PALETA_DA_FOLHA.map((hex) => emCores ? corDeHex(hex) : CINZA_TINTA);
  const conteudo = conteudoDosDias(f);
  const feriados = feriadosDoMes(f.mes);
  const titulo = tituloDaFolha(f);

  const totalDeCelulas = f.primeiroDiaSemana + f.diasNoMes;
  const semanas = Math.ceil(totalDeCelulas / 7);
  const larguraDaColuna = (A4_DEITADA.largura - MARGEM * 2) / 7;

  // Os rótulos da legenda saem do que ESTA folha escreve, e não do cadastro: o
  // mês em que oito das treze pessoas não pegaram plantão não é um mês com
  // treze nomes na parede.
  const rotulos = [...new Map([...conteudo.values()].flat()
    .flatMap((faixa) => faixa.pastilhas)
    .map((p) => [p.texto, p.cor] as const)).entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  const topoDaGrade = MARGEM + (f.instituicao ? 46 : 34);
  const alturaDaLegenda = rotulos.length ? 16 : 0;
  const rodape = 12;
  const alturaUtil = A4_DEITADA.altura - MARGEM - rodape - alturaDaLegenda - topoDaGrade;
  const alturaDoCabecalho = 13;

  // A BUSCA PELO TAMANHO DA LETRA.
  //
  // Ela é procurada, e não escolhida. A escala fica pregada na parede e é lida
  // de pé, a um passo: cada décimo de ponto a mais é legibilidade de verdade.
  // Um mês tranquilo tem folga de sobra no papel, e desperdiçá-la para deixar a
  // letra num tamanho fixo seria escolher a folha errada de propósito.
  //
  // O teto de 11pt existe porque acima disso a pastilha fica maior que o nome e
  // a grade parece um cartaz. O piso de 4,6pt é onde o nome ainda se lê de
  // perto; abaixo dele a pastilha passa a ser cortada, porque nome ilegível não
  // informa nada.
  const alturaDaLinhaDaFaixa = (tam: number) => tam + 3.4;
  const alturaDaSemanaMaisCheia = (tam: number) => {
    let maior = 0;
    for (let semana = 0; semana < semanas; semana++) {
      for (let col = 0; col < 7; col++) {
        const d = semana * 7 + col - f.primeiroDiaSemana + 1;
        const faixas = conteudo.get(d);
        if (!faixas?.length) continue;
        const recuo = recuoDoDia(faixas, tam);
        const linhas = faixas.reduce((soma, faixa) =>
          soma + linhasDaFaixa(faixa, larguraDaColuna - 6 - recuo, tam), 0);
        // O número do dia e o nome do feriado moram acima das faixas.
        maior = Math.max(maior, linhas * alturaDaLinhaDaFaixa(tam) + tam + 8);
      }
    }
    return maior;
  };
  // Todas as semanas têm a MESMA altura — é o que faz "quem faz as noites desta
  // semana" se ler correndo o olho na horizontal. Então quem manda no tamanho é
  // a semana mais cheia do mês, e não a soma delas: com a soma, um mês com uma
  // semana pesada e cinco vazias passaria no teste e estouraria a linha dessa
  // semana no papel.
  let fonte = 4.6;
  for (let tentativa = 11; tentativa >= 4.6; tentativa = Math.round((tentativa - 0.2) * 10) / 10) {
    if (alturaDaSemanaMaisCheia(tentativa) * semanas <= alturaUtil - alturaDoCabecalho) {
      fonte = tentativa;
      break;
    }
  }
  // A sobra é repartida entre as semanas: uma grade que para no meio do papel
  // com um vão branco embaixo parece folha cortada.
  const alturaDaSemana = (alturaUtil - alturaDoCabecalho) / semanas;

  const pagina = new Pagina(A4_DEITADA.largura, A4_DEITADA.altura);

  // ---- Cabeçalho ---------------------------------------------------------
  pagina.texto(MARGEM, MARGEM, titulo, { tamanho: 13, negrito: true, cor: CINZA_TINTA });
  const subtitulo = f.instituicao?.nome ?? "";
  if (subtitulo) pagina.texto(MARGEM, MARGEM + 17, subtitulo, { tamanho: 9, cor: CINZA_FRACO });
  pagina.texto(A4_DEITADA.largura - MARGEM, MARGEM + 2,
    `${mesEmMaiusculas(f.nomeMes)} · ${f.ano}`,
    { tamanho: 11, negrito: true, cor: CINZA_FRACO, alinhamento: "direita" });

  // ---- Cabeçalho da grade ------------------------------------------------
  pagina.retangulo(MARGEM, topoDaGrade, larguraDaColuna * 7, alturaDoCabecalho, CINZA_CABECA);
  for (let c = 0; c < 7; c++) {
    pagina.texto(MARGEM + larguraDaColuna * (c + 0.5), topoDaGrade + 3.5, DIAS_DA_SEMANA[c],
      { tamanho: 7, negrito: true, cor: CINZA_FRACO, alinhamento: "centro" });
  }

  // ---- As células --------------------------------------------------------
  for (let i = 0; i < semanas * 7; i++) {
    const col = i % 7, semana = Math.floor(i / 7);
    const d = i - f.primeiroDiaSemana + 1;
    const x = MARGEM + larguraDaColuna * col;
    const y = topoDaGrade + alturaDoCabecalho + alturaDaSemana * semana;
    const dentroDoMes = d >= 1 && d <= f.diasNoMes;
    const dia = `${f.mes}-${String(d).padStart(2, "0")}`;
    const feriado = dentroDoMes ? feriados.get(dia) : undefined;
    const fds = col === 0 || col === 6;

    const fundo = !dentroDoMes ? CINZA_CABECA : feriado ? FUNDO_FERIADO : fds ? FUNDO_FDS : BRANCO;
    pagina.retangulo(x, y, larguraDaColuna, alturaDaSemana, fundo);
    pagina.linha(x, y, x, y + alturaDaSemana, CINZA_LINHA);
    pagina.linha(x, y, x + larguraDaColuna, y, CINZA_LINHA);
    if (!dentroDoMes) continue;

    pagina.texto(x + 3, y + 2.5, String(d),
      { tamanho: fonte + 1.2, negrito: true, cor: CINZA_TINTA });
    if (feriado) {
      pagina.texto(x + larguraDaColuna - 3, y + 3, 
        cortarTexto(feriado.nome, larguraDaColuna - 20, fonte - 0.6),
        { tamanho: fonte - 0.6, cor: corDeHex("#9a6a12"), alinhamento: "direita" });
    }

    const faixas = conteudo.get(d) ?? [];
    let linhaY = y + fonte + 6;
    const recuo = recuoDoDia(faixas, fonte);
    const inicioDasPastilhas = x + 3 + recuo;
    const larguraDasPastilhas = larguraDaColuna - 6 - recuo;
    for (const faixa of faixas) {
      const alturaDaLinha = alturaDaLinhaDaFaixa(fonte);
      pagina.texto(x + 3, linhaY + 1.2, faixa.letra,
        { tamanho: fonte - 0.4, negrito: true, cor: CINZA_FRACO });
      if (!faixa.pastilhas.length) {
        // O traço só aparece em dia que TEM plantão: três traços num dia vago
        // é ruído, e o alinhamento das faixas é o que deixa ler "quem faz as
        // noites desta semana" correndo o olho na horizontal.
        pagina.texto(inicioDasPastilhas, linhaY + 1.2, "—",
          { tamanho: fonte - 0.6, cor: CINZA_LINHA });
        linhaY += alturaDaLinha;
        continue;
      }
      let px = inicioDasPastilhas, primeira = true;
      for (const p of faixa.pastilhas) {
        const texto = cortarTexto(p.texto, larguraDasPastilhas - fonte * 0.9, fonte, true);
        const largura = larguraDoTexto(texto, fonte, true) + fonte * 0.9;
        if (!primeira && px + largura > inicioDasPastilhas + larguraDasPastilhas) {
          linhaY += alturaDaLinha;
          px = inicioDasPastilhas;
        }
        primeira = false;
        pagina.pastilha(px, linhaY, largura, fonte + 2.6, 2, paleta[p.cor] ?? CINZA_TINTA);
        pagina.texto(px + fonte * 0.45, linhaY + 1.6, texto,
          { tamanho: fonte, negrito: true, cor: BRANCO });
        px += largura + 2;
      }
      linhaY += alturaDaLinha;
    }
  }
  const fimDaGrade = topoDaGrade + alturaDoCabecalho + alturaDaSemana * semanas;
  pagina.linha(MARGEM, fimDaGrade, MARGEM + larguraDaColuna * 7, fimDaGrade, CINZA_LINHA);
  pagina.linha(MARGEM + larguraDaColuna * 7, topoDaGrade,
    MARGEM + larguraDaColuna * 7, fimDaGrade, CINZA_LINHA);

  // ---- Legenda -----------------------------------------------------------
  if (rotulos.length) {
    let lx = MARGEM;
    const ly = fimDaGrade + 4;
    for (const [texto, cor] of rotulos) {
      const largura = larguraDoTexto(texto, 6.5, true) + 6;
      if (lx + largura > A4_DEITADA.largura - MARGEM) break;
      pagina.pastilha(lx, ly, largura, 9.5, 2, paleta[cor] ?? CINZA_TINTA);
      pagina.texto(lx + 3, ly + 1.6, texto, { tamanho: 6.5, negrito: true, cor: BRANCO });
      lx += largura + 4;
    }
  }

  // ---- Assinatura --------------------------------------------------------
  // O Λ da marca é desenhado, e não uma imagem: imagem no PDF exigiria embutir
  // e decodificar um PNG por causa de dois traços.
  const yAss = A4_DEITADA.altura - MARGEM - 2;
  const azul = emCores ? corDeHex("#0a84c8") : CINZA_FRACO;
  pagina.linha(MARGEM, yAss, MARGEM + 3.4, yAss - 7, azul, 1.3);
  pagina.linha(MARGEM + 3.4, yAss - 7, MARGEM + 6.8, yAss, azul, 1.3);
  pagina.texto(MARGEM + 10, yAss - 7.5, "AVANEST", { tamanho: 7.5, negrito: true, cor: CINZA_FRACO });
  pagina.texto(A4_DEITADA.largura - MARGEM, yAss - 7.5,
    `Impresso em ${f.impressoEm.toLocaleDateString("pt-BR")} às `
    + `${f.impressoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    { tamanho: 6.5, cor: CINZA_FRACO, alinhamento: "direita" });

  return montarPdf([pagina], titulo);
}
