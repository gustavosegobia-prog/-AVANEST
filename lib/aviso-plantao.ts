// Como um plantão é dito numa notificação.
//
// Duas linhas na tela bloqueada, lidas de relance, quase sempre por alguém que
// está fazendo outra coisa. O que estiver depois do primeiro corte não existe.
//
// O QUE FALTAVA. A mensagem dizia "o plantão de 02/09 às 07:00" — e para
// decidir se assume, a pessoa precisava abrir o sistema para descobrir duas
// coisas: se cai num dia útil e a que horas termina. Um plantão de 07:00 às
// 13:00 e um de 07:00 às 19:00 são decisões completamente diferentes, e a
// notificação mostrava os dois igual.
//
// O QUE NÃO ENTRA, de propósito: o VALOR do plantão. Ele existe no cadastro e
// seria a informação mais tentadora de incluir — e apareceria na tela
// bloqueada, para quem estiver por perto. Quanto um colega ganha por plantão
// não é assunto de quem olha o telefone dele no corredor.

import { FUSO } from "./data-local.ts";

export type PlantaoDoAviso = {
  data?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
};

const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const hhmm = (h?: string | null) => (h ? String(h).slice(0, 5) : "");

/**
 * O dia da semana de uma data "AAAA-MM-DD".
 *
 * Montada em UTC e lida em UTC. `new Date("2026-09-02")` já é meia-noite UTC, e
 * lê-la no fuso de São Paulo devolve o dia ANTERIOR às 21h — o mesmo erro de
 * fuso que trocava o dia na agenda. Aqui ele apareceria como "Terça" num
 * plantão de quarta, e ninguém desconfiaria do sistema por causa disso.
 */
export function diaDaSemana(iso: string): string {
  const [ano, mes, dia] = String(iso).slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  return SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()] ?? "";
}

/**
 * "Quarta, 02/09 · 07:00–19:00" — o plantão em uma linha.
 *
 * Sem o ano: quem recebe o aviso está decidindo sobre as próximas semanas, e o
 * ano ocupa espaço que o local usa melhor. Sem a hora de fim, mostra só o
 * começo, porque plantão sem fim cadastrado existe.
 */
export function quandoPlantao(p: PlantaoDoAviso): string {
  const iso = String(p.data ?? "").slice(0, 10);
  if (!iso) return "";
  const dia = iso.split("-").reverse().slice(0, 2).join("/");
  const semana = diaDaSemana(iso);
  const inicio = hhmm(p.hora_inicio);
  const fim = hhmm(p.hora_fim);
  const horas = inicio && fim ? `${inicio}–${fim}` : inicio;
  return [semana ? `${semana}, ${dia}` : dia, horas].filter(Boolean).join(" · ");
}

/** "Quarta, 02/09 · 07:00–19:00 · Santa Casa" — com o lugar, quando há. */
export function ondeEQuando(p: PlantaoDoAviso, local: string): string {
  return [quandoPlantao(p), (local || "").trim()].filter(Boolean).join(" · ");
}

/**
 * "Você tem 12 plantões em setembro." — o que a pessoa foi conferir.
 *
 * A mensagem anterior era "a escala está no ar, confira os seus plantões", que
 * manda abrir o sistema para descobrir a única coisa que interessa. Dizer o
 * número resolve a dúvida de quem tem plantão e poupa a abertura de quem não
 * tem nenhum.
 */
export function quantosPlantoes(quantidade: number, mes: string): string {
  const nome = new Date(`${mes}-02T12:00:00Z`)
    .toLocaleDateString("pt-BR", { month: "long", timeZone: FUSO });
  if (quantidade <= 0) return `Você não tem plantões em ${nome}.`;
  return quantidade === 1
    ? `Você tem 1 plantão em ${nome}.`
    : `Você tem ${quantidade} plantões em ${nome}.`;
}
