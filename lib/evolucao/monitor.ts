// A foto do monitor no fim da cirurgia.
//
// O monitor guarda as tendências: uma tabela com a hora e os parâmetros
// aferidos em cada medida (PNI, FC, SpO₂…). No fim da cirurgia o
// anestesiologista fotografa essa tela — ou exporta o relatório em PDF — e a
// ficha lê os valores, em vez de ele digitar coluna por coluna.
//
// A LEITURA É SÓ UM RASCUNHO. Foto de tela tem reflexo e fonte de cristal
// líquido, e o OCR erra: cada linha lida aparece numa tabela para o médico
// conferir, corrigir e escolher o que entra. Nada é lançado sem ele confirmar,
// e o que entra fica marcado como "importado".
//
// O texto vem de lib/texto-do-laudo.ts: a foto é lida no próprio aparelho e
// descartada — não fica guardada em lugar nenhum.

import { PARAMETROS, valorPlausivel, type Parametro } from "./sinais.ts";

export type LinhaDoMonitor = { hora: string } & Partial<Record<Parametro, number>>;

/** Os parâmetros da tabela de conferência, na ordem das colunas. */
export const COLUNAS_DO_MONITOR: Parametro[] = ["pas", "pad", "pam", "fc", "spo2", "etco2", "temp"];

// Os nomes que os monitores usam no cabeçalho e ao lado do número.
const ROTULOS: Array<[Parametro, RegExp]> = [
  ["fc", /\b(fc|hr|pr|pulso|pulse|fp)\b/i],
  ["spo2", /\b(spo\s*2|spo₂|sp02|sat|sato2)\b/i],
  ["etco2", /\b(etco\s*2|etco₂|co\s*2|etc02)\b/i],
  ["pam", /\b(pam|map|m[ée]dia|mean)\b/i],
];

const HORA = /\b([01]?\d|2[0-3])\s*[:h]\s*([0-5]\d)\b/;
const PRESSAO = /\b(\d{2,3})\s*[/|]\s*(\d{2,3})(?:\s*\(\s*(\d{2,3})\s*\))?/;

/** A ordem das colunas depois da pressão, lida do cabeçalho da tabela (se houver). */
function ordemDoCabecalho(linhas: string[]): Parametro[] | null {
  for (const l of linhas) {
    if (HORA.test(l)) continue;
    const achados = ROTULOS
      .map(([p, re]) => ({ p, i: l.search(re) }))
      .filter((o) => o.i >= 0)
      .sort((a, b) => a.i - b.i)
      .map((o) => o.p);
    if (achados.length >= 2) return achados;
  }
  return null;
}

const plausivel = (p: Parametro, v: number | undefined): v is number => v !== undefined && valorPlausivel(p, v);

/**
 * As linhas da tabela de tendências. Cada linha com hora e ao menos um
 * parâmetro plausível vira uma linha; a mesma hora repetida se junta.
 */
export function lerTendencias(texto: string): LinhaDoMonitor[] {
  // Uma linha por horário. O PDF do monitor chega como texto corrido, sem
  // quebra de linha: cada hora encontrada abre uma linha nova.
  const linhas = texto.replace(/[|]/g, " ")
    .replace(new RegExp(`(?=${HORA.source})`, "g"), "\n")
    .split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ordem = ordemDoCabecalho(linhas) ?? ["fc", "spo2", "etco2"];
  const porHora = new Map<string, LinhaDoMonitor>();
  for (const bruta of linhas) {
    const h = bruta.match(HORA);
    if (!h) continue;
    const hora = `${h[1].padStart(2, "0")}:${h[2]}`;
    let resto = bruta.replace(h[0], " ");
    const linha: LinhaDoMonitor = { hora };

    const pa = resto.match(PRESSAO);
    if (pa) {
      const [pas, pad, pam] = [Number(pa[1]), Number(pa[2]), pa[3] ? Number(pa[3]) : undefined];
      if (plausivel("pas", pas) && plausivel("pad", pad) && pad < pas) {
        linha.pas = pas;
        linha.pad = pad;
        if (plausivel("pam", pam) && pam > pad && pam < pas) linha.pam = pam;
      }
      resto = resto.replace(pa[0], " ");
    }
    // A temperatura tem vírgula ou ponto: sai antes dos inteiros.
    const t = resto.match(/\b(3[3-9]|4[0-2])[.,](\d)\b/);
    if (t) { linha.temp = Number(`${t[1]}.${t[2]}`); resto = resto.replace(t[0], " "); }

    // Número com o nome do parâmetro ao lado ("FC 82", "SpO2 99").
    for (const [p, re] of ROTULOS) {
      const m = resto.match(new RegExp(`${re.source}\\s*[:=]?\\s*(\\d{1,3})`, "i"));
      if (m) {
        const v = Number(m[m.length - 1]);
        if (plausivel(p, v) && linha[p] === undefined) linha[p] = v;
        resto = resto.replace(m[0], " ");
      }
    }
    // O que sobrou, na ordem das colunas do cabeçalho.
    const numeros = [...resto.matchAll(/\b\d{1,3}\b/g)].map((m) => Number(m[0]));
    const livres = ordem.filter((p) => linha[p] === undefined);
    for (const p of livres) {
      const v = numeros.shift();
      if (v === undefined) break;
      if (plausivel(p, v)) linha[p] = v;
    }

    if (Object.keys(linha).length > 1) porHora.set(hora, { ...porHora.get(hora), ...linha });
  }
  return [...porHora.values()];
}

/** O texto curto de uma linha, para a confirmação: "10:05 · PA 118/68 · FC 80". */
export function resumoDaLinha(l: LinhaDoMonitor): string {
  const partes = [l.hora];
  if (l.pas !== undefined || l.pad !== undefined) partes.push(`PA ${l.pas ?? "—"}/${l.pad ?? "—"}`);
  for (const p of ["pam", "fc", "spo2", "etco2", "temp"] as Parametro[]) {
    if (l[p] !== undefined) partes.push(`${PARAMETROS[p].curto} ${l[p]}`);
  }
  return partes.join(" · ");
}
