import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { Registro } from "./registros.ts";
import { administrados } from "./medicamentos.ts";
import {
  COLUNA_MIN, categoriaDe, colunasDeValores, dataDoDia, descreverPosicao, descreverSaida, descreverTecnica,
  idadeParaImpressao, janelasDaImpressao, pistasDeEventos, linhasDeGas, linhasDeLiquido, marcasDeEvento, medicacaoPorGrupo,
  textoDaColuna,
} from "./impressao.ts";
import { cabecalhoInicial } from "./importar.ts";

const T0 = Date.parse("2026-10-10T10:00:00-03:00");
const em = (min: number) => new Date(T0 + min * 60000).toISOString();
let seq = 0;
function reg(tipo: Registro["tipo"], min: number, dados: Record<string, unknown>): Registro {
  seq += 1;
  return {
    id: `p${seq}`, evolucao_id: "f1", tipo, momento: em(min), dados, origem: "manual",
    substitui_id: null, anulado: false, motivo: null, created_by: "u1", created_at: em(min),
  };
}

// ---------------------------------------------------------------------------
// Folhas e colunas
// ---------------------------------------------------------------------------
test("Impressão — procedimento de duas horas cabe numa folha, começando na coluna cheia", () => {
  const j = janelasDaImpressao(T0 + 7 * 60000, T0 + 127 * 60000);
  assert.equal(j.length, 1);
  assert.equal(j[0].inicio, T0);
  assert.equal(j[0].fim - j[0].inicio, 180 * 60000);
});

test("Impressão — três horas e dez minutos continuam numa segunda folha", () => {
  const j = janelasDaImpressao(T0, T0 + 190 * 60000);
  assert.equal(j.length, 2);
  assert.equal(j[1].inicio, j[0].fim);
});

test("Impressão — folha sem nenhum registro ainda imprime uma folha", () => {
  assert.equal(janelasDaImpressao(T0, T0).length, 1);
});

test("Impressão — a coluna mostra todos os valores que cabem; senão, o menor e o maior", () => {
  assert.equal(textoDaColuna([]), "");
  assert.equal(textoDaColuna([98]), "98");
  assert.equal(textoDaColuna([99, 98, 99]), "99 98 99");
  assert.equal(textoDaColuna([99, 91, 100, 97]), "91–100");
  assert.equal(textoDaColuna([100, 100, 100]), "100");
  assert.equal(textoDaColuna([36.5], 1), "36,5");
});

test("Impressão — eventos próximos vão para a outra pista em vez de se sobrepor", () => {
  assert.deepEqual(pistasDeEventos([10, 11, 12.5, 20, 30], 3), [0, 1, 0, 0, 0]);
  assert.deepEqual(pistasDeEventos([10, 10.5, 11], 3), [0, 1, 0]);
});

test("Impressão — cada valor cai na coluna de 15 minutos do seu horário", () => {
  const v = [reg("sinal", 2, { parametro: "spo2", valor: 99 }), reg("sinal", 16, { parametro: "spo2", valor: 97 }),
    reg("sinal", 29, { parametro: "spo2", valor: 95 }), reg("sinal", 16, { parametro: "fc", valor: 80 })];
  const c = colunasDeValores(v, "spo2", janelasDaImpressao(T0, T0 + 60 * 60000)[0]);
  assert.equal(COLUNA_MIN, 15);
  assert.deepEqual(c.slice(0, 3), [[99], [97, 95], []]);
});

// ---------------------------------------------------------------------------
// Eventos, gases, líquidos
// ---------------------------------------------------------------------------
test("Impressão — X para a anestesia, O para a operação, números para o resto", () => {
  const v = [
    reg("evento", 0, { codigo: "inicio_anestesia" }), reg("evento", 5, { codigo: "intubacao" }),
    reg("evento", 15, { codigo: "inicio_cirurgia" }), reg("evento", 40, { codigo: "personalizado", descricao: "Sondagem vesical" }),
    reg("evento", 90, { codigo: "fim_cirurgia" }), reg("evento", 100, { codigo: "fim_anestesia" }),
  ];
  assert.deepEqual(marcasDeEvento(v).map((m) => m.simbolo), ["X", "1", "O", "2", "O", "X"]);
  assert.equal(marcasDeEvento(v)[3].rotulo, "Sondagem vesical");
});

test("Impressão — o gás só aparece quando muda; ar e N₂O só se usados", () => {
  const v = [
    reg("gas", 0, { o2: 2, ar: 0, sevo_pct: 2 }),
    reg("gas", 10, { o2: 2, ar: 0, sevo_pct: 2 }),
    reg("gas", 20, { o2: 1, ar: 0, sevo_pct: 2.5 }),
  ];
  const l = linhasDeGas(v);
  assert.deepEqual(l.map((x) => x.chave), ["o2", "sevo"]);
  assert.deepEqual(l[0].passos.map((p) => p.valor), [2, 1]);
  assert.deepEqual(l[1].passos.map((p) => p.valor), [2, 2.5]);
  // Sevoflurano desligado no começo não se escreve; desligado depois, sim.
  const s = linhasDeGas([reg("gas", 0, { o2: 3, sevo_pct: 0 }), reg("gas", 5, { o2: 1, sevo_pct: 2 }), reg("gas", 90, { o2: 4, sevo_pct: 0 })]);
  assert.deepEqual(s[1].passos.map((p) => p.valor), [2, 0]);
});

test("Impressão — líquidos por solução, com total; a diurese tem linha mesmo sem registro", () => {
  const v = [
    reg("liquido", 5, { sentido: "entrada", categoria: "cristaloide", nome: "Ringer lactato", volume_ml: 500 }),
    reg("liquido", 50, { sentido: "entrada", categoria: "cristaloide", nome: "Ringer lactato", volume_ml: 500 }),
    reg("liquido", 60, { sentido: "saida", categoria: "sangramento", volume_ml: 150 }),
  ];
  const l = linhasDeLiquido(v);
  assert.deepEqual(l.map((x) => [x.rotulo, x.total]), [["Ringer lactato", 1000], ["Sangramento", 150], ["Diurese", 0]]);
});

// ---------------------------------------------------------------------------
// Medicação: só o administrado, por grupo
// ---------------------------------------------------------------------------
test("Teste G — a impressão leva só o administrado, agrupado e na ordem dos grupos", () => {
  const v = [
    reg("medicamento", 0, { nome: "Kefazol", status: "administrado", dose: 2, unidade: "g", via: "EV" }),
    reg("medicamento", 5, { nome: "Fentanil", status: "administrado", dose: 150, unidade: "mcg", via: "EV" }),
    reg("medicamento", 6, { nome: "Propofol", status: "planejado", dose: 150, unidade: "mg", via: "EV" }),
    reg("medicamento", 7, { nome: "Rocurônio", status: "cancelado", dose: 50, unidade: "mg", via: "EV" }),
    reg("medicamento", 60, { nome: "Fentanil", status: "administrado", dose: 50, unidade: "mcg", via: "EV" }),
    reg("medicamento", 70, { nome: "Soro antiofídico", status: "administrado", dose: 1, unidade: "mL", via: "EV" }),
  ];
  const g = medicacaoPorGrupo(administrados(v));
  assert.deepEqual(g.map((x) => x.categoria), ["antibiotico", "opioide", "outros"]);
  const fentanil = g[1].medicamentos[0];
  assert.equal(fentanil.vezes.length, 2);
  assert.equal(fentanil.total, 200);
  const nomes = g.flatMap((x) => x.medicamentos.map((m) => m.nome));
  assert.ok(!nomes.includes("Propofol") && !nomes.includes("Rocurônio"));
  assert.equal(categoriaDe("neocaína"), "anestesico_local");
});

// ---------------------------------------------------------------------------
// Texto corrido: técnica, posição, saída, idade
// ---------------------------------------------------------------------------
test("Impressão — a técnica sai só com o que foi preenchido", () => {
  assert.deepEqual(descreverTecnica({}), []);
  const linhas = descreverTecnica({
    tecnicas: ["geral_balanceada", "raquianestesia"],
    tecnica_detalhes: {
      geral: { dispositivo: "TOT", numero: "7,5", modo: "VCV", vc: "450", peep: "5" },
      raqui: { espaco: "L3-L4", agulha: "27G", abordagem: "Mediana", puncao_unica: true },
    },
  });
  assert.equal(linhas[0], "Anestesia geral balanceada; TOT 7,5; ventilação VCV, VC 450 mL, PEEP 5");
  assert.equal(linhas[1], "Raquianestesia, L3-L4, agulha 27G, mediana, punção única");
  assert.equal(descreverPosicao({ posicoes: ["DDH"], protecoes: ["Proteção ocular"] }), "Posição: DDH · Proteções: proteção ocular");
  assert.equal(descreverPosicao({}), "");
});

test("Impressão — a saída da sala em uma linha", () => {
  assert.equal(
    descreverSaida({ saida: { destino: "RPA", consciencia: "Consciente", estavel: true, pa: "120/80", fc: "72", spo2: "98", oxigenio: "Sem O₂" } }),
    "Alta da sala para RPA, consciente, estável, PA 120/80, FC 72, SpO₂ 98%, sem O₂",
  );
  assert.equal(descreverSaida({}), "");
});

test("Impressão — idade em dias, meses ou anos, como a pediatria lê", () => {
  const dia = new Date("2026-10-10T12:00:00-03:00");
  assert.equal(idadeParaImpressao("2026-09-28", dia), "12 dias");
  assert.equal(idadeParaImpressao("2026-02-01", dia), "8 meses");
  assert.equal(idadeParaImpressao("2024-11-20", dia), "22 meses");
  assert.equal(idadeParaImpressao("2021-07-01", dia), "5 anos e 3 meses");
  assert.equal(idadeParaImpressao("1986-10-11", dia), "39 anos");
  assert.equal(idadeParaImpressao(null, dia, 40), "40 anos");
  assert.equal(idadeParaImpressao(null, dia), "");
  assert.equal(dataDoDia("2026-10-10"), "10/10/2026");
});

test("Impressão — o papel não tem valor financeiro nem finge assinatura digital", () => {
  for (const arquivo of ["components/evolucao/folha-impressa.tsx", "components/evolucao/registro-impresso.tsx"]) {
    const codigo = fs.readFileSync(new URL(`../../${arquivo}`, import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/R\$|pre[cç]o|custo/i.test(codigo), `${arquivo} fala de dinheiro`);
    assert.ok(!/assinado digitalmente|assinatura digital/i.test(codigo), `${arquivo} finge assinatura digital`);
  }
});

// ---------------------------------------------------------------------------
// A folha nasce da avaliação
// ---------------------------------------------------------------------------
const PACIENTE = {
  nome: "Paciente Teste", data_nascimento: "2019-03-01", idade_anos: 7, sexo: "F",
  convenio: "Particular", hospital: "Hospital Teste", cirurgia: null, procedimento: "Adenoamigdalectomia",
};

test("Importar — o que a avaliação respondeu vem para a folha, convertido", () => {
  const agora = new Date("2026-10-10T09:00:00-03:00");
  const c = cabecalhoInicial(PACIENTE, {
    id: "av1",
    dados: {
      peso: "22,5", altura: "118", asa: "I", alergias: "Não",
      medicamentos_json: JSON.stringify([{ nome: "Salbutamol", dose: "100 mcg", frequencia: "se necessário" }]),
      mallampati: "II", jejum_solidos: "8 h", hemoglobina: "12,8",
      respiratoria: "Sim", respiratoria_detalhes: "asma leve",
    },
  }, agora);
  assert.equal(c.peso_kg, 22.5);
  assert.equal(c.altura_cm, 118);
  assert.equal(c.nega_alergia, true);
  assert.equal(c.alergias, "");
  assert.equal(c.medicacao_uso, "Salbutamol 100 mcg se necessário");
  assert.equal(c.via_aerea, "Mallampati II");
  assert.equal(c.jejum, "sólidos 8 h");
  assert.equal(c.exames, "Hb 12,8 g/dL");
  assert.equal(c.antecedentes, "Respiratório: asma leve");
  assert.equal(c.procedimento, "Adenoamigdalectomia");
  assert.deepEqual(c.preanestesica_origem, { avaliacao_id: "av1", importado_em: agora.toISOString() });
});

test("Importar — campo vazio continua vazio; peso impossível não entra", () => {
  const c = cabecalhoInicial(PACIENTE, { id: "av2", dados: { peso: "0", altura: "abc", alergias: "Sim" } }, new Date());
  assert.equal(c.peso_kg, null);
  assert.equal(c.altura_cm, null);
  assert.equal(c.nega_alergia, false);
  assert.equal(c.alergias, "Sim (sem detalhe na avaliação)");
  assert.equal(c.asa, "");
  assert.equal(c.medicacao_uso, "");
  const sem = cabecalhoInicial(PACIENTE, null, new Date());
  assert.equal(sem.preanestesica_origem, null);
});
