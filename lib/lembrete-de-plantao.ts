// ===========================================================================
// "Você tem plantão hoje às 19h"
// ===========================================================================
// O aviso que o sistema devia dar e não dava. Escala publicada avisa uma vez,
// no dia em que sai; o plantão é três semanas depois. Entre um e outro a
// pessoa trabalhou vinte dias, e é na véspera que ela precisa lembrar.
//
// ---------------------------------------------------------------------------
// NADA AQUI É AGENDADO. E É ISSO QUE FAZ A COISA FUNCIONAR.
//
// O caminho óbvio seria criar um "lembrete agendado" quando o plantão nasce, e
// depois cancelá-lo quando o plantão muda de dia, de hospital, de dono ou é
// apagado. Esse caminho tem um defeito que não dá para consertar: cada um
// desses eventos vira uma chance de o cancelamento falhar, e a falha aparece
// como um telefone tocando às 7h da manhã lembrando de um plantão que a pessoa
// repassou há duas semanas. Ninguém confia num lembrete depois disso.
//
// Aqui o lembrete é CALCULADO NA HORA DO ENVIO, a partir da escala como ela
// está naquele instante. Plantão cancelado não aparece na consulta; plantão
// repassado aparece na lista do NOVO dono e some da do antigo; plantão movido
// de dia é lido no dia novo. Não existe lembrete velho para cancelar, porque
// nunca existiu lembrete guardado — existe a escala, que é a verdade, e uma
// pergunta feita a ela de hora em hora.
//
// A única coisa gravada é o RECIBO do que já tocou (`avisos_enviados`), e ele
// só serve para não repetir.
//
// ---------------------------------------------------------------------------
// OS DOIS HORÁRIOS
//
//   plantão que começa às 19h  → avisa às 07h DO MESMO DIA
//   plantão que começa às 07h  → avisa às 19h DA VÉSPERA
//
// A regra geral é a mesma dita de outro jeito: avisa-se no começo do turno
// anterior. Quem entra à noite é avisado quando acorda; quem entra de manhã é
// avisado na noite anterior, a tempo de dormir cedo e deixar o alarme pronto.
// Avisar o plantão da manhã às 7h da manhã seria avisar com a pessoa já
// atrasada.
//
// O corte é ao MEIO-DIA, e não em "19h exatamente": a escala real tem plantão
// de 13h, de 18h e de 22h, e todos eles são turno da tarde/noite para quem vai
// trabalhar. Fixar em 19h deixaria o plantão das 22h sem lembrete nenhum.
// ===========================================================================

import { somarDias } from "./data-local.ts";

export type PlantaoParaLembrar = {
  id: string;
  data: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  situacao?: string | null;
  /** O nome do hospital, já resolvido — de `local_texto` ou do cadastro. */
  local?: string | null;
};

/** A partir de que hora um plantão conta como turno da tarde/noite. */
export const CORTE_DO_DIA = 12;

/** A que horas sai cada um dos dois lembretes, no relógio de Brasília. */
export const HORA_DO_AVISO_NOTURNO = 7;
export const HORA_DO_AVISO_DIURNO = 19;

const hhmm = (h?: string | null) => String(h ?? "").slice(0, 5);
const horaNumero = (h?: string | null) => Number(hhmm(h).slice(0, 2));

/**
 * Quando este plantão deve ser anunciado: "AAAA-MM-DDTHH:MM", hora de Brasília.
 *
 * Devolve "" para plantão sem data ou sem hora de início — sem os dois não há
 * como saber quando avisar, e chutar um horário seria pior do que não avisar.
 */
export function momentoDoLembrete(p: PlantaoParaLembrar): string {
  const data = String(p.data ?? "").slice(0, 10);
  const inicio = hhmm(p.hora_inicio);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(inicio)) return "";
  return horaNumero(inicio) >= CORTE_DO_DIA
    ? `${data}T${String(HORA_DO_AVISO_NOTURNO).padStart(2, "0")}:00`
    : `${somarDias(data, -1)}T${String(HORA_DO_AVISO_DIURNO).padStart(2, "0")}:00`;
}

/** O instante em que o plantão começa, no mesmo formato. */
export const inicioDoPlantao = (p: PlantaoParaLembrar) =>
  `${String(p.data ?? "").slice(0, 10)}T${hhmm(p.hora_inicio)}`;

/**
 * Este plantão deve ser anunciado agora?
 *
 * É uma JANELA, e não um horário exato, de propósito. Se a execução das 7h
 * falhar ou atrasar — e ela vai falhar algum dia —, a das 8h ainda entrega o
 * aviso. Um lembrete que chega uma hora atrasado serve; um que não chega, não.
 *
 * A janela fecha quando o plantão COMEÇA. Avisar "você tem plantão hoje às 19h"
 * às 20h é pior do que ficar calado: quem está lá dentro trabalhando não
 * precisa ser lembrado, e quem não está já perdeu.
 *
 * `agora` vem como "AAAA-MM-DDTHH:MM" no fuso de Brasília — o mesmo formato dos
 * outros dois lados da comparação. Comparar texto assim é seguro porque os três
 * estão no mesmo fuso e o formato é ordenável; converter para Date aqui
 * reabriria a porta do horário de verão que lib/data-local já fechou.
 */
export function deveAvisar(p: PlantaoParaLembrar, agora: string): boolean {
  if (String(p.situacao ?? "") === "cancelado") return false;
  const momento = momentoDoLembrete(p);
  if (!momento) return false;
  return momento <= agora && agora < inicioDoPlantao(p);
}

/** "19h" e "7h30" — como se diz a hora em voz alta, não como o banco a guarda. */
export function horaFalada(h?: string | null): string {
  const texto = hhmm(h);
  if (!/^\d{2}:\d{2}$/.test(texto)) return "";
  const [hora, minuto] = texto.split(":");
  return minuto === "00" ? `${Number(hora)}h` : `${Number(hora)}h${minuto}`;
}

const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** "Quarta, 17/09" — lido em UTC, para o dia não escorregar um para trás. */
export function diaEscrito(iso: string): string {
  const [ano, mes, dia] = String(iso).slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  const semana = SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()] ?? "";
  return `${semana}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

/** A chave do recibo e a `tag` da notificação — uma por plantão. */
export const chaveDoLembrete = (p: PlantaoParaLembrar) => `plantao-lembrete-${p.id}`;

/** Onde o toque abre: o plantão em si, e não a escala do mês. */
export const destinoDoLembrete = (p: PlantaoParaLembrar) =>
  `/dashboard?area=plantoes&plantao=${encodeURIComponent(p.id)}`;

/**
 * O que aparece na tela bloqueada.
 *
 * O HOSPITAL VAI NO TÍTULO, e não no corpo. Quem cobre três casas na mesma
 * semana precisa saber QUAL antes de qualquer outra coisa, e o título é a
 * única linha que nenhuma tela bloqueada corta. Repeti-lo no corpo — "plantão
 * hoje às 19h no Santa Casa" — gastaria metade da segunda linha dizendo de
 * novo o que a primeira já disse.
 *
 * "Hoje" e "amanhã" saem da comparação com a data de hoje, e não do horário em
 * que o lembrete deveria ter saído: com a janela de atraso, o aviso do plantão
 * da manhã pode sair às 6h do próprio dia, e ali "amanhã" seria mentira.
 */
export function textoDoLembrete(p: PlantaoParaLembrar, hojeISO: string): {
  titulo: string; corpo: string;
} {
  const data = String(p.data ?? "").slice(0, 10);
  const quando = data === hojeISO ? "hoje" : data === somarDias(hojeISO, 1) ? "amanhã" : "";
  const local = String(p.local ?? "").trim();
  const hora = horaFalada(p.hora_inicio);

  const titulo = [`🏥 Plantão${quando ? ` ${quando}` : ""}`, local]
    .filter(Boolean).join(" — ");

  // A data por extenso mesmo com o "hoje" no título: é a exigência de que o
  // aviso diga hospital, DATA e horário sem depender de o leitor confiar na
  // palavra "hoje" — que, num telefone que ficou na mesa a noite inteira, pode
  // estar sendo lida no dia seguinte.
  const corpo = [`${diaEscrito(data)}${hora ? `, às ${hora}` : ""}`.trim(), "Toque para ver os detalhes."]
    .filter(Boolean).join(". ");

  return { titulo, corpo };
}
