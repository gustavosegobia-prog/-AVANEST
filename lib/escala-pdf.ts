import { feriadosDoMes } from "./feriados.ts";
import {
  PALETA_DA_FOLHA, TURNOS_DO_DIA, mesEmMaiusculas, nomeCurto,
  ordemDentroDoDia, partesDoPlantao, turnosCobertos,
  type PlantaoImpresso,
} from "./escala.ts";
import { Pagina, corDeHex, cortarTexto, larguraDoTexto, montarPdf, type Cor } from "./pdf.ts";

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
// As cores todas vivem em `temaDaFolha`, e não soltas aqui: são duas paletas
// completas — a colorida e a de preto e branco —, e uma constante solta seria
// usada por engano numa das duas.
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
 * Não é um número fixo. Na folha do grupo o rótulo é uma letra — "M", "T", "N".
 * Na PESSOAL é o turno por extenso: "07-13h", "Diurno", "Noturno". Com recuo
 * fixo a pastilha do hospital era desenhada POR CIMA do rótulo, e a folha saía
 * com "Diu" e "Not" espiando debaixo do azul.
 *
 * O recuo sai do rótulo mais largo DA CÉLULA, para as pastilhas do mesmo dia
 * começarem todas na mesma coluna — que é o que deixa ler o dia de cima para
 * baixo.
 */
export function recuoDoDia(faixas: Faixa[], fonte: number): number {
  let maior = 0;
  for (const faixa of faixas)
    maior = Math.max(maior, larguraDoTexto(faixa.letra, fonte * 0.92, true));
  return maior + fonte * 0.5;
}

/* --- As medidas do cartão ------------------------------------------------
   Elas vêm da TELA, e não de gosto: o calendário do aplicativo é o desenho que
   a equipe já conhece, e uma folha impressa com outra cara obriga a reaprender
   onde as coisas estão. As proporções abaixo são as do CSS (cartão de 12px de
   raio numa coluna de 187px, respiro de 5px, recheio de 7px) trazidas para a
   coluna de 113pt da folha A4 deitada. */
const VAO_ENTRE_CARTOES = 3;
const RAIO_DO_CARTAO = 6;
const RECHEIO_DO_CARTAO = 4;

/* E estas acompanham o tamanho da letra, porque é ele que muda de mês para
   mês. Os fatores saem do CSS: pastilha de 10px com 2px de recheio em cima e
   embaixo dá 1,62; o respiro entre pastilhas é 3px, ou 0,3. */
const alturaDaPastilha = (f: number) => f * 1.62;
const recheioDaFaixa = (f: number) => f * 0.18;
const vaoEntrePastilhas = (f: number) => f * 0.3;
const vaoEntreFaixas = (f: number) => f * 0.34;
const larguraDaPastilha = (texto: string, f: number) => larguraDoTexto(texto, f, true) + f;

/**
 * A largura de cada pastilha da faixa — todas na MESMA LINHA, sempre.
 *
 * UM TURNO NUNCA OCUPA DUAS LINHAS. Essa é a regra, e não uma preferência.
 * Quando as pastilhas quebravam, o dia com Matheus e Luana de manhã saía com um
 * nome embaixo do outro, e a escala perdia justamente a leitura horizontal que
 * é a razão de ela ser uma grade: as três tarjas do dia deixavam de ficar na
 * mesma altura em todos os dias, e "quem faz as noites desta semana" voltava a
 * ser lido dia por dia.
 *
 * Quando não cabe, quem cede é o NOME, e não a linha. A repartição é justa:
 * quem já é estreito fica do tamanho que tem, e a sobra vai para os largos —
 * assim "Ana" ao lado de "Maria Fernanda" não encolhe junto sem precisar.
 */
export function larguraDasPastilhas(faixa: Faixa, util: number, fonte: number): number[] {
  const naturais = faixa.pastilhas.map((p) => larguraDaPastilha(p.texto, fonte));
  if (naturais.length === 0) return [];
  const disponivel = util - vaoEntrePastilhas(fonte) * (naturais.length - 1);
  if (naturais.reduce((a, b) => a + b, 0) <= disponivel) return naturais;

  const larguras = [...naturais];
  const jaCabe = naturais.map(() => false);
  for (;;) {
    const quantosLivres = jaCabe.filter((c) => !c).length;
    if (!quantosLivres) break;
    const gastoPelosFixos = larguras.reduce((s, l, i) => s + (jaCabe[i] ? l : 0), 0);
    const cota = (disponivel - gastoPelosFixos) / quantosLivres;
    let mudou = false;
    larguras.forEach((l, i) => { if (!jaCabe[i] && l <= cota) { jaCabe[i] = true; mudou = true; } });
    if (!mudou) {
      larguras.forEach((_, i) => { if (!jaCabe[i]) larguras[i] = Math.max(cota, 0); });
      break;
    }
  }
  return larguras;
}

/** A faixa precisa cortar algum nome para caber numa linha? */
function apertaAlgumNome(faixa: Faixa, util: number, fonte: number): boolean {
  if (!faixa.pastilhas.length) return false;
  const naturais = faixa.pastilhas.map((p) => larguraDaPastilha(p.texto, fonte));
  return naturais.reduce((a, b) => a + b, 0)
    > util - vaoEntrePastilhas(fonte) * (naturais.length - 1);
}

/** A altura que um dia precisa, com o cartão e tudo dentro dele. */
function alturaDoDia(faixas: Faixa[], temFeriado: boolean, fonte: number): number {
  if (!faixas.length) return RECHEIO_DO_CARTAO * 2 + fonte * 1.5;
  // Uma linha por faixa, sempre — daí a conta ser esta, e não uma soma de
  // linhas quebradas.
  return RECHEIO_DO_CARTAO * 2 + fonte * 1.5 + (temFeriado ? fonte * 1.15 : 0)
    + faixas.length * (alturaDaPastilha(fonte) + recheioDaFaixa(fonte) * 2)
    + (faixas.length - 1) * vaoEntreFaixas(fonte);
}

/**
 * As cores da folha.
 *
 * O PRETO E BRANCO NÃO É A FOLHA COLORIDA COM AS CORES APAGADAS, e isso foi um
 * defeito real: pintar as quatorze cores todas do mesmo cinza-escuro deixava a
 * escala inteira com pastilhas idênticas — Eder, Matheus, Lucas e Thais no
 * mesmo azul quase preto, que é pior do que não ter cor nenhuma, porque parece
 * informação e não é.
 *
 * Sem cor, a pastilha vira BRANCA COM CONTORNO e o nome fica preto. Quem
 * separa passa a ser só o nome — que é o que sempre separou de verdade; a cor
 * apenas acelerava o reconhecimento. É o mesmo desenho que a folha em HTML já
 * usava para o preto e branco, e o motivo de a legenda sumir junto: sem cor,
 * ela não liga nada.
 */
function temaDaFolha(emCores: boolean) {
  if (!emCores) return {
    emCores: false,
    // Cinzas NEUTROS, e não os azulados do tema claro: numa impressora a laser
    // o azul-acinzentado vira um cinza qualquer, e numa jato de tinta gasta
    // ciano à toa para imprimir uma linha que era para ser cinza.
    cartao: corDeHex("#ffffff"), bordaDoCartao: corDeHex("#9a9a9a"),
    cartaoFds: corDeHex("#f2f2f2"), cartaoFeriado: corDeHex("#e6e6e6"),
    faixa: corDeHex("#f2f2f2"), faixaSobreFds: corDeHex("#ffffff"),
    letraDaFaixa: corDeHex("#3a3a3a"), numeroDoDia: corDeHex("#000000"),
    feriado: corDeHex("#000000"), tinta: corDeHex("#111111"),
    tintaFraca: corDeHex("#555555"), traco: corDeHex("#9a9a9a"),
    pastilhaFundo: () => corDeHex("#ffffff"),
    pastilhaBorda: corDeHex("#8a8a8a") as Cor | undefined,
    pastilhaTinta: corDeHex("#111111"),
    temLegenda: false,
  };
  // As cores são as do calendário da tela, uma a uma. Quem confere está com a
  // folha na parede e o telefone na mão: um Matheus roxo na tela e verde no
  // papel faria a cor deixar de ser atalho.
  return {
    emCores: true,
    cartao: corDeHex("#ffffff"), bordaDoCartao: corDeHex("#dae3ec"),
    cartaoFds: corDeHex("#eef3f8"), cartaoFeriado: corDeHex("#fbf0f1"),
    faixa: corDeHex("#eef3f8"), faixaSobreFds: corDeHex("#ffffff"),
    letraDaFaixa: corDeHex("#5a7086"), numeroDoDia: corDeHex("#5a7086"),
    feriado: corDeHex("#c02a30"), tinta: corDeHex("#0f2438"),
    tintaFraca: corDeHex("#5a7086"), traco: corDeHex("#dae3ec"),
    pastilhaFundo: (cor: number) => corDeHex(PALETA_DA_FOLHA[cor] ?? "#5a7086"),
    pastilhaBorda: undefined as Cor | undefined,
    pastilhaTinta: corDeHex("#ffffff"),
    temLegenda: true,
  };
}

/**
 * Desenha a folha e devolve o PDF pronto, como texto de bytes.
 *
 * O TAMANHO DA LETRA É PROCURADO, e o critério mudou depois de ver a folha
 * impressa. Antes ele só perguntava "cabe na altura?", e a resposta "sim" vinha
 * com a letra grande e as pastilhas QUEBRANDO LINHA: o dia com Matheus e Luana
 * de manhã saía com um nome embaixo do outro, e a escala perdia a leitura
 * horizontal que é a razão de ela ser uma grade.
 *
 * Agora ele procura o maior tamanho em que a folha cabe E ninguém quebra
 * linha. Só quando nem a menor letra resolve — um turno com quatro pessoas
 * numa coluna de 113pt não cabe em linha nenhuma — é que ele aceita a quebra,
 * e aí escolhe a maior letra que ainda cabe na altura.
 */
export function escalaEmPdf(f: FolhaDaEscala): string {
  const tema = temaDaFolha(f.emCores !== false);
  const conteudo = conteudoDosDias(f);
  const feriados = feriadosDoMes(f.mes);
  const titulo = tituloDaFolha(f);

  const semanas = Math.ceil((f.primeiroDiaSemana + f.diasNoMes) / 7);
  const larguraDaColuna =
    (A4_DEITADA.largura - MARGEM * 2 - VAO_ENTRE_CARTOES * 6) / 7;

  const rotulos = [...new Map([...conteudo.values()].flat()
    .flatMap((faixa) => faixa.pastilhas)
    .map((p) => [p.texto, p.cor] as const)).entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  const topoDaGrade = MARGEM + (f.instituicao ? 44 : 32);
  const alturaDoCabecalho = 13;
  const alturaDaLegenda = tema.temLegenda && rotulos.length ? 16 : 0;
  const alturaUtil = A4_DEITADA.altura - MARGEM - 12 - alturaDaLegenda - topoDaGrade;

  const diaDoIndice = (i: number) => i - f.primeiroDiaSemana + 1;
  const temFeriado = (d: number) =>
    Boolean(feriados.get(`${f.mes}-${String(d).padStart(2, "0")}`));

  const medir = (tam: number) => {
    let maisAlto = 0, apertados = 0;
    for (let i = 0; i < semanas * 7; i++) {
      const d = diaDoIndice(i);
      if (d < 1 || d > f.diasNoMes) continue;
      const faixas = conteudo.get(d) ?? [];
      maisAlto = Math.max(maisAlto, alturaDoDia(faixas, temFeriado(d), tam));
      const util = larguraDaColuna - RECHEIO_DO_CARTAO * 2 - recuoDoDia(faixas, tam);
      for (const faixa of faixas) if (apertaAlgumNome(faixa, util, tam)) apertados++;
    }
    return { maisAlto, apertados };
  };
  const espacoPorSemana = (alturaUtil - alturaDoCabecalho) / semanas;

  // A LETRA É PROCURADA, e o critério é: a maior em que a folha cabe na altura
  // E nenhum nome precisa ser cortado. Sem a segunda condição a letra crescia
  // até 11pt e os nomes saíam picotados sem necessidade — havia altura de
  // sobra, e o que faltava era largura.
  //
  // Se nem a menor letra evita o corte — um turno com quatro pessoas numa
  // coluna de 113pt não cabe inteiro de jeito nenhum —, vale a maior que cabe
  // na altura, e os nomes é que encurtam. Cortado é ruim; em duas linhas é pior.
  let fonte = 4.6, maiorQueCabeNaAltura: number | null = null;
  for (let t = 11; t >= 4.6; t = Math.round((t - 0.2) * 10) / 10) {
    const { maisAlto, apertados } = medir(t);
    if (maisAlto + VAO_ENTRE_CARTOES > espacoPorSemana) continue;
    if (maiorQueCabeNaAltura === null) maiorQueCabeNaAltura = t;
    if (apertados === 0) { fonte = t; maiorQueCabeNaAltura = null; break; }
  }
  if (maiorQueCabeNaAltura !== null) fonte = maiorQueCabeNaAltura;
  const alturaDoCartao = espacoPorSemana - VAO_ENTRE_CARTOES;

  const pagina = new Pagina(A4_DEITADA.largura, A4_DEITADA.altura);

  // ---- Cabeçalho ---------------------------------------------------------
  pagina.texto(MARGEM, MARGEM, titulo, { tamanho: 13, negrito: true, cor: tema.tinta });
  if (f.instituicao?.nome)
    pagina.texto(MARGEM, MARGEM + 17, f.instituicao.nome, { tamanho: 9, cor: tema.tintaFraca });
  pagina.texto(A4_DEITADA.largura - MARGEM, MARGEM + 2,
    `${mesEmMaiusculas(f.nomeMes)} · ${f.ano}`,
    { tamanho: 11, negrito: true, cor: tema.tintaFraca, alinhamento: "direita" });

  // ---- Os dias da semana, sem barra, como na tela -------------------------
  for (let c = 0; c < 7; c++) {
    pagina.texto(MARGEM + (larguraDaColuna + VAO_ENTRE_CARTOES) * c + larguraDaColuna / 2,
      topoDaGrade + 2, DIAS_DA_SEMANA[c],
      { tamanho: 7.5, negrito: true, cor: tema.tintaFraca, alinhamento: "centro" });
  }

  // ---- Os cartões dos dias ------------------------------------------------
  for (let i = 0; i < semanas * 7; i++) {
    const d = diaDoIndice(i);
    // Fora do mês NÃO desenha nada — nem cartão cinza. É o que a tela faz, e é
    // o certo: um retângulo antes do dia 1 parece um dia que existe e está vago.
    if (d < 1 || d > f.diasNoMes) continue;

    const col = i % 7, semana = Math.floor(i / 7);
    const x = MARGEM + (larguraDaColuna + VAO_ENTRE_CARTOES) * col;
    const y = topoDaGrade + alturaDoCabecalho + espacoPorSemana * semana;
    const feriado = feriados.get(`${f.mes}-${String(d).padStart(2, "0")}`);
    const fds = col === 0 || col === 6;

    const fundo = feriado ? tema.cartaoFeriado : fds ? tema.cartaoFds : tema.cartao;
    pagina.pastilha(x, y, larguraDaColuna, alturaDoCartao, RAIO_DO_CARTAO,
      fundo, tema.bordaDoCartao);

    pagina.texto(x + RECHEIO_DO_CARTAO, y + RECHEIO_DO_CARTAO, String(d),
      { tamanho: fonte * 1.25, negrito: true, cor: tema.numeroDoDia });
    if (feriado) {
      pagina.texto(x + larguraDaColuna - RECHEIO_DO_CARTAO, y + RECHEIO_DO_CARTAO + fonte * 0.2,
        cortarTexto(feriado.nome, larguraDaColuna - RECHEIO_DO_CARTAO * 2 - fonte * 2, fonte * 0.85, true),
        { tamanho: fonte * 0.85, negrito: true, cor: tema.feriado, alinhamento: "direita" });
    }

    const faixas = conteudo.get(d) ?? [];
    const recuo = recuoDoDia(faixas, fonte);
    const inicio = x + RECHEIO_DO_CARTAO + recuo;
    const util = larguraDaColuna - RECHEIO_DO_CARTAO * 2 - recuo;
    let topo = y + RECHEIO_DO_CARTAO + fonte * 1.5;

    for (const [n, faixa] of faixas.entries()) {
      if (n) topo += vaoEntreFaixas(fonte);
      const alturaDaFaixa = alturaDaPastilha(fonte) + recheioDaFaixa(fonte) * 2;

      // A FAIXA TEM FUNDO PRÓPRIO, como na tela. É ele que faz "quem faz as
      // noites desta semana" se ler correndo o olho na horizontal: as três
      // tarjas ficam sempre na mesma altura em todos os dias.
      //
      // No fim de semana o cartão já é tingido, e aí a faixa fica branca — a
      // tela inverte assim, para a tarja continuar aparecendo.
      if (faixa.pastilhas.length) {
        pagina.pastilha(x + RECHEIO_DO_CARTAO, topo,
          larguraDaColuna - RECHEIO_DO_CARTAO * 2, alturaDaFaixa,
          fonte * 0.4, fds || feriado ? tema.faixaSobreFds : tema.faixa);
      }

      const meioDaPrimeira = topo + recheioDaFaixa(fonte)
        + (alturaDaPastilha(fonte) - fonte * 0.92) / 2 - fonte * 0.08;
      pagina.texto(x + RECHEIO_DO_CARTAO + fonte * 0.2, meioDaPrimeira, faixa.letra,
        { tamanho: fonte * 0.92, negrito: true, cor: tema.letraDaFaixa });

      if (!faixa.pastilhas.length) {
        // A faixa sem ninguém FICA, e fica apagada. O vazio é a informação:
        // "sábado à noite não tem ninguém" é a pergunta que traz o coordenador
        // à escala, e uma faixa que some não responde nada.
        pagina.texto(inicio, meioDaPrimeira, "—",
          { tamanho: fonte * 0.9, cor: tema.traco });
        topo += alturaDaFaixa;
        continue;
      }

      const larguras = larguraDasPastilhas(faixa, util, fonte);
      let px = inicio;
      const py = topo + recheioDaFaixa(fonte);
      faixa.pastilhas.forEach((p, k) => {
        const largura = larguras[k];
        // SÓ CORTA QUEM FOI APERTADO DE VERDADE, e a comparação tem folga de
        // propósito. A largura da pastilha é "a do texto MAIS o recheio", e
        // depois voltava a "menos o recheio" para saber quanto de texto cabia —
        // uma ida e volta que em ponto flutuante devolve 27.600000000000001
        // onde entrou 27.6. A conta então dizia que o nome não cabia na
        // pastilha feita sob medida para ele, e "Gerusa" saía "Geru…" com meia
        // célula vazia ao lado.
        const natural = larguraDaPastilha(p.texto, fonte);
        const texto = largura >= natural - 0.01
          ? p.texto
          : cortarTexto(p.texto, largura - fonte, fonte, true);
        pagina.pastilha(px, py, largura, alturaDaPastilha(fonte), fonte * 0.3,
          tema.pastilhaFundo(p.cor), tema.pastilhaBorda, 0.6);
        pagina.texto(px + fonte * 0.5, py + (alturaDaPastilha(fonte) - fonte) / 2 + fonte * 0.09,
          texto, { tamanho: fonte, negrito: true, cor: tema.pastilhaTinta });
        px += largura + vaoEntrePastilhas(fonte);
      });
      topo += alturaDaFaixa;
    }
  }

  // ---- Legenda -----------------------------------------------------------
  const fimDaGrade = topoDaGrade + alturaDoCabecalho + espacoPorSemana * semanas;
  if (tema.temLegenda && rotulos.length) {
    let lx = MARGEM;
    for (const [texto, cor] of rotulos) {
      const largura = larguraDaPastilha(texto, 6.5);
      if (lx + largura > A4_DEITADA.largura - MARGEM) break;
      pagina.pastilha(lx, fimDaGrade + 2, largura, 10.5, 2, tema.pastilhaFundo(cor));
      pagina.texto(lx + 3.25, fimDaGrade + 4.2, texto,
        { tamanho: 6.5, negrito: true, cor: tema.pastilhaTinta });
      lx += largura + 4;
    }
  }

  // ---- Assinatura --------------------------------------------------------
  // O Λ da marca é desenhado: imagem no PDF exigiria embutir e decodificar um
  // PNG por causa de dois traços.
  const yAss = A4_DEITADA.altura - MARGEM - 2;
  const azul = tema.emCores ? corDeHex("#0a84c8") : tema.tintaFraca;
  pagina.linha(MARGEM, yAss, MARGEM + 3.4, yAss - 7, azul, 1.3);
  pagina.linha(MARGEM + 3.4, yAss - 7, MARGEM + 6.8, yAss, azul, 1.3);
  pagina.texto(MARGEM + 10, yAss - 7.5, "AVANEST",
    { tamanho: 7.5, negrito: true, cor: tema.tintaFraca });
  pagina.texto(A4_DEITADA.largura - MARGEM, yAss - 7.5,
    `Impresso em ${f.impressoEm.toLocaleDateString("pt-BR")} às `
    + `${f.impressoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    { tamanho: 6.5, cor: tema.tintaFraca, alinhamento: "direita" });

  return montarPdf([pagina], titulo);
}
