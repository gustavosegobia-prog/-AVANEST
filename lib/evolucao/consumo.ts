// O verso da ficha: o consumo de materiais e medicamentos da sala.
//
// Na folha de papel do serviço (a planilha do Matheus, aba "verso"), o verso
// é a lista que vai para o faturamento: cânulas, sondas, agulhas, seringas,
// soros e cada ampola ou frasco aberto, com a quantidade. Os códigos de
// estoque que a planilha traz ao lado dos medicamentos são daquele hospital;
// aqui fica só o nome, que vale em qualquer lugar.
//
// Grava no cabeçalho da ficha (`dados.consumo`), com o mesmo histórico de
// auditoria das outras partes do cabeçalho.
//
// "TRAZER DA FICHA" faz a conta que dá para fazer sozinho: a dose total de
// cada medicamento dividida pelo conteúdo da ampola (fentanil 300 mcg, ampola
// de 0,1 mg/mL × 2 mL = 200 mcg → 2 ampolas), o TOT e a agulha de raqui da
// técnica, e os soros pelo volume registrado. É ponto de partida: o
// anestesiologista confere e corrige antes de assinar.

import { agruparPorMedicamento, converterMassa, mesmoFarmaco, type Administracao } from "./medicamentos.ts";
import type { Registro } from "./registros.ts";

export type GrupoDoConsumo = "vias" | "agulhas" | "soros" | "medicamentos" | "outros";

export const TITULO_DO_CONSUMO: Record<GrupoDoConsumo, string> = {
  vias: "Vias aéreas e sondas", agulhas: "Agulhas e seringas", soros: "Soros", medicamentos: "Medicamentos", outros: "Outros",
};

export type ItemDoConsumo = {
  nome: string;
  grupo: GrupoDoConsumo;
  /** Pede o número (calibre) ao lado: "Cânula orotraqueal c/ cuff nº 7,5". */
  comNumero?: boolean;
  /** O princípio ativo, para casar com o que foi administrado. */
  farmaco?: string;
  /** Quanto tem em uma unidade (ampola, frasco), para contar pela dose total. */
  porUnidade?: { valor: number; unidade: "g" | "mg" | "mcg" | "UI" };
  /** Bolsa de soro: o volume dela e a solução, para contar pelo registrado. */
  bolsa?: { solucao: string; ml: number };
};

const amp = (nome: string, farmaco: string, valor?: number, unidade?: "g" | "mg" | "mcg" | "UI"): ItemDoConsumo =>
  ({ nome, grupo: "medicamentos", farmaco, ...(valor ? { porUnidade: { valor, unidade: unidade! } } : {}) });

export const CATALOGO_DO_CONSUMO: ItemDoConsumo[] = [
  { nome: "Cânula orotraqueal c/ cuff", grupo: "vias", comNumero: true },
  { nome: "Cânula orotraqueal s/ cuff", grupo: "vias", comNumero: true },
  { nome: "Cânula aramada", grupo: "vias", comNumero: true },
  { nome: "Cânula de Carlens", grupo: "vias", comNumero: true },
  { nome: "Cânula de Guedel", grupo: "vias", comNumero: true },
  { nome: "Cânula nasofaríngea", grupo: "vias", comNumero: true },
  { nome: "Sonda nasogástrica", grupo: "vias", comNumero: true },
  { nome: "Sonda de aspiração", grupo: "vias" },
  { nome: "Sonda de Fouchet", grupo: "vias" },
  { nome: "Cateter tipo óculos O₂", grupo: "vias" },

  { nome: "Agulha 13 × 4,5", grupo: "agulhas" },
  { nome: "Agulha 25 × 7", grupo: "agulhas" },
  { nome: "Agulha 40 × 12", grupo: "agulhas" },
  { nome: "Agulha de raqui", grupo: "agulhas", comNumero: true },
  { nome: "Agulha peridural", grupo: "agulhas", comNumero: true },
  { nome: "Cateter peridural", grupo: "agulhas" },
  { nome: "Agulha Stimuplex", grupo: "agulhas" },
  { nome: "Seringa peridural", grupo: "agulhas" },
  { nome: "Seringa de insulina", grupo: "agulhas" },
  { nome: "Seringa 3 mL", grupo: "agulhas" },
  { nome: "Seringa 5 mL", grupo: "agulhas" },
  { nome: "Seringa 10 mL", grupo: "agulhas" },
  { nome: "Seringa 20 mL", grupo: "agulhas" },
  { nome: "Seringa 50 mL", grupo: "agulhas" },

  { nome: "Soro fisiológico 0,9% 1000 mL", grupo: "soros", bolsa: { solucao: "Soro fisiológico 0,9%", ml: 1000 } },
  { nome: "Soro fisiológico 0,9% 500 mL", grupo: "soros", bolsa: { solucao: "Soro fisiológico 0,9%", ml: 500 } },
  { nome: "Soro fisiológico 0,9% 250 mL", grupo: "soros", bolsa: { solucao: "Soro fisiológico 0,9%", ml: 250 } },
  { nome: "Soro fisiológico 0,9% 100 mL", grupo: "soros", bolsa: { solucao: "Soro fisiológico 0,9%", ml: 100 } },
  { nome: "Soro glicosado 5% 1000 mL", grupo: "soros", bolsa: { solucao: "Soro glicosado 5%", ml: 1000 } },
  { nome: "Soro glicosado 5% 500 mL", grupo: "soros", bolsa: { solucao: "Soro glicosado 5%", ml: 500 } },
  { nome: "Soro glicosado 5% 250 mL", grupo: "soros", bolsa: { solucao: "Soro glicosado 5%", ml: 250 } },
  { nome: "Soro glicofisiológico", grupo: "soros" },
  { nome: "Ringer simples 500 mL", grupo: "soros", bolsa: { solucao: "Ringer simples", ml: 500 } },
  { nome: "Ringer lactato 500 mL", grupo: "soros", bolsa: { solucao: "Ringer lactato", ml: 500 } },
  { nome: "Manitol 20% 250 mL", grupo: "soros", bolsa: { solucao: "Manitol 20%", ml: 250 } },
  { nome: "Voluven 500 mL", grupo: "soros", bolsa: { solucao: "Voluven", ml: 500 } },

  amp("Adrenalina 1 mg/mL", "Adrenalina", 1000, "mcg"),
  amp("Água destilada, amp. 10 mL", "Água destilada"),
  amp("Antak 50 mg, amp. 2 mL", "Ranitidina", 50, "mg"),
  amp("Aramin 10 mg, amp. 1 mL", "Metaraminol", 10, "mg"),
  amp("Atropina 0,25 mg, amp. 1 mL", "Atropina", 0.25, "mg"),
  amp("Bicarbonato de sódio 8,4% 10 mL", "Bicarbonato de sódio"),
  amp("Bicarbonato de sódio 8,4% 250 mL", "Bicarbonato de sódio"),
  amp("Brevibloc 100 mg, 10 mL", "Esmolol", 100, "mg"),
  amp("Cefoxitina", "Cefoxitina"),
  amp("Ceftriaxona 1 g", "Ceftriaxona", 1, "g"),
  amp("Ciprofloxacino 200 mg, fr. 100 mL", "Ciprofloxacino", 200, "mg"),
  amp("Clonidin 150 mcg/mL, amp. 1 mL", "Clonidina", 150, "mcg"),
  amp("Cloreto de potássio 19,1%, 10 mL", "Cloreto de potássio"),
  amp("Dalacin 600 mg, amp. 4 mL", "Clindamicina", 600, "mg"),
  amp("Decadron 10 mg, amp. 2,5 mL", "Dexametasona", 10, "mg"),
  amp("Diazepam 10 mg, amp. 2 mL", "Diazepam", 10, "mg"),
  amp("Dimorf 2 mg, amp. 2 mL", "Morfina", 2, "mg"),
  amp("Dipirona 1 g, amp. 2 mL", "Dipirona", 1, "g"),
  amp("Dormonid 15 mg, amp. 3 mL", "Midazolam", 15, "mg"),
  amp("Dobutamina 250 mg, amp. 20 mL", "Dobutamina", 250, "mg"),
  amp("Dramin B6 50 mg/mL, amp. 1 mL", "Dimenidrinato", 50, "mg"),
  amp("Droperidol, amp. 1 mL", "Droperidol"),
  amp("Epitezan pomada oftálmica", "Epitezan"),
  amp("Etomidato 2 mg/mL, amp. 10 mL", "Etomidato", 20, "mg"),
  amp("Fentanil 0,1 mg/mL, amp. 2 mL", "Fentanil", 200, "mcg"),
  amp("Fentanil 0,5 mg, fr. 10 mL", "Fentanil", 500, "mcg"),
  amp("Flagyl 500 mg, fr. 100 mL", "Metronidazol", 500, "mg"),
  amp("Gluconato de cálcio 10%, amp. 10 mL", "Gluconato de cálcio"),
  amp("Halotano (mL)", "Halotano"),
  amp("Heparina 5.000 UI/mL, fr. 5 mL", "Heparina", 25000, "UI"),
  amp("Hialuronidase 2.000 UTR, amp.", "Hialuronidase"),
  amp("Isoflurano (Forane)", "Isoflurano"),
  amp("Kefazol 1 g", "Cefazolina", 1, "g"),
  amp("Keflin 1 g", "Cefalotina", 1, "g"),
  amp("Ketamina 500 mg, fr. 10 mL", "Cetamina", 500, "mg"),
  amp("Lasix 20 mg, amp. 2 mL", "Furosemida", 20, "mg"),
  amp("Liquemine 5.000 UI, amp. 0,25 mL", "Heparina", 5000, "UI"),
  amp("Mytedon 10 mg/mL, amp. 1 mL", "Metadona", 10, "mg"),
  amp("Neocaína 0,5% s/ vaso", "Bupivacaína"),
  amp("Neocaína 0,5% c/ vaso", "Bupivacaína"),
  amp("Neocaína 0,75% s/ vaso", "Bupivacaína"),
  amp("Neocaína pesada", "Bupivacaína", 20, "mg"),
  amp("Neocaína isobárica", "Bupivacaína"),
  amp("Novabupi 0,75% s/ vaso", "Levobupivacaína"),
  amp("Novabupi 0,5% s/ vaso", "Levobupivacaína"),
  amp("Novabupi 0,5% c/ vaso", "Levobupivacaína"),
  amp("Nilperidol, amp. 2 mL", "Nilperidol"),
  amp("Nipride 50 mg, amp. 2 mL", "Nitroprussiato", 50, "mg"),
  amp("Noradrenalina 8 mg/4 mL", "Noradrenalina", 8000, "mcg"),
  amp("Nubain 10 mg/mL, amp. 1 mL", "Nalbufina", 10, "mg"),
  amp("Pancuron 4 mg, amp. 2 mL", "Pancurônio", 4, "mg"),
  amp("Plamet 10 mg, amp. 2 mL", "Bromoprida", 10, "mg"),
  amp("Plasil 10 mg, amp. 2 mL", "Metoclopramida", 10, "mg"),
  amp("Precedex 100 mcg/mL", "Dexmedetomidina"),
  amp("Propofol 200 mg, fr. 20 mL", "Propofol", 200, "mg"),
  amp("Protamina 1.000 UI/mL", "Protamina"),
  amp("Prostigmine 0,5 mg, amp. 1 mL", "Neostigmina", 0.5, "mg"),
  amp("Quelicin 100 mg, fr.", "Succinilcolina", 100, "mg"),
  amp("Sevorane (mL)", "Sevoflurano"),
  amp("Seloken 5 mg, amp. 5 mL", "Metoprolol", 5, "mg"),
  amp("Solu-Medrol 125 mg", "Metilprednisolona", 125, "mg"),
  amp("Solu-Medrol 500 mg", "Metilprednisolona", 500, "mg"),
  amp("Sulfato de efedrina 50 mg", "Efedrina", 50, "mg"),
  amp("Sulfato de magnésio 10%", "Sulfato de magnésio"),
  amp("Syntocinon 5 UI, amp. 1 mL", "Ocitocina", 5, "UI"),
  amp("Toradol 30 mg, amp. 1 mL", "Cetorolaco", 30, "mg"),
  amp("Tilatil 20 mg, fr.", "Tenoxicam", 20, "mg"),
  amp("Tracrium 10 mg/mL, amp. 2,5 mL", "Atracúrio", 25, "mg"),
  amp("Tramal 100 mg, amp. 2 mL", "Tramadol", 100, "mg"),
  amp("Tramal 50 mg, amp. 1 mL", "Tramadol", 50, "mg"),
  amp("Transamin 250 mg, amp. 5 mL", "Ácido tranexâmico", 250, "mg"),
  amp("Ultiva 2 mg, fr.", "Remifentanil", 2000, "mcg"),
  amp("Xylocaína 2% c/ vaso, 20 mL", "Lidocaína", 400, "mg"),
  amp("Xylocaína 2% s/ vaso, 20 mL", "Lidocaína", 400, "mg"),
  amp("Xylocaína 2% s/ vaso, 5 mL", "Lidocaína", 100, "mg"),
  amp("Zofran 4 mg, amp. 2 mL", "Ondansetrona", 4, "mg"),
  amp("Zofran 8 mg, amp. 4 mL", "Ondansetrona", 8, "mg"),
  amp("Zinacef 750 mg, fr.", "Cefuroxima", 750, "mg"),
  amp("Rocurônio 50 mg, fr. 5 mL", "Rocurônio", 50, "mg"),
  amp("Cisatracúrio 10 mg, amp. 5 mL", "Cisatracúrio", 10, "mg"),
  amp("Sugamadex 200 mg, fr. 2 mL", "Sugamadex", 200, "mg"),
];

export type LinhaDeConsumo = { nome: string; qtd: number; numero?: string; grupo?: GrupoDoConsumo };
export type Consumo = { itens: LinhaDeConsumo[]; observacao?: string };

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const itemDoCatalogoDeConsumo = (nome: string) => CATALOGO_DO_CONSUMO.find((i) => i.nome === nome);

/** O consumo gravado no cabeçalho, sem linhas vazias nem quantidade torta. */
export function lerConsumo(dados: Record<string, unknown> | null | undefined): Consumo {
  const c = (dados?.consumo ?? {}) as { itens?: unknown; observacao?: unknown };
  const itens = (Array.isArray(c.itens) ? c.itens : [])
    .map((i) => i as Partial<LinhaDeConsumo>)
    .filter((i) => typeof i.nome === "string" && i.nome.trim() && typeof i.qtd === "number" && i.qtd > 0)
    .map((i) => ({ nome: i.nome!.trim(), qtd: Math.round(i.qtd!), ...(i.numero ? { numero: String(i.numero) } : {}),
      ...(i.grupo ? { grupo: i.grupo } : {}) }));
  return { itens, ...(typeof c.observacao === "string" && c.observacao.trim() ? { observacao: c.observacao } : {}) };
}

/** A busca do "adicionar item": nome, princípio ativo ou nome comercial. */
export function buscarConsumo(termo: string, jaTem: readonly LinhaDeConsumo[]): ItemDoConsumo[] {
  const q = semAcento(termo.trim());
  if (q.length < 2) return [];
  // Cada palavra digitada tem de aparecer: "serin 10" acha "Seringa 10 mL".
  const palavras = q.split(/\s+/);
  return CATALOGO_DO_CONSUMO
    .filter((i) => i.comNumero || !jaTem.some((l) => l.nome === i.nome))
    .filter((i) => { const alvo = semAcento(`${i.nome} ${i.farmaco ?? ""}`); return palavras.every((p) => alvo.includes(p)); })
    .slice(0, 8);
}

/** Junta duas listas: mesma linha (nome e número) soma, a de cima manda na ordem. */
function juntar(base: LinhaDeConsumo[], novos: LinhaDeConsumo[]): LinhaDeConsumo[] {
  const saida = base.map((l) => ({ ...l }));
  for (const n of novos) {
    const igual = saida.find((l) => l.nome === n.nome && (l.numero ?? "") === (n.numero ?? ""));
    // O que já estava escrito vale: "trazer" não diminui nem dobra o que o
    // médico contou à mão — só sobe para o que a ficha mostra.
    if (igual) igual.qtd = Math.max(igual.qtd, n.qtd);
    else saida.push(n);
  }
  return saida;
}

/**
 * O que dá para tirar dos registros: ampolas pela dose total, TOT e agulha de
 * raqui da técnica, bolsas de soro pelo volume. Devolve a lista juntada com a
 * que já existia.
 */
export function trazerDaFicha(atual: Consumo, administrados: Administracao[], vigentes: readonly Registro[],
  cabecalho: Record<string, unknown>): Consumo {
  const novos: LinhaDeConsumo[] = [];

  // Medicamentos: o total de cada um, dividido pelo conteúdo da ampola.
  for (const g of agruparPorMedicamento(administrados)) {
    const candidatos = CATALOGO_DO_CONSUMO.filter((i) => i.farmaco && mesmoFarmaco(i.farmaco, g.nome));
    if (!candidatos.length) continue;
    // A apresentação: a menor que, sozinha, dá conta da maior dose dada de uma vez.
    const contaveis = candidatos.filter((i) => i.porUnidade);
    let escolhido = candidatos[0];
    let qtd = 1;
    if (contaveis.length && g.total !== null) {
      const naUnidade = (i: ItemDoConsumo) => (i.porUnidade!.unidade === g.unidade ? i.porUnidade!.valor
        : converterMassa(i.porUnidade!.valor, i.porUnidade!.unidade, g.unidade));
      const comConta = contaveis.map((i) => ({ i, cabe: naUnidade(i) })).filter((o) => o.cabe !== null && o.cabe > 0)
        .sort((a, b) => a.cabe! - b.cabe!);
      if (comConta.length) {
        const maiorDose = Math.max(...g.vezes.map((v) => v.dose));
        const o = comConta.find((x) => x.cabe! >= maiorDose) ?? comConta[comConta.length - 1];
        escolhido = o.i;
        qtd = Math.max(1, Math.ceil(g.total / o.cabe! - 1e-9));
      }
    }
    novos.push({ nome: escolhido.nome, qtd, grupo: "medicamentos" });
  }

  // Soros: o volume registrado de cada solução, em bolsas do tamanho mais usado (500 mL).
  const volumes = new Map<string, number>();
  for (const r of vigentes) {
    if (r.tipo !== "liquido" || r.dados.sentido === "saida") continue;
    const nome = String(r.dados.nome ?? "");
    const ml = Number(r.dados.volume_ml ?? r.dados.volume ?? 0);
    if (ml > 0) volumes.set(nome, (volumes.get(nome) ?? 0) + ml);
  }
  for (const [nome, ml] of volumes) {
    const bolsas = CATALOGO_DO_CONSUMO.filter((i) => i.bolsa && semAcento(nome).startsWith(semAcento(i.bolsa.solucao)));
    const bolsa = bolsas.find((i) => i.bolsa!.ml === 500) ?? bolsas[0];
    if (bolsa) novos.push({ nome: bolsa.nome, qtd: Math.max(1, Math.ceil(ml / bolsa.bolsa!.ml - 1e-9)), grupo: "soros" });
  }

  // Técnica: o tubo e a agulha de raqui escritos no rodapé.
  const det = (cabecalho.tecnica_detalhes ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const tubo = String(det.geral?.numero ?? "").trim();
  if (tubo && String(det.geral?.dispositivo ?? "TOT") === "TOT") {
    const calibre = tubo.match(/\d+(?:[.,]\d)?/)?.[0]?.replace(".", ",");
    const semCuff = /sem/i.test(tubo);
    if (calibre) novos.push({ nome: semCuff ? "Cânula orotraqueal s/ cuff" : "Cânula orotraqueal c/ cuff", numero: calibre, qtd: 1, grupo: "vias" });
  }
  const agulha = String(det.raqui?.agulha ?? "").trim();
  if (agulha) novos.push({ nome: "Agulha de raqui", numero: agulha, qtd: 1, grupo: "agulhas" });

  return { ...atual, itens: juntar(atual.itens, novos) };
}

/** As linhas na ordem da folha: grupo do catálogo, depois a ordem em que entraram. */
export function linhasPorGrupo(c: Consumo): Array<{ grupo: GrupoDoConsumo; linhas: LinhaDeConsumo[] }> {
  const grupoDe = (l: LinhaDeConsumo): GrupoDoConsumo => itemDoCatalogoDeConsumo(l.nome)?.grupo ?? l.grupo ?? "outros";
  return (Object.keys(TITULO_DO_CONSUMO) as GrupoDoConsumo[])
    .map((grupo) => ({ grupo, linhas: c.itens.filter((l) => grupoDe(l) === grupo) }))
    .filter((g) => g.linhas.length);
}
