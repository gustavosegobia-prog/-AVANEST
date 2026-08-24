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

/** Diurno, Noturno ou 24h — o nome que a escala usa. */
export function periodoDoTurno(inicio: string, horas: number): string {
  if (horas >= 20) return "24h";
  const h = Number(hhmm(inicio).slice(0, 2));
  return h >= 18 || h < 5 ? "Noturno" : "Diurno";
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

// ---------------------------------------------------------------------------
// A folha impressa
// ---------------------------------------------------------------------------

export type PlantaoImpresso = {
  data: string; hora_inicio: string; hora_fim: string; horas: number;
  valor: number; situacao: string; local: string; profissional: string;
};

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
}): { titulo: string; corpo: string } {
  const { doGrupo, mes, nomeMes, ano, diasNoMes, primeiroDiaSemana, plantoes } = opts;

  const celulas: string[] = Array.from({ length: primeiroDiaSemana }, () => '<td class="vazio"></td>');
  for (let d = 1; d <= diasNoMes; d++) {
    const dia = `${mes}-${String(d).padStart(2, "0")}`;
    const doDia = plantoes.filter((p) => p.data === dia);
    // No grupo, os turnos iguais viram uma linha só com as pessoas dentro:
    // "07-19h / Gustavo Silva, Ana Souza". É como a escala é lida na parede —
    // pelo turno, não por pessoa —, e num serviço com seis anestesistas de dia
    // a lista por pessoa não caberia na célula.
    const conteudo = doGrupo
      ? Object.values(doDia.reduce<Record<string, { inicio: string; fim: string; gente: string[] }>>((acc, p) => {
          const chave = `${p.hora_inicio}|${p.hora_fim}`;
          acc[chave] ??= { inicio: p.hora_inicio, fim: p.hora_fim, gente: [] };
          acc[chave].gente.push(nomeCurto(p.profissional));
          return acc;
        }, {}))
        .sort((a, b) => a.inicio.localeCompare(b.inicio))
        .map((t) => `<span class="t"><b>${escaparHTML(faixa(t.inicio, t.fim))}</b>`
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

  const titulo = doGrupo
    ? `Escala da equipe — ${nomeMes} de ${ano}`
    : `Meus plantões — ${nomeMes} de ${ano}`;

  // Na folha do grupo, o calendário É a folha. A lista turno a turno de um
  // serviço com seis anestesistas passa de noventa linhas e atravessa quatro
  // páginas que ninguém prega na parede. No lugar dela vai o que se pergunta
  // de uma escala afixada: quantos plantões couberam a cada um.
  const depois = doGrupo
    ? `<table class="lista resumo"><thead><tr><th>Profissional</th><th>Plantões</th><th>Horas</th></tr></thead><tbody>${
        Object.entries(plantoes.reduce<Record<string, { n: number; h: number }>>((acc, p) => {
          const quem = nomeCurto(p.profissional);
          acc[quem] ??= { n: 0, h: 0 };
          acc[quem].n += 1; acc[quem].h += Number(p.horas);
          return acc;
        }, {}))
          .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
          .map(([quem, t]) => `<tr><td>${escaparHTML(quem)}</td><td>${t.n}</td>`
            + `<td>${t.h.toLocaleString("pt-BR")}h</td></tr>`).join("")
      }</tbody></table>`
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

  const corpo = `<h1>${escaparHTML(titulo)}</h1>
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
