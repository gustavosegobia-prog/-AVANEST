import { lerCRM } from "./equipe.ts";

/**
 * A MARCA D'ÁGUA DE QUEM ESTÁ USANDO (pedido de 28/10/2026).
 *
 * Nenhum navegador deixa um site impedir o print da tela. O que dá para fazer
 * é o print sair assinado: o nome, o CRM, a data e a hora de quem está logado,
 * repetidos bem clarinhos por cima dos protocolos e da calculadora de doses.
 * Quem pensa em mandar a tela para fora vê o próprio nome nela, e um print que
 * aparecer por aí diz de quem veio — a cláusula 12 dos termos de uso proíbe
 * copiar telas e protocolos.
 *
 * Aqui só a conta e o desenho, sem tela: components/marca-dagua-do-usuario.tsx
 * busca quem está logado e põe a marca por cima.
 */

export type QuemUsa = { nome: string; crm?: string | null };

const QUANDO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});

/** "Fulana de Tal · CRM 12345/PR · 28/10/2026 22:55" — o CRM só quando houver. */
export function textoDaMarca(quem: QuemUsa, agora: Date): string {
  const crm = lerCRM(quem.crm);
  const partes = [
    quem.nome.trim().replace(/\s+/g, " "),
    crm ? `CRM ${crm.numero}${crm.uf ? `/${crm.uf}` : ""}` : "",
    QUANDO.format(agora).replace(",", ""),
  ];
  return partes.filter(Boolean).join(" · ");
}

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const INCLINACAO = 20; // graus
const COS = Math.cos((INCLINACAO * Math.PI) / 180);
const SEN = Math.sin((INCLINACAO * Math.PI) / 180);
/** Até onde o texto inclinado pode ir na horizontal: cabe inteiro num celular de 360px. */
const ALCANCE_MAXIMO = 320;
/** A largura média de uma letra, em "em", da Arial em semi-negrito. */
const LETRA = 0.56;

export type Ladrilho = {
  url: string; largura: number; altura: number; corpo: number;
  /** Quanto o texto inclinado ocupa na horizontal: é isso que tem de caber na tela. */
  alcance: number;
};

/**
 * O texto num ladrilho SVG, inclinado, pronto para `mask-image`. O ladrilho
 * tem o tamanho do texto, e não um tamanho fixo: com um ladrilho mais largo
 * que a tela, o celular mostrava só o começo de cada linha ("Fulana de Tal ·
 * CRM 123…"). Nome comprido ganha letra menor, até um piso legível.
 *
 * A cor não está aqui: a máscara só usa o desenho, e quem pinta é o CSS, com a
 * cor do texto do tema — clara no escuro, escura no claro.
 */
export function ladrilhoDaMarca(texto: string): Ladrilho {
  const corpo = Math.round(Math.max(9, Math.min(13, ALCANCE_MAXIMO / (texto.length * LETRA * COS))) * 10) / 10;
  const comprimento = texto.length * LETRA * corpo;
  const alcance = Math.ceil(comprimento * COS);
  const largura = alcance + 32;
  const altura = Math.ceil(comprimento * SEN + corpo * COS + 90);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">` +
    `<text x="${largura / 2}" y="${altura / 2}" text-anchor="middle" dominant-baseline="middle" ` +
    `font-family="Arial, Helvetica, sans-serif" font-size="${corpo}" font-weight="600" ` +
    `transform="rotate(-${INCLINACAO} ${largura / 2} ${altura / 2})">${escapar(texto)}</text></svg>`;
  return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, largura, altura, corpo, alcance };
}
