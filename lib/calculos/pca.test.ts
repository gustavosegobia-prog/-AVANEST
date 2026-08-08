import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  acharFarmaco,
  alertas,
  conferir,
  DOSES_SISTEMICAS,
  citar,
  escreverFaixa,
  FARMACOS,
  IDADE_LEMBRETE,
  NAO_INFERIR,
  porPeso,
  prepararSolucao,
  tetoPorHora,
  virgula,
  volumeDaDose,
} from "./pca.ts";

/* Fidelidade à fonte. Estes testes existem para que um número só mude quando
   alguém abrir o livro de novo — não quando alguém achar que "fica melhor". */

test("as faixas do Miller são as da tabela de adulto de 70 kg", () => {
  const morfina = acharFarmaco("morfina")!;
  assert.deepEqual(morfina.diretriz!.demanda, { min: 0.5, max: 2.5 });
  assert.deepEqual(morfina.diretriz!.lockoutMin, { min: 6, max: 10 });
  assert.deepEqual(morfina.diretriz!.basal, { min: 1, max: 2 });

  const fentanil = acharFarmaco("fentanil")!;
  assert.deepEqual(fentanil.diretriz!.demanda, { min: 20, max: 50 });
  assert.deepEqual(fentanil.diretriz!.lockoutMin, { min: 5, max: 10 });

  const hidro = acharFarmaco("hidromorfona")!;
  assert.deepEqual(hidro.diretriz!.demanda, { min: 0.05, max: 0.25 });
  assert.deepEqual(hidro.diretriz!.lockoutMin, { min: 10, max: 20 });

  const sufenta = acharFarmaco("sufentanil")!;
  assert.deepEqual(sufenta.diretriz!.demanda, { min: 2, max: 5 });
  assert.deepEqual(sufenta.diretriz!.lockoutMin, { min: 4, max: 10 });
});

test("todo fármaco carrega obra e página", () => {
  for (const f of FARMACOS) {
    assert.ok(f.diretriz?.fonte.obra, `${f.id} sem obra`);
    assert.match(f.diretriz!.fonte.local, /p\. \d+/, `${f.id} sem página`);
  }
  for (const d of DOSES_SISTEMICAS) assert.match(d.fonte.local, /p\. \d+/);
});

test("números aparecem com vírgula, como se escreve em português", () => {
  assert.equal(virgula(0.5), "0,5");
  assert.equal(escreverFaixa({ min: 0.5, max: 2.5 }, "mg"), "0,5–2,5 mg");
  assert.equal(escreverFaixa({ min: 10, max: 10 }, "min"), "10 min");
});

test("dose sistêmica por peso é multiplicação, e sai com via junto", () => {
  const bolo = DOSES_SISTEMICAS.find((d) => d.dose.startsWith("0,15"))!;
  assert.equal(porPeso(bolo, 70), "10,5 mg");
  assert.equal(bolo.via, "EV, bolo");

  const infusao = DOSES_SISTEMICAS.find((d) => d.dose === "0,03–0,1 mg/kg/h")!;
  assert.equal(porPeso(infusao, 70), "2,1–7 mg/h");
});

test("peso ausente ou absurdo não produz dose", () => {
  const bolo = DOSES_SISTEMICAS[0];
  assert.equal(porPeso(bolo, 0), undefined);
  assert.equal(porPeso(bolo, Number.NaN), undefined);
});

test("conferência diz onde o valor caiu, sem sugerir outro", () => {
  const r = conferir("morfina", { demanda: 1, lockoutMin: 8 });
  assert.equal(r[0].situacao, "dentro");
  assert.equal(r[1].situacao, "dentro");

  const alto = conferir("morfina", { demanda: 5 });
  assert.equal(alto[0].situacao, "acima");
  assert.match(alto[0].texto, /Acima da faixa publicada/);
  assert.doesNotMatch(alto[0].texto, /ajuste|reduza|aumente|use /i);
});

test("campo sem faixa publicada é dito como ausente, não preenchido", () => {
  const r = conferir("morfina", { doseCarga: 3, limiteValor: 20 });
  assert.equal(r[0].situacao, "sem-faixa");
  assert.match(r[0].texto, /protocolo institucional/);
  assert.equal(r[0].faixa, undefined);
  assert.equal(r[1].situacao, "sem-faixa");
});

test("campo vazio não vira zero nem entra na conferência", () => {
  assert.equal(conferir("morfina", {}).length, 0);
  assert.equal(conferir("morfina", { demanda: undefined, basal: undefined }).length, 0);
});

test("teto por hora é a conta do pior caso, e se anuncia como tal", () => {
  const t = tetoPorHora("morfina", { demanda: 1, lockoutMin: 6, basal: 1 })!;
  assert.equal(t.dosesPorHora, 10);
  assert.equal(t.porDemanda, 10);
  assert.equal(t.total, 11);
  assert.equal(t.unidade, "mg/h");
  assert.match(t.aviso, /Teto aritmético/);
  assert.match(t.aviso, /não é dose esperada nem limite de segurança/i);
});

test("bloqueio que não divide a hora arredonda para baixo", () => {
  const t = tetoPorHora("fentanil", { demanda: 25, lockoutMin: 7 })!;
  assert.equal(t.dosesPorHora, 8);
  assert.equal(t.total, 200);
});

test("sem demanda ou sem bloqueio não há teto", () => {
  assert.equal(tetoPorHora("morfina", { demanda: 1 }), undefined);
  assert.equal(tetoPorHora("morfina", { lockoutMin: 6 }), undefined);
  assert.equal(tetoPorHora("morfina", { demanda: 1, lockoutMin: 0 }), undefined);
});

test("preparo da solução é massa dividida por volume", () => {
  const p = prepararSolucao("morfina", 50, 50)!;
  assert.equal(p.concentracao, 1);
  assert.equal(p.texto, "50 mg em 50 mL = 1 mg/mL");
  assert.equal(prepararSolucao("morfina", 50, 0), undefined);
});

test("volume do bolo sai da concentração montada", () => {
  assert.equal(volumeDaDose(1, 1), 1);
  assert.equal(volumeDaDose(25, 10), 2.5);
  assert.equal(volumeDaDose(1, 0), undefined);
});

test("basal em paciente virgem de opioide é alerta crítico, com fonte", () => {
  const a = alertas("morfina", { toleranteOpioide: false }, { basal: 1 });
  const critico = a.find((x) => x.titulo.includes("virgem de opioide"))!;
  assert.equal(critico.gravidade, "critico");
  assert.equal(critico.fonte!.local, "PDF p. 1167");
});

test("basal em obeso ou apneia do sono não recebe taxa alternativa", () => {
  const a = alertas("morfina", { obesidade: true, toleranteOpioide: true }, { basal: 1 });
  const alerta = a.find((x) => x.titulo.includes("obesidade"))!;
  assert.match(alerta.texto, /não há taxa alternativa universal/i);
  assert.doesNotMatch(alerta.texto, /\d+ ?mg\/h/);
});

test("sem basal, os alertas de basal não aparecem", () => {
  const a = alertas("morfina", { toleranteOpioide: false, obesidade: true }, {});
  assert.equal(a.filter((x) => x.titulo.toLowerCase().includes("basal em")).length, 0);
});

test("morfina em obeso cobra o tipo de peso usado", () => {
  const semPeso = alertas("morfina", { obesidade: true }, {});
  assert.ok(semPeso.some((x) => x.titulo.includes("Tipo de peso")));
  const comPeso = alertas("morfina", { obesidade: true, tipoPeso: "ideal" }, {});
  assert.ok(!comPeso.some((x) => x.titulo.includes("Tipo de peso")));
});

test("limite por janela ausente vira lembrete de protocolo, não número", () => {
  const a = alertas("morfina", {}, { demanda: 1 });
  const lembrete = a.find((x) => x.titulo.includes("Limite por hora"))!;
  assert.equal(lembrete.gravidade, "lembrete");
  assert.match(lembrete.texto, /não pode ser derivado do bloqueio/);
});

test("nenhum alerta prescreve dose", () => {
  const perfis = [
    { toleranteOpioide: false, obesidade: true, apneiaSono: true, idade: 80, funcaoRenalAlterada: true },
    { cognicaoAdequada: false, acionamentoPorTerceiros: true, sedativosConcomitantes: true, dpoc: true },
  ];
  for (const perfil of perfis) {
    for (const a of alertas("morfina", perfil, { demanda: 1, lockoutMin: 8, basal: 1 })) {
      assert.doesNotMatch(a.texto, /programe|configure|use \d|inicie com \d/i, a.titulo);
    }
  }
});

test("a lista do que não se infere continua completa", () => {
  assert.equal(NAO_INFERIR.length, 7);
  assert.ok(NAO_INFERIR.some((x) => x.campo.includes("pediátrica")));
  assert.ok(NAO_INFERIR.some((x) => x.conduta.includes("bloqueada")));
});

test("o corte de idade é declarado como escolha do AVANEST, não da fonte", () => {
  const a = alertas("morfina", { idade: IDADE_LEMBRETE }, {});
  const idoso = a.find((x) => x.titulo === "Idoso")!;
  assert.match(idoso.texto, /é do AVANEST/);
  assert.equal(alertas("morfina", { idade: IDADE_LEMBRETE - 1 }, {}).some((x) => x.titulo === "Idoso"), false);
});

test("todo texto de fonte tem obra e página juntas", () => {
  for (const a of alertas("morfina", { obesidade: true, funcaoRenalAlterada: true, idade: 80 }, { basal: 1 })) {
    if (a.fonte) assert.match(citar(a.fonte), /^(SAESP|Miller).+p{1,2}\. \d/);
  }
});
