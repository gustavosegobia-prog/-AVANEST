// ===========================================================================
// O relatório diário de quem está usando o AVANEST
// ===========================================================================
// Chega uma vez por dia, de manhã, no e-mail de quem é dono do produto. Serve
// para responder três perguntas antes do café: quem entrou ontem, quem está
// usando de verdade, e quem parou.
//
// ---------------------------------------------------------------------------
// A PAUSA POR INATIVIDADE VALE SÓ PARA AS CONTAS DA CAMPANHA
//
// O pedido original era pausar a conta de quem passasse TRÊS dias sem entrar —
// de todo mundo. Rodada contra a base real, a regra pegaria 14 dos 19 usuários
// ativos no primeiro dia, inclusive dois da equipe da casa que estavam naquela
// manhã com o aparelho ligado recebendo notificação.
//
// A razão é que anestesiologista não usa este sistema todo dia: a ficha sai em
// dia de ambulatório, a escala na virada do mês, o financeiro no fechamento.
// Três dias parado é o comportamento normal da profissão.
//
// Mostrado o número, o prazo virou CATORZE dias e o escopo foi estreitado para
// QUEM CHEGOU POR UMA CAMPANHA
// — `origem` preenchida, plano em teste, dono da própria organização. Aí a
// regra faz sentido: é gente que o dono do produto não conhece, que entrou por
// um link, e a pausa é o gancho para a conversa que ele quer ter. Equipe
// convidada, cortesia e assinante nunca são tocados; a trava está escrita na
// própria função do banco (`pausar_inativos_da_campanha`), e não só aqui.
//
// E pausar não apaga nada: `status` volta a 'ativo' com um clique no Admin, e
// os dados da pessoa continuam onde estavam.
//
// ---------------------------------------------------------------------------
// OS SINAIS, E O QUE ELES NÃO SÃO
//
// `sinaisDeAtencao` marca o que a conta tem de incomum: e-mail de domínio
// próprio, ausência de CRM, conta que nasceu e nunca voltou. NÃO são acusações
// e não dizem que alguém é concorrente — o sistema não tem como saber isso, e
// não vai inventar. São o que faz um nome merecer dois segundos de atenção de
// quem conhece o mercado.
// ===========================================================================

import { dataLocal } from "./data-local.ts";

export type UsuarioDoUso = {
  nome: string;
  email: string;
  crm: string | null;
  organizacao: string;
  plano: string;
  origem: string;
  conta_criada: string;
  ultimo_acesso: string | null;
  teste_ate: string | null;
  pacientes: number;
  avaliacoes: number;
  avaliacoes_concluidas: number;
  plantoes: number;
  aparelhos: number;
  ativo_nas_24h: boolean;
};

const DIA = 86_400_000;

/** Quantos dias inteiros sem entrar. Nunca acessou devolve a idade da conta. */
export function diasParado(u: UsuarioDoUso, agora: Date): number {
  const marco = u.ultimo_acesso ?? u.conta_criada;
  const quando = new Date(marco).getTime();
  if (Number.isNaN(quando)) return 0;
  return Math.max(0, Math.floor((agora.getTime() - quando) / DIA));
}

/** Entrou nas últimas 24 horas — é o corte de "novo" do relatório. */
export const entrouOntem = (u: UsuarioDoUso, agora: Date) =>
  agora.getTime() - new Date(u.conta_criada).getTime() <= DIA;

/**
 * Os provedores de e-mail pessoais mais comuns no Brasil.
 *
 * Fora desta lista é DOMÍNIO PRÓPRIO — clínica, hospital, empresa —, e isso
 * sozinho não quer dizer nada de ruim: metade dos hospitais dá e-mail à
 * equipe. Quer dizer só que há uma organização por trás do endereço, e é uma
 * informação que quem conhece o mercado lê num segundo.
 */
const PESSOAIS = new Set([
  "gmail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br",
  "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "live.com",
  "bol.com.br", "uol.com.br", "terra.com.br", "globo.com", "ig.com.br",
]);

export const dominioDoEmail = (email: string) =>
  String(email ?? "").toLowerCase().split("@")[1] ?? "";

/**
 * O que nesta conta merece um olhar.
 *
 * Sinais, não acusações. Nenhum deles diz que a pessoa é concorrente — o
 * sistema não sabe isso e não vai adivinhar. Eles existem para que um nome
 * incomum não passe despercebido no meio de uma lista.
 */
export function sinaisDeAtencao(u: UsuarioDoUso, agora: Date): string[] {
  const sinais: string[] = [];
  const dominio = dominioDoEmail(u.email);
  if (dominio && !PESSOAIS.has(dominio)) sinais.push(`e-mail de domínio próprio (${dominio})`);
  if (!String(u.crm ?? "").trim()) sinais.push("sem CRM informado");
  // Conta que nasceu e nunca voltou: pode ser desistência, pode ser só uma
  // olhada. Nos dois casos é o tipo de coisa que vale uma mensagem.
  if (u.ultimo_acesso && new Date(u.ultimo_acesso).getTime()
      - new Date(u.conta_criada).getTime() < 60_000 && diasParado(u, agora) >= 1) {
    sinais.push("entrou uma vez só, no dia do cadastro");
  }
  return sinais;
}

export type Relatorio = {
  /** "16/09/2026" — o dia do envio, no fuso do serviço. */
  dia: string;
  novos: UsuarioDoUso[];
  /** Mexeram em alguma coisa nas últimas 24h. */
  ativos: UsuarioDoUso[];
  /** Em teste grátis, com os dias que faltam. */
  emTeste: Array<UsuarioDoUso & { faltam: number }>;
  /** Parados há 3 dias ou mais, do mais parado para o menos. */
  parados: Array<UsuarioDoUso & { dias: number }>;
  /** Quem tem algum sinal — pode repetir gente das outras listas. */
  comSinais: Array<{ usuario: UsuarioDoUso; sinais: string[] }>;
  /** Contas da campanha, que é o recorte do relatório. */
  total: number;
  /** Usuários ativos do sistema inteiro, só para dar escala ao número acima. */
  totalGeral: number;
  /** Quem a rotina pausou hoje por inatividade. */
  pausados: Array<{ nome: string; email: string; dias: number }>;
};

/**
 * A partir de quantos dias sem entrar alguém aparece na lista de parados.
 *
 * TRÊS, e não catorze: aparecer na lista é AVISO, ser pausado é AÇÃO, e as duas
 * coisas não precisam do mesmo prazo. Se a lista só mostrasse quem já passou de
 * catorze dias, o dono do produto veria o nome da pessoa no mesmo e-mail em que
 * a conta dela foi desligada — tarde demais para uma mensagem que evitaria isso.
 */
export const DIAS_PARA_APARECER_PARADO = 3;

/** Dias sem entrar até a conta de campanha ser pausada. Ver a rota do relatório. */
export const DIAS_PARA_PAUSAR = 14;

/**
 * O relatório do dia.
 *
 * `usuarios` são SÓ AS CONTAS DA CAMPANHA — é o recorte que o dono do produto
 * pediu, e faz sentido: a equipe da casa ele acompanha de perto, e quem chega
 * por um link do Instagram é justamente quem ele não conhece. `totalGeral` vem
 * junto só para o número não parecer o sistema inteiro.
 */
export function montarRelatorio(
  usuarios: readonly UsuarioDoUso[], agora: Date,
  extra: { totalGeral?: number; pausados?: Relatorio["pausados"] } = {},
): Relatorio {
  const emTeste = usuarios
    .filter((u) => u.plano === "trial" && u.teste_ate)
    .map((u) => ({
      ...u,
      faltam: Math.max(0, Math.ceil(
        (new Date(u.teste_ate as string).getTime() - agora.getTime()) / DIA)),
    }))
    .sort((a, b) => a.faltam - b.faltam);

  const parados = usuarios
    .map((u) => ({ ...u, dias: diasParado(u, agora) }))
    .filter((u) => u.dias >= DIAS_PARA_APARECER_PARADO)
    .sort((a, b) => b.dias - a.dias);

  const comSinais = usuarios
    .map((usuario) => ({ usuario, sinais: sinaisDeAtencao(usuario, agora) }))
    .filter((x) => x.sinais.length > 0);

  return {
    dia: dataLocal(agora).split("-").reverse().join("/"),
    novos: usuarios.filter((u) => entrouOntem(u, agora)),
    ativos: usuarios.filter((u) => u.ativo_nas_24h),
    emTeste, parados, comSinais,
    total: usuarios.length,
    totalGeral: extra.totalGeral ?? usuarios.length,
    pausados: extra.pausados ?? [],
  };
}

/**
 * O assunto do e-mail.
 *
 * O NÚMERO VAI NO ASSUNTO, e não só no corpo: num relatório que chega todo dia,
 * o assunto é a única parte que se lê sempre. "Relatório diário" sozinho ensina
 * a arquivar sem abrir.
 */
export function assuntoDoRelatorio(r: Relatorio): string {
  const partes = [
    r.novos.length ? `${r.novos.length} nova${r.novos.length > 1 ? "s" : ""}` : "",
    r.ativos.length ? `${r.ativos.length} ativo${r.ativos.length > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return `AVANEST ${r.dia} — ${partes.length ? partes.join(", ") : "nenhum movimento"}`;
}

const linhaDoUsuario = (u: UsuarioDoUso) => {
  const feito = [
    u.avaliacoes_concluidas ? `${u.avaliacoes_concluidas} avaliação(ões)` : "",
    u.plantoes ? `${u.plantoes} plantão(ões)` : "",
    u.pacientes ? `${u.pacientes} paciente(s)` : "",
  ].filter(Boolean).join(", ");
  return `${u.nome} · ${u.email}${u.crm ? ` · CRM ${u.crm}` : " · SEM CRM"}`
    + `${feito ? ` — ${feito}` : " — nada lançado"}`;
};

/** O relatório em texto puro. É o que vai no corpo do e-mail. */
export function textoDoRelatorio(r: Relatorio): string {
  const bloco = (titulo: string, linhas: string[]) =>
    linhas.length ? `${titulo}\n${linhas.map((l) => `  · ${l}`).join("\n")}\n` : "";

  return [
    `AVANEST — relatório de ${r.dia}`,
    `${r.total} conta(s) vinda(s) da campanha · ${r.totalGeral} usuários ativos no sistema.`,
    "",
    r.pausados.length
      ? `CONTAS PAUSADAS HOJE POR INATIVIDADE\n`
        + r.pausados.map((x) => `  · ${x.nome} (${x.email}) — ${x.dias} dias sem entrar`).join("\n")
        + "\n  Elas veem a explicação no login e o caminho para falar com você.\n"
      : "",
    bloco("CONTAS NOVAS (24h)", r.novos.map((u) =>
      `${linhaDoUsuario(u)}${u.origem ? ` [veio de: ${u.origem}]` : ""}`)),
    bloco("USARAM NAS ÚLTIMAS 24H", r.ativos.map(linhaDoUsuario)),
    bloco("EM TESTE GRÁTIS", r.emTeste.map((u) =>
      `${u.nome} — ${u.faltam} dia(s) restante(s)`)),
    bloco(`PARADOS HÁ ${DIAS_PARA_APARECER_PARADO}+ DIAS`, r.parados.map((u) =>
      `${u.nome} — ${u.dias} dias sem entrar (${u.plano})`
      + `${u.dias < DIAS_PARA_PAUSAR
          ? ` · pausa em ${DIAS_PARA_PAUSAR - u.dias} dia(s)` : " · será pausada"}`)),
    // O bloco dos sinais vem por último e com o aviso junto: sem ele, uma lista
    // de nomes sob um título vago vira suspeita onde não há nada.
    r.comSinais.length
      ? `MERECEM UM OLHAR (sinais, não acusações — o sistema não sabe quem é concorrente)\n`
        + r.comSinais.map((x) => `  · ${x.usuario.nome} (${x.usuario.email}): ${x.sinais.join("; ")}`).join("\n")
      : "",
  ].filter(Boolean).join("\n");
}

const escapar = (t: string) => String(t)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A mesma coisa em HTML, para quem lê no celular. */
export function htmlDoRelatorio(r: Relatorio): string {
  const bloco = (titulo: string, linhas: string[]) =>
    linhas.length
      ? `<h3 style="font:600 14px system-ui;margin:22px 0 6px;color:#0f2438">${escapar(titulo)}</h3>`
        + `<ul style="margin:0;padding-left:18px;font:14px/1.6 system-ui;color:#0f2438">`
        + linhas.map((l) => `<li>${escapar(l)}</li>`).join("") + "</ul>"
      : "";
  return `<div style="max-width:620px;margin:0 auto;padding:20px;font-family:system-ui">`
    + `<h2 style="font:700 18px system-ui;margin:0">AVANEST — relatório de ${escapar(r.dia)}</h2>`
    + `<p style="font:14px system-ui;color:#5a7086;margin:4px 0 0">${r.total} conta(s) da campanha`
    + ` · ${r.totalGeral} usuários ativos no sistema.</p>`
    + bloco("Pausadas hoje por inatividade", r.pausados.map((x) =>
        `${x.nome} (${x.email}) — ${x.dias} dias sem entrar`))
    + bloco("Contas novas (24h)", r.novos.map((u) =>
        `${linhaDoUsuario(u)}${u.origem ? ` [veio de: ${u.origem}]` : ""}`))
    + bloco("Usaram nas últimas 24h", r.ativos.map(linhaDoUsuario))
    + bloco("Em teste grátis", r.emTeste.map((u) => `${u.nome} — ${u.faltam} dia(s) restante(s)`))
    + bloco(`Parados há ${DIAS_PARA_APARECER_PARADO}+ dias`, r.parados.map((u) =>
        `${u.nome} — ${u.dias} dias sem entrar (${u.plano})`
        + `${u.dias < DIAS_PARA_PAUSAR
            ? ` · pausa em ${DIAS_PARA_PAUSAR - u.dias} dia(s)` : " · será pausada"}`))
    + (r.comSinais.length
        ? bloco("Merecem um olhar", r.comSinais.map((x) =>
            `${x.usuario.nome} (${x.usuario.email}): ${x.sinais.join("; ")}`))
          + `<p style="font:12px system-ui;color:#5a7086">São sinais, não acusações: o sistema`
          + ` não tem como saber se alguém é concorrente, e não adivinha.</p>`
        : "")
    + `</div>`;
}
