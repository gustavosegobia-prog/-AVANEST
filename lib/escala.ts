// ===========================================================================
// Escala: as contas e os formatos, longe da tela
// ===========================================================================
// Estas funções saíram do componente para poderem ser testadas. Não é
// organização por gosto: o arquivo .ics vai para o Calendário do iPhone do
// médico, e um erro aqui não aparece como tela quebrada — aparece como plantão
// no dia errado, três semanas depois, quando ninguém mais lembra de onde veio.
//
// Regra que vale para o arquivo inteiro: nada aqui toca em `document`, `window`
// ou Supabase. O que precisa de navegador fica no componente.
// ===========================================================================

export const hhmm = (t: string) => (t || "").slice(0, 5);

export const money = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * "07:00" + "19:00" -> "07-19h".
 *
 * É como o plantão é falado: ninguém diz "das sete horas às dezenove horas",
 * diz "o sete às dezenove". A hora cheia basta — plantão que começa 07:30 é
 * raro, e quando existe o detalhe está no painel do dia.
 */
export function faixa(inicio: string, fim: string): string {
  return `${hhmm(inicio).slice(0, 2)}-${hhmm(fim).slice(0, 2)}h`;
}

/**
 * Os três turnos do dia.
 *
 * Manhã, tarde e noite não são um enfeite do calendário: é assim que a escala
 * é pedida e é assim que a cobertura é conferida. "Quem está de tarde?" tem
 * resposta imediata na parede do hospital, e tinha de ter aqui.
 *
 * Os limites são 07h, 13h e 19h porque é a virada real do plantão brasileiro —
 * não 06/12/18, que é a divisão do relógio e não a do serviço. A noite vai até
 * as 07h do dia seguinte, e por isso termina em 31h: o intervalo é contado em
 * minutos corridos a partir da meia-noite do próprio dia.
 */
export const TURNOS_DO_DIA = [
  { id: "manha", nome: "Manhã", letra: "M", de:  7 * 60, ate: 13 * 60 },
  { id: "tarde", nome: "Tarde", letra: "T", de: 13 * 60, ate: 19 * 60 },
  { id: "noite", nome: "Noite", letra: "N", de: 19 * 60, ate: 31 * 60 },
] as const;

export type TurnoDoDia = (typeof TURNOS_DO_DIA)[number]["id"];

const emHoras = (minutos: number) =>
  `${String(Math.floor((minutos % 1440) / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

/**
 * Sol e lua: os dois turnos que a escala lança o tempo todo.
 *
 * Os horários são DERIVADOS das faixas do dia, e não escritos aqui de novo. O
 * diurno vai do começo da manhã ao começo da noite; o noturno, do começo da
 * noite ao começo da manhã. Repetir "07:00" e "19:00" num segundo lugar é
 * garantir que um dia alguém mude a virada do plantão num deles só — e aí o
 * botão do sol passa a lançar um turno que o calendário desenha meio na tarde
 * e meio na noite.
 */
export const TURNOS_RAPIDOS = [
  { id: "diurno", nome: "Diurno", icone: "☀️",
    inicio: emHoras(TURNOS_DO_DIA[0].de), fim: emHoras(TURNOS_DO_DIA[2].de) },
  { id: "noturno", nome: "Noturno", icone: "🌙",
    inicio: emHoras(TURNOS_DO_DIA[2].de), fim: emHoras(TURNOS_DO_DIA[0].de) },
] as const;

const emMinutos = (t: string) => {
  const [h, m] = hhmm(t).split(":");
  return Number(h || 0) * 60 + Number(m || 0);
};

/** Dois intervalos meio-abertos se cruzam? */
const cruza = (a1: number, a2: number, b1: number, b2: number) => a1 < b2 && b1 < a2;

/**
 * Quais turnos este plantão cobre.
 *
 * COBRE, e não "começa em". Um 07-19h aparece na manhã E na tarde, porque às
 * 15h ele está lá — se ele só constasse na manhã, a tarde apareceria
 * descoberta numa tela feita justamente para achar buraco de cobertura, e
 * alguém escalaria gente em cima de um plantão que já existe.
 *
 * O fim menor ou igual ao início vira o dia: 19-07h e 07-07h são a mesma
 * convenção que o resto do sistema usa. Por isso a comparação é feita também
 * com o plantão deslocado um dia para frente e um para trás — o 05-08h cobre
 * o fim da noite, e o plantão de 24h que começa às 20h volta a cobrir a manhã.
 */
export function turnosCobertos(inicio: string, fim: string): TurnoDoDia[] {
  const i = emMinutos(inicio);
  let f = emMinutos(fim);
  if (f <= i) f += 24 * 60;
  return TURNOS_DO_DIA
    .filter(({ de, ate }) => cruza(i, f, de, ate)
      || cruza(i + 1440, f + 1440, de, ate)
      || cruza(i - 1440, f - 1440, de, ate))
    .map((t) => t.id);
}

/** "Manhã", "Manhã e tarde", "24 horas" — o turno dito por extenso. */
export function nomeDoPeriodo(inicio: string, fim: string): string {
  const cobertos = turnosCobertos(inicio, fim);
  if (cobertos.length === 3) return "24 horas";
  const nomes = TURNOS_DO_DIA.filter((t) => cobertos.includes(t.id)).map((t) => t.nome);
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1].toLowerCase()}`;
  return nomes[0] ?? "";
}

/**
 * Títulos que vêm colados no nome no cadastro.
 *
 * "Dr. Gustavo Segobia" tem três palavras, e a primeira não é o nome de
 * ninguém. Sem esta lista as iniciais saíam "DS" — Dr + Segobia —, e a escala
 * do grupo mostrava a mesma letra D para todo médico do serviço, que é
 * exatamente o oposto de identificar quem está de plantão.
 */
const TITULOS = new Set(["dr", "dra", "drs", "dras", "doutor", "doutora",
                         "prof", "profa", "profs", "professor", "professora",
                         "sr", "sra", "srta"]);

/**
 * Partículas que ligam sobrenomes.
 *
 * Vão numa lista, e não por tamanho da palavra: "dos" e "das" têm três letras
 * e passariam por um filtro de comprimento, enquanto "Sá" e "Ré" têm duas e
 * são sobrenome de gente.
 */
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du",
                            "del", "della", "van", "von", "der", "la", "le", "y"]);

// O intervalo vai escapado, e não com os acentos literais: combining marks
// coladas na fonte do editor somem numa cópia e o filtro para de funcionar
// sem ninguém notar.
const semAcento = (p: string) =>
  p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\.$/, "").toLowerCase();

/**
 * O nome limpo, em pedaços: sem título na frente e sem partícula no meio.
 *
 * Se sobrar nada — alguém cadastrado só como "Dr." — devolve o que veio, para
 * a tela mostrar algo em vez de um espaço em branco.
 */
export function partesDoNome(nome: string): string[] {
  const cru = (nome || "").trim().split(/\s+/).filter(Boolean);
  const util = cru.filter((p, i) => {
    const n = semAcento(p);
    if (!n) return false;
    // O título só conta como título na frente do nome: "Souza Dias" tem um
    // sobrenome legítimo que não pode virar tratamento.
    if (i === 0 && TITULOS.has(n)) return false;
    return !PARTICULAS.has(n);
  });
  return util.length ? util : cru;
}

/**
 * "GUSTAVO SEGOBIA DA SILVA" -> "GS". "Dr. Gustavo Segobia" -> "GS".
 *
 * Para a célula do calendário, onde cabem duas letras e não cabe um nome.
 * Primeiro nome e último sobrenome, que é como se distingue um colega do
 * outro numa equipe de seis.
 */
export function iniciais(nome: string): string {
  const partes = partesDoNome(nome);
  if (!partes.length) return "?";
  return ((partes[0][0] ?? "")
    + (partes.length > 1 ? partes[partes.length - 1][0] ?? "" : "")).toUpperCase();
}

/**
 * "GUSTAVO SEGOBIA DA SILVA" -> "Gustavo Silva".
 *
 * Para o papel, e não para a tela. Na folha pregada na parede a inicial não
 * serve: quem lê é o colega do outro turno, a enfermagem, o plantonista que
 * chegou hoje — e nenhum deles decorou a legenda de cores.
 */
export function nomeCurto(nome: string): string {
  const partes = partesDoNome(nome);
  if (!partes.length) return "—";
  const capitalizar = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  return [partes[0], partes.length > 1 ? partes[partes.length - 1] : ""]
    .filter(Boolean).map(capitalizar).join(" ");
}

/**
 * Onde o plantão acontece, para a tela.
 *
 * Duas origens, e nunca as duas: o local do cadastro, que é do grupo, ou o
 * lugar escrito à mão, que existe para o plantão de fora — a sedação no
 * consultório de endoscopia, o hospital que não é do serviço. O cadastro
 * ganha quando os dois vierem preenchidos, o que o banco já impede.
 *
 * Local que sumiu do cadastro devolve "—" e não string vazia: uma linha da
 * escala sem lugar nenhum parece um erro de carregamento, e "—" diz que o
 * dado existe e o nome é que não foi achado.
 */
export function ondeFica(
  plantao: { local_id?: string | null; local_texto?: string | null },
  nomes: Map<string, string>,
  vazio = "Sem local",
): string {
  if (plantao.local_id) return nomes.get(plantao.local_id) ?? "—";
  return (plantao.local_texto ?? "").trim() || vazio;
}

/**
 * O apelido de cada colega para o botão de escalar rápido.
 *
 * Na planilha em que a escala era montada, a lista suspensa mostrava BRU, IGO,
 * FLA, TAY, GUS, ANA — o primeiro nome cortado, porque a coluna é estreita. É
 * rápido e todo mundo entende. Mas corte cego colide: Marcos e Marcelo viram
 * MAR os dois, e um clique errado escala outro anestesista para o plantão —
 * numa planilha alguém percebe e corrige, aqui vira a escala oficial do
 * serviço.
 *
 * Então o apelido é o primeiro nome INTEIRO, e só cresce quando precisa: com
 * dois Marcos entra a inicial do sobrenome, e com dois Marcos Silva entra o
 * sobrenome por extenso. Curto por padrão, sem nunca ficar ambíguo — a
 * desambiguação é calculada sobre a equipe de verdade, não adivinhada.
 *
 * Devolve na mesma ordem que recebeu, para o chamador casar com a lista dele.
 */
export function apelidosDaEquipe(equipe: { id: string; nome: string }[]): Map<string, string> {
  const capitalizar = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  const partes = equipe.map((c) => partesDoNome(c.nome).map(capitalizar));

  // Os degraus, do mais curto ao mais longo: "Marcos", "Marcos S.",
  // "Marcos Silva", e por fim o nome inteiro que veio do cadastro.
  const degraus = (p: string[]): string[] => {
    if (!p.length) return ["—"];
    const primeiro = p[0];
    if (p.length === 1) return [primeiro];
    const ultimo = p[p.length - 1];
    return [primeiro, `${primeiro} ${ultimo[0]}.`, `${primeiro} ${ultimo}`, p.join(" ")];
  };

  // Quantas pessoas este apelido alcançaria. Enquanto for mais de uma, o
  // apelido daquela pessoa sobe mais um degrau.
  const quantos = (rotulo: string) =>
    partes.filter((p) => degraus(p).includes(rotulo)).length;

  const mapa = new Map<string, string>();
  equipe.forEach((colega, i) => {
    const opcoes = degraus(partes[i]);
    // O último degrau entra mesmo se ainda colidir: dois cadastros com o nome
    // idêntico existem, e um botão sem texto seria pior que um botão repetido.
    mapa.set(colega.id, opcoes.find((op) => quantos(op) === 1) ?? opcoes[opcoes.length - 1]);
  });
  return mapa;
}

/**
 * "1 plantão" / "3 plantões".
 *
 * "plantão(ões)" é o atalho que economiza uma linha de código e custa a frase:
 * ninguém fala assim, e numa tela que o médico abre todo dia essa forma
 * emperrada aparece dezenas de vezes.
 */
export const plural = (n: number, um: string, muitos: string) =>
  `${n} ${n === 1 ? um : muitos}`;

export const rotuloSituacao = (s: string) =>
  ({ escalado: "Escalado", realizado: "Realizado", pago: "Pago", cancelado: "Cancelado" }[s] ?? s);

/** Soma horas a um "HH:MM", virando o dia quando passa da meia-noite. */
export function somarHoras(inicio: string, horas: number): string {
  const [h, m] = hhmm(inicio).split(":").map(Number);
  const total = (h * 60 + m + horas * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const escaparHTML = (s: string) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Vírgula, ponto e vírgula e barra invertida são separadores no .ics. */
export const textoICS = (s: string) =>
  String(s ?? "").replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/**
 * "2026-08-24" + "07:00" -> "20260824T070000".
 *
 * A data é montada componente a componente, e não por fatiar um toISOString():
 * `new Date("2026-08-24T00:00:00")` é meia-noite LOCAL, e o toISOString dela
 * num fuso a oeste de Greenwich cai no dia anterior. O plantão do dia 24
 * apareceria no dia 23 para todo o Brasil.
 */
export function carimboICS(data: string, hora: string, viraODia = false): string {
  const d = new Date(`${data}T00:00:00`);
  if (viraODia) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
    + `T${hhmm(hora).replace(":", "")}00`;
}

/**
 * Qual escala do grupo está aberta.
 *
 * O grupo não tem uma escala: tem uma por hospital. Uma da Santa Casa, outra
 * do Hospital da Unimed, outra do Instituto — serviços diferentes, equipes
 * diferentes, e cada uma se lê inteira sem a outra atravessada no meio. São
 * itens da coluna da esquerda, e não um filtro: filtro é algo que se aplica a
 * uma lista, e estas são listas diferentes.
 *
 * Três valores especiais além do id de um hospital:
 *   "todos" — a visão de conjunto, útil para achar buraco de cobertura
 *   "sem"   — os plantões lançados sem hospital, que existem e precisam
 *             aparecer em algum lugar, senão somem da escala e ninguém
 *             descobre por quê
 *
 * Id que não corresponde a hospital nenhum cai em "todos". É o que impede um
 * local arquivado, ou um cadastro que mudou, de esvaziar a tela em silêncio.
 */
export function filtroDeHospital(escolhido: string, idsDisponiveis: string[]): string {
  if (escolhido === "todos" || escolhido === "sem") return escolhido;
  return idsDisponiveis.includes(escolhido) ? escolhido : "todos";
}

/** O plantão entra nesta escala? */
export function plantaoNaEscala(localDoPlantao: string | null, escala: string): boolean {
  if (escala === "todos") return true;
  if (escala === "sem") return !localDoPlantao;
  return localDoPlantao === escala;
}

/**
 * Dá para confirmar este plantão AGORA?
 *
 * A janela vai do começo do dia do plantão até o fim do turno, com meia hora de
 * folga. Não é do dia inteiro: um turno de 19h às 7h termina no dia seguinte, e
 * cortar à meia-noite tornaria impossível confirmar o noturno — justamente o
 * turno em que a pessoa está mais cansada e mais precisa que seja um toque.
 *
 * A meia hora depois do fim é o tempo de tirar a luva e pegar o telefone.
 *
 * A regra vive no banco, que é quem decide de verdade. Esta cópia existe para a
 * tela não OFERECER o que o banco vai recusar: botão que só serve para dar erro
 * é pior do que botão nenhum. As duas precisam concordar, e é isto que os
 * testes daqui prendem.
 */
export function podeConfirmar(
  plantao: { data: string; hora_inicio: string; hora_fim: string },
  agora: Date,
): boolean {
  const [ano, mes, dia] = plantao.data.split("-").map(Number);
  const emMinutos = (hhmmss: string) => {
    const [h, m] = hhmmss.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  // Datas locais, e não UTC: o dia do plantão é o dia de quem trabalhou. Com
  // Date.UTC, um turno que começa às 21h em Brasília só ficaria confirmável
  // depois da meia-noite de lá.
  const comeco = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
  const viraODia = emMinutos(plantao.hora_fim) <= emMinutos(plantao.hora_inicio);
  const fim = new Date(ano, mes - 1, dia + (viraODia ? 1 : 0),
    Math.floor(emMinutos(plantao.hora_fim) / 60),
    emMinutos(plantao.hora_fim) % 60 + 30, 0, 0);
  return agora >= comeco && agora <= fim;
}

// ---------------------------------------------------------------------------
// A folha impressa
// ---------------------------------------------------------------------------

export type PlantaoImpresso = {
  data: string; hora_inicio: string; hora_fim: string; horas: number;
  valor: number; situacao: string; local: string; profissional: string;
};

/** A instituição que assina a folha: o que está cadastrado no local ativo. */
export type Instituicao = { nome: string; logo?: string | null };

/**
 * O timbre da folha impressa.
 *
 * A folha da escala é pregada na parede do centro cirúrgico e a da produção vai
 * para o faturamento do hospital — em ambas, quem recebe o papel precisa
 * reconhecer de onde ele veio antes de ler uma linha. É a mesma regra que já
 * vale para a ficha do paciente: o cabeçalho é da instituição onde se trabalha,
 * não da plataforma que imprimiu.
 *
 * O que não estiver cadastrado simplesmente não ocupa espaço. Sem logo, o nome
 * sozinho é o timbre; sem nome e sem logo, não há faixa nenhuma — e não fica um
 * buraco reservado esperando um arquivo que talvez nunca seja subido.
 *
 * Só entra imagem servida por http(s). O endereço vem do nosso próprio
 * armazenamento, mas ele atravessa o banco e termina dentro de um atributo
 * `src` numa janela que este código escreve: um `javascript:` guardado no
 * cadastro do local viraria código rodando na hora de imprimir.
 */
export function timbreDaFolha(instituicao?: Instituicao | null): string {
  const nome = (instituicao?.nome ?? "").trim();
  const logo = String(instituicao?.logo ?? "").trim();
  const imagem = /^https?:\/\//i.test(logo) ? logo : "";
  if (!nome && !imagem) return "";
  return '<header class="marca">'
    + (imagem ? `<img src="${escaparHTML(imagem)}" alt="">` : "")
    + (nome ? `<b>${escaparHTML(nome)}</b>` : "")
    + "</header>";
}

/**
 * O corpo da folha da escala.
 *
 * Duas folhas diferentes, e não uma com um filtro. A do grupo é a que se prega
 * na parede do centro cirúrgico, e nela não entra valor nenhum: quanto cada um
 * recebe é assunto dele com quem paga, e uma folha na parede é lida por todo
 * mundo que passa — inclusive por quem não deveria ver aquilo. A pessoal é a
 * que vai junto do talão, e essa traz o valor porque é para isso que serve.
 *
 * A função devolve texto e não imprime nada: assim ela pode ser conferida sem
 * abrir navegador, que é o único jeito de garantir que o dia 31 não escorregou
 * para a semana errada.
 */
export function corpoDaFolha(opts: {
  doGrupo: boolean;
  mes: string;            // "2026-08"
  nomeMes: string;        // "agosto"
  ano: number;
  diasNoMes: number;
  primeiroDiaSemana: number; // 0 = domingo
  plantoes: PlantaoImpresso[];
  impressoEm: Date;
  /**
   * A instituição que timbra a folha, quando a folha é de uma só.
   *
   * Quem decide é quem chama: a escala do grupo já vem filtrada por hospital, e
   * a pessoal pode atravessar três. Carimbar a Santa Casa numa folha que também
   * traz plantões da Unimed seria um papel que se diz de um lugar onde metade
   * do que está impresso não aconteceu.
   */
  instituicao?: Instituicao | null;
}): { titulo: string; corpo: string } {
  const { doGrupo, mes, nomeMes, ano, diasNoMes, primeiroDiaSemana, plantoes } = opts;

  // Quantos hospitais esta folha cobre. Sai dos dados, e não de um parâmetro:
  // assim o título e as células nunca discordam do que está impresso.
  const hospitais = [...new Set(plantoes.map((p) => p.local).filter(Boolean))];
  const variosHospitais = hospitais.length > 1;

  const celulas: string[] = Array.from({ length: primeiroDiaSemana }, () => '<td class="vazio"></td>');
  for (let d = 1; d <= diasNoMes; d++) {
    const dia = `${mes}-${String(d).padStart(2, "0")}`;
    const doDia = plantoes.filter((p) => p.data === dia);
    // No grupo, os turnos iguais viram uma linha só com as pessoas dentro:
    // "07-19h / Gustavo Silva, Ana Souza". É como a escala é lida na parede —
    // pelo turno, não por pessoa —, e num serviço com seis anestesistas de dia
    // a lista por pessoa não caberia na célula.
    const conteudo = doGrupo
      ? Object.values(doDia.reduce<Record<string, {
          local: string; inicio: string; fim: string; gente: string[];
        }>>((acc, p) => {
          // O hospital entra na chave. Sem ele, o turno das 07h da Santa Casa e
          // o das 07h do Hospital da Unimed viravam uma linha só, com as duas
          // equipes juntas — uma escala que não existe em lugar nenhum.
          const chave = `${p.local}|${p.hora_inicio}|${p.hora_fim}`;
          acc[chave] ??= { local: p.local, inicio: p.hora_inicio, fim: p.hora_fim, gente: [] };
          acc[chave].gente.push(nomeCurto(p.profissional));
          return acc;
        }, {}))
        .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.local.localeCompare(b.local))
        .map((t) => `<span class="t"><b>${escaparHTML(faixa(t.inicio, t.fim))}`
          // Numa folha de um hospital só, repetir o nome em cada célula é ruído;
          // numa folha com vários, é a única coisa que separa os serviços.
          + `${variosHospitais && t.local ? ` · ${escaparHTML(t.local)}` : ""}</b>`
          + `<span>${escaparHTML(t.gente.join(", "))}</span></span>`).join("")
      : doDia.map((p) => `<span class="t"><b>${escaparHTML(faixa(p.hora_inicio, p.hora_fim))}</b>`
          + `<span>${escaparHTML(p.local || "Sem local")}</span></span>`).join("");
    celulas.push(`<td><span class="d">${d}</span>${conteudo}</td>`);
  }
  // A última semana completa sete colunas: sem isto o navegador estica a
  // célula do dia 31 por toda a largura restante da folha.
  while (celulas.length % 7 !== 0) celulas.push('<td class="vazio"></td>');
  const semanas: string[] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(`<tr>${celulas.slice(i, i + 7).join("")}</tr>`);

  // Folha de um hospital só leva o nome dele no título: é o que se lê primeiro
  // quando ela está pregada na parede daquele centro cirúrgico.
  const titulo = doGrupo
    ? `Escala da equipe${hospitais.length === 1 ? ` — ${hospitais[0]}` : ""} — ${nomeMes} de ${ano}`
    : `Meus plantões — ${nomeMes} de ${ano}`;

  // Na folha do grupo, o calendário É a folha, e mais nada. A lista turno a
  // turno de um serviço com seis anestesistas passa de noventa linhas e
  // atravessa quatro páginas que ninguém prega na parede; e a tabela de
  // quantos plantões couberam a cada um vira ranking afixado no corredor,
  // que não é assunto de escala. Quem precisa desse número tem a tela.
  const depois = doGrupo
    ? ""
    : `<table class="lista"><colgroup><col style="width:8%"><col style="width:14%"><col style="width:8%">`
      + `<col><col style="width:15%"><col style="width:13%"></colgroup>`
      + `<thead><tr><th>Dia</th><th>Horário</th><th>Horas</th><th>Local</th><th>Valor</th><th>Situação</th></tr></thead><tbody>${
        [...plantoes]
          .sort((a, b) => a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio))
          .map((p) => "<tr>"
            + `<td>${Number(p.data.slice(8, 10))}/${p.data.slice(5, 7)}</td>`
            + `<td>${escaparHTML(`${hhmm(p.hora_inicio)}–${hhmm(p.hora_fim)}`)}</td>`
            + `<td>${p.horas}h</td>`
            + `<td>${escaparHTML(p.local || "Sem local")}</td>`
            + `<td>${escaparHTML(money(p.valor))}</td>`
            + `<td>${escaparHTML(rotuloSituacao(p.situacao))}</td></tr>`).join("")
      }</tbody></table>`;

  const corpo = `${timbreDaFolha(opts.instituicao)}<h1>${escaparHTML(titulo)}</h1>
<p class="sub">${doGrupo
    ? "Escala da equipe. Trocas já aceitas estão refletidas nesta folha."
    : "Sua escala pessoal, com o valor combinado de cada turno."}</p>
<table class="mes"><thead><tr>${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]
    .map((d) => `<th>${d}</th>`).join("")}</tr></thead><tbody>${semanas.join("")}</tbody></table>
${depois}
<div class="rodape"><span>${plural(plantoes.length, "plantão", "plantões")} · ${
    plantoes.reduce((s, p) => s + Number(p.horas), 0).toLocaleString("pt-BR")}h${
    doGrupo ? "" : ` · ${money(plantoes.reduce((s, p) => s + Number(p.valor), 0))}`
  }</span><span>AVANEST · impresso em ${opts.impressoEm.toLocaleDateString("pt-BR")}</span></div>`;

  return { titulo, corpo };
}

export type PlantaoDoFechamento = PlantaoImpresso & {
  perfilId: string;
  /** ISO, ou null enquanto ninguém confirmou que trabalhou. */
  confirmadoEm: string | null;
};

/**
 * O fechamento do mês, por profissional — a folha que vai para o financeiro.
 *
 * É outro documento que a escala da parede, e a diferença não é de formato: a
 * da parede não leva valor NENHUM, porque é lida por todo mundo que passa no
 * corredor. Esta leva valor, nome e total de cada um, e vai para uma pessoa só,
 * que é quem paga. Foi por isso que a tabela por pessoa saiu da folha do grupo:
 * afixada, ela vira ranking; entregue ao financeiro, ela é a conta.
 *
 * A CONFIRMAÇÃO é o que dá valor a este papel. A escala é um plano — o plantão
 * trocado na véspera, o cancelado por sala fechada, o que virou meio turno
 * continuam lá do mesmo jeito. Sem separar confirmado de previsto, quem monta a
 * folha ou paga pelo plano e erra, ou liga para doze pessoas perguntando o que
 * aconteceu. Aqui os dois números aparecem lado a lado, e o que não foi
 * confirmado aparece marcado em vez de sumir: um plantão que a pessoa esqueceu
 * de confirmar não pode desaparecer da conta dela sem ninguém ver.
 *
 * Ordenado por nome, e não por total. Ordem por dinheiro é ranking, e ranking é
 * o que faz um documento de pagamento circular por motivo errado.
 */
export function folhaDeFechamento(
  plantoes: PlantaoDoFechamento[], nomeMes: string, ano: number, impressoEm: Date,
  instituicao?: Instituicao | null,
): { titulo: string; corpo: string } {
  const titulo = `Fechamento de plantões — ${nomeMes} de ${ano}`;

  const porPessoa = new Map<string, PlantaoDoFechamento[]>();
  for (const p of plantoes) {
    porPessoa.set(p.perfilId, [...(porPessoa.get(p.perfilId) ?? []), p]);
  }

  const gente = [...porPessoa.entries()]
    .map(([id, lista]) => {
      const confirmados = lista.filter((p) => p.confirmadoEm);
      const somar = (ls: PlantaoDoFechamento[], campo: "horas" | "valor") =>
        ls.reduce((s, p) => s + Number(p[campo] || 0), 0);
      return {
        id, lista,
        nome: nomeCurto(lista[0].profissional) || "Profissional",
        turnos: lista.length,
        confirmados: confirmados.length,
        horas: somar(confirmados, "horas"),
        valor: somar(confirmados, "valor"),
        horasPrevistas: somar(lista, "horas"),
        valorPrevisto: somar(lista, "valor"),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // O resumo vem primeiro porque é o que o financeiro usa: uma linha por
  // pessoa, com o que pagar. O detalhe dia a dia existe para conferir uma
  // linha que pareceu errada — e é por isso que vem depois, e não antes.
  const resumo = `<h2>Resumo do mês <small>${
    plural(gente.length, "profissional", "profissionais")}</small></h2>`
    + '<table class="lista"><colgroup><col><col style="width:12%"><col style="width:12%">'
    + '<col style="width:14%"><col style="width:16%"></colgroup>'
    + "<thead><tr><th>Profissional</th><th>Turnos</th><th>Confirmados</th>"
    + '<th class="num">Horas</th><th class="num">A pagar</th></tr></thead><tbody>'
    + gente.map((g) => "<tr>"
      + `<td>${escaparHTML(g.nome)}</td>`
      + `<td>${g.turnos}</td>`
      // O pendente aparece ao lado do confirmado, e não no lugar dele: "8 de
      // 10" diz de uma vez que falta confirmar dois, sem uma segunda tabela.
      + `<td>${g.confirmados}${g.confirmados < g.turnos ? ` <b>de ${g.turnos}</b>` : ""}</td>`
      + `<td class="num">${g.horas.toLocaleString("pt-BR")}h</td>`
      + `<td class="num">${escaparHTML(money(g.valor))}</td></tr>`).join("")
    + "</tbody><tfoot><tr>"
    + `<td><b>Total</b></td><td>${gente.reduce((s, g) => s + g.turnos, 0)}</td>`
    + `<td>${gente.reduce((s, g) => s + g.confirmados, 0)}</td>`
    + `<td class="num"><b>${gente.reduce((s, g) => s + g.horas, 0).toLocaleString("pt-BR")}h</b></td>`
    + `<td class="num"><b>${escaparHTML(money(gente.reduce((s, g) => s + g.valor, 0)))}</b></td>`
    + "</tr></tfoot></table>";

  const detalhe = gente.map((g) => {
    const linhas = [...g.lista]
      .sort((a, b) => a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio))
      .map((p) => `<tr${p.confirmadoEm ? "" : ' class="pendente"'}>`
        + `<td>${Number(p.data.slice(8, 10))}/${p.data.slice(5, 7)}</td>`
        + `<td>${escaparHTML(`${hhmm(p.hora_inicio)}–${hhmm(p.hora_fim)}`)}</td>`
        + `<td>${p.horas}h</td>`
        + `<td>${escaparHTML(p.local || "—")}</td>`
        + `<td>${p.confirmadoEm ? "Confirmado" : "Aguardando confirmação"}</td>`
        + `<td class="num">${escaparHTML(money(p.valor))}</td></tr>`).join("");
    return `<h2>${escaparHTML(g.nome)} <small>${
      plural(g.confirmados, "turno confirmado", "turnos confirmados")} · ${
      g.horas.toLocaleString("pt-BR")}h · ${escaparHTML(money(g.valor))}</small></h2>`
      + '<table class="lista"><colgroup><col style="width:9%"><col style="width:16%">'
      + '<col style="width:9%"><col><col style="width:21%"><col style="width:15%">'
      + "</colgroup><thead><tr><th>Dia</th><th>Horário</th><th>Horas</th><th>Local</th>"
      + '<th>Situação</th><th class="num">Valor</th></tr></thead>'
      + `<tbody>${linhas}</tbody></table>`;
  }).join("");

  const aConfirmar = gente.reduce((s, g) => s + (g.turnos - g.confirmados), 0);

  const corpo = `${timbreDaFolha(instituicao)}<h1>${escaparHTML(titulo)}</h1>
<p class="sub">Plantões por profissional, para o fechamento do mês.${
    aConfirmar > 0
      // O aviso é o primeiro texto da folha porque muda o que se faz com ela:
      // pagar um fechamento com turnos pendentes é pagar um plano.
      ? ` <b>${plural(aConfirmar, "turno ainda não foi confirmado", "turnos ainda não foram confirmados")
        } por quem trabalhou — esses valores não entram no total.</b>`
      : " Todos os turnos foram confirmados por quem trabalhou."}</p>
${gente.length ? resumo + detalhe : '<p class="sub">Nenhum plantão neste mês.</p>'}
<div class="rodape"><span>${plural(plantoes.length, "turno", "turnos")} · ${
    gente.reduce((s, g) => s + g.horas, 0).toLocaleString("pt-BR")}h confirmadas de ${
    gente.reduce((s, g) => s + g.horasPrevistas, 0).toLocaleString("pt-BR")}h previstas</span><span>AVANEST · impresso em ${
    impressoEm.toLocaleDateString("pt-BR")}</span></div>`;

  return { titulo, corpo };
}

export type ItemDeProducao = {
  data: string; paciente: string; convenio: string;
  procedimento: string | null; valor: number; situacao: string;
};

const ROTULO_PRODUCAO: Record<string, string> = {
  a_cobrar: "A cobrar", faturado: "Faturado", recebido: "Recebido", glosado: "Glosado",
};

/**
 * A folha de faturamento do mês.
 *
 * Agrupada por convênio, e não por data, porque é assim que se cobra: cada
 * operadora recebe a sua remessa, e o particular é cobrado paciente a
 * paciente. Uma lista em ordem de dia obrigaria a pessoa a recortar a folha
 * com a tesoura antes de mandar.
 *
 * Esta folha SEMPRE traz nome de paciente e valor — é o documento de cobrança
 * de quem imprimiu, e ninguém mais tem acesso a ela. Diferente da escala do
 * grupo, que é pública dentro do serviço e por isso não leva valor nenhum.
 */
export function folhaDeProducao(
  itens: ItemDeProducao[], nomeMes: string, ano: number, impressoEm: Date,
  instituicao?: Instituicao | null,
): { titulo: string; corpo: string } {
  const titulo = `Produção — ${nomeMes} de ${ano}`;

  const grupos = new Map<string, ItemDeProducao[]>();
  for (const i of itens) {
    const k = i.convenio?.trim() || "Particular";
    grupos.set(k, [...(grupos.get(k) ?? []), i]);
  }

  const blocos = [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([convenio, lista]) => {
      const soma = lista.reduce((s, i) => s + Number(i.valor), 0);
      const linhas = [...lista]
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((i) => "<tr>"
          + `<td>${Number(i.data.slice(8, 10))}/${i.data.slice(5, 7)}</td>`
          + `<td>${escaparHTML(i.paciente)}</td>`
          + `<td>${escaparHTML(i.procedimento || "—")}</td>`
          + `<td class="num">${escaparHTML(money(i.valor))}</td>`
          + `<td>${escaparHTML(ROTULO_PRODUCAO[i.situacao] ?? i.situacao)}</td></tr>`).join("");
      return `<h2>${escaparHTML(convenio)} <small>${
        plural(lista.length, "paciente", "pacientes")} · ${escaparHTML(money(soma))}</small></h2>`
        + `<table class="lista"><colgroup><col style="width:9%"><col style="width:38%">`
        + `<col><col style="width:14%"><col style="width:13%"></colgroup>`
        + "<thead><tr><th>Dia</th><th>Paciente</th><th>Procedimento</th>"
        + '<th class="num">Valor</th><th>Situação</th></tr></thead>'
        + `<tbody>${linhas}</tbody></table>`;
    }).join("");

  const total = itens.reduce((s, i) => s + Number(i.valor), 0);
  const recebido = itens.filter((i) => i.situacao === "recebido")
    .reduce((s, i) => s + Number(i.valor), 0);

  const corpo = `${timbreDaFolha(instituicao)}<h1>${escaparHTML(titulo)}</h1>
<p class="sub">Pacientes anestesiados no mês, agrupados por convênio.</p>
${blocos || '<p class="sub">Nada anotado neste mês.</p>'}
<div class="rodape"><span>${plural(itens.length, "paciente", "pacientes")} · ${
    escaparHTML(money(total))} · recebido ${escaparHTML(money(recebido))} · a receber ${
    escaparHTML(money(total - recebido))}</span><span>AVANEST · impresso em ${
    impressoEm.toLocaleDateString("pt-BR")}</span></div>`;

  return { titulo, corpo };
}

export type EventoDeEscala = {
  id: string; data: string; hora_inicio: string; hora_fim: string;
  titulo: string; onde: string;
};

/**
 * A escala como arquivo .ics.
 *
 * Um arquivo, e não um link "adicionar ao Google": o link cria UM evento, e
 * uma escala tem vinte. O .ics é o formato que o iPhone abre sozinho no
 * Calendário e que o Google Agenda importa em Configurações → Importar — é o
 * mesmo arquivo para os dois, e não dois caminhos para manter.
 *
 * As horas vão sem fuso (nem TZID, nem Z) de propósito. Plantão das 07:00 é
 * das 07:00 no relógio do hospital; carimbar UTC faria o mesmo arquivo abrir
 * às 10:00 num aparelho configurado em outro fuso, que é o erro que aparece
 * justamente em quem viaja para dar plantão.
 */
export function montarICS(itens: EventoDeEscala[], agoraUTC = new Date()): string {
  const carimbo = agoraUTC.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const linhas = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AVANEST//Escala//PT-BR",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Escala AVANEST",
  ];
  for (const it of itens) {
    // Fim menor ou igual ao início é plantão que vira a noite: 19:00–07:00
    // termina no dia seguinte. Sem isto o evento teria duração negativa e o
    // Calendário do iOS descarta o VEVENT inteiro, em silêncio.
    const viraANoite = hhmm(it.hora_fim) <= hhmm(it.hora_inicio);
    linhas.push(
      "BEGIN:VEVENT",
      `UID:${it.id}@avanest`,
      `DTSTAMP:${carimbo}`,
      `DTSTART:${carimboICS(it.data, it.hora_inicio)}`,
      `DTEND:${carimboICS(it.data, it.hora_fim, viraANoite)}`,
      `SUMMARY:${textoICS(it.titulo)}`,
      ...(it.onde ? [`LOCATION:${textoICS(it.onde)}`] : []),
      "END:VEVENT",
    );
  }
  linhas.push("END:VCALENDAR");
  // CRLF é exigência do RFC 5545, e não preciosismo: o Calendário do iOS
  // recusa o arquivo inteiro com quebra de linha simples.
  return linhas.join("\r\n") + "\r\n";
}

// ===========================================================================
// As duas notas do mês
// ===========================================================================
// Um anestesiologista autônomo emite nota de duas coisas diferentes, e elas
// não podem sair da mesma lista: o PLANTÃO é hora à disposição, e o
// FATURAMENTO é o ato anestésico. O tomador costuma ser outro — o plantão é
// cobrado do hospital ou do grupo, e o ato pode ser cobrado do paciente, do
// hospital ou da operadora, variando de paciente para paciente dentro do
// mesmo hospital.
//
// Por isso são duas funções, e as duas quebram por hospital: cada nota é
// emitida contra um tomador, e uma folha que mistura hospitais obriga a pessoa
// a somar na calculadora antes de preencher a nota — que é exatamente o
// trabalho que o sistema existe para tirar dela.
// ===========================================================================

export type PlantaoParaNota = {
  data: string; hora_inicio: string; hora_fim: string;
  horas: number; valor: number; local: string;
};

/**
 * A folha de plantões do mês, por hospital.
 *
 * Diferente do fechamento do grupo, que quebra por PESSOA e vai para quem
 * paga a equipe. Esta é de uma pessoa só — quem imprimiu — e quebra por
 * hospital, porque é ela que vira nota: um total por tomador, pronto para
 * copiar no campo do valor.
 */
export function folhaDePlantoesPorLocal(
  plantoes: PlantaoParaNota[], nomeMes: string, ano: number, impressoEm: Date,
  instituicao?: Instituicao | null,
): { titulo: string; corpo: string } {
  const titulo = `Plantões para nota — ${nomeMes} de ${ano}`;

  const grupos = new Map<string, PlantaoParaNota[]>();
  for (const p of plantoes) {
    const k = p.local?.trim() || "Sem hospital";
    grupos.set(k, [...(grupos.get(k) ?? []), p]);
  }

  const blocos = [...grupos.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([local, lista]) => {
      const soma = lista.reduce((s, p) => s + Number(p.valor), 0);
      const horas = lista.reduce((s, p) => s + Number(p.horas), 0);
      const linhas = [...lista]
        .sort((a, b) => a.data.localeCompare(b.data) || a.hora_inicio.localeCompare(b.hora_inicio))
        .map((p) => "<tr>"
          + `<td>${Number(p.data.slice(8, 10))}/${p.data.slice(5, 7)}</td>`
          + `<td>${escaparHTML(p.hora_inicio.slice(0, 5))}–${escaparHTML(p.hora_fim.slice(0, 5))}</td>`
          + `<td class="num">${Number(p.horas).toFixed(1).replace(".", ",")} h</td>`
          + `<td class="num">${escaparHTML(money(p.valor))}</td></tr>`).join("");
      return `<h2>${escaparHTML(local)} <small>${
        plural(lista.length, "plantão", "plantões")} · ${
        horas.toFixed(1).replace(".", ",")} h · ${escaparHTML(money(soma))}</small></h2>`
        + '<table class="lista"><colgroup><col style="width:12%"><col style="width:26%">'
        + '<col style="width:18%"><col></colgroup>'
        + "<thead><tr><th>Dia</th><th>Horário</th>"
        + '<th class="num">Horas</th><th class="num">Valor</th></tr></thead>'
        + `<tbody>${linhas}</tbody></table>`;
    }).join("");

  const total = plantoes.reduce((s, p) => s + Number(p.valor), 0);
  const horas = plantoes.reduce((s, p) => s + Number(p.horas), 0);

  const corpo = `${timbreDaFolha(instituicao)}<h1>${escaparHTML(titulo)}</h1>
<p class="sub">Plantões do mês, separados por hospital — um total por nota.</p>
${blocos || '<p class="sub">Nenhum plantão neste mês.</p>'}
<div class="rodape"><span>${plural(plantoes.length, "plantão", "plantões")} · ${
    horas.toFixed(1).replace(".", ",")} h · ${escaparHTML(money(total))}</span><span>AVANEST · impresso em ${
    impressoEm.toLocaleDateString("pt-BR")}</span></div>`;

  return { titulo, corpo };
}

export type ItemDeFaturamento = ItemDeProducao & {
  local: string;
  /** "direto" | "hospital" | "convenio", ou null enquanto ninguém decidiu. */
  pagador: string | null;
};

const ROTULO_PAGADOR: Record<string, string> = {
  direto: "Recebimento direto",
  hospital: "Pago pelo hospital",
  convenio: "Pago pelo convênio",
};

/**
 * A folha de faturamento do mês, por hospital e por quem paga.
 *
 * Duas quebras, e as duas são necessárias por um motivo prático: a nota é
 * emitida contra UM tomador, e dentro de um mesmo hospital o tomador muda de
 * paciente para paciente. Só por hospital, a pessoa teria de separar as linhas
 * na mão; só por pagador, ela teria de somar hospital por hospital.
 *
 * O QUE AINDA NÃO FOI DECIDIDO APARECE SEPARADO, no fim, e nunca dentro de um
 * bloco de pagador. Uma linha sem pagador somada a qualquer um dos três viraria
 * nota emitida contra quem não deve — e o sistema não pode escolher tomador no
 * lugar de quem assina a nota.
 */
export function folhaDeFaturamento(
  itens: ItemDeFaturamento[], nomeMes: string, ano: number, impressoEm: Date,
  instituicao?: Instituicao | null,
): { titulo: string; corpo: string } {
  const titulo = `Faturamento para nota — ${nomeMes} de ${ano}`;

  const porLocal = new Map<string, ItemDeFaturamento[]>();
  for (const i of itens) {
    const k = i.local?.trim() || "Sem hospital";
    porLocal.set(k, [...(porLocal.get(k) ?? []), i]);
  }

  const tabela = (lista: ItemDeFaturamento[]) => {
    const linhas = [...lista]
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((i) => "<tr>"
        + `<td>${Number(i.data.slice(8, 10))}/${i.data.slice(5, 7)}</td>`
        + `<td>${escaparHTML(i.paciente)}</td>`
        + `<td>${escaparHTML(i.procedimento || "—")}</td>`
        + `<td>${escaparHTML(i.convenio?.trim() || "Particular")}</td>`
        + `<td class="num">${escaparHTML(money(i.valor))}</td></tr>`).join("");
    return '<table class="lista"><colgroup><col style="width:9%"><col style="width:34%">'
      + '<col><col style="width:18%"><col style="width:14%"></colgroup>'
      + "<thead><tr><th>Dia</th><th>Paciente</th><th>Procedimento</th>"
      + '<th>Convênio</th><th class="num">Valor</th></tr></thead>'
      + `<tbody>${linhas}</tbody></table>`;
  };

  const blocos = [...porLocal.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([local, doLocal]) => {
      const somaLocal = doLocal.reduce((s, i) => s + Number(i.valor), 0);
      const partes = ["direto", "hospital", "convenio", null].map((quem) => {
        const lista = doLocal.filter((i) => (i.pagador ?? null) === quem);
        if (lista.length === 0) return "";
        const soma = lista.reduce((s, i) => s + Number(i.valor), 0);
        const rotulo = quem === null
          ? "Sem pagador definido — decida antes de emitir"
          : ROTULO_PAGADOR[quem];
        return `<h3${quem === null ? ' class="pendente"' : ""}>${escaparHTML(rotulo)}`
          + ` <small>${plural(lista.length, "paciente", "pacientes")} · ${
            escaparHTML(money(soma))}</small></h3>${tabela(lista)}`;
      }).join("");
      return `<h2>${escaparHTML(local)} <small>${
        plural(doLocal.length, "paciente", "pacientes")} · ${
        escaparHTML(money(somaLocal))}</small></h2>${partes}`;
    }).join("");

  const total = itens.reduce((s, i) => s + Number(i.valor), 0);
  const semPagador = itens.filter((i) => !i.pagador);
  const pendente = semPagador.reduce((s, i) => s + Number(i.valor), 0);

  const aviso = semPagador.length > 0
    ? `<p class="sub pendente">${plural(semPagador.length, "paciente está", "pacientes estão")
      } sem pagador definido, somando ${escaparHTML(money(pendente))}. Esse valor não entra em nota nenhuma enquanto não for decidido.</p>`
    : "";

  const corpo = `${timbreDaFolha(instituicao)}<h1>${escaparHTML(titulo)}</h1>
<p class="sub">Atos anestésicos do mês, separados por hospital e por quem paga — um total por nota.</p>
${aviso}${blocos || '<p class="sub">Nada anotado neste mês.</p>'}
<div class="rodape"><span>${plural(itens.length, "paciente", "pacientes")} · ${
    escaparHTML(money(total))}</span><span>AVANEST · impresso em ${
    impressoEm.toLocaleDateString("pt-BR")}</span></div>`;

  return { titulo, corpo };
}
