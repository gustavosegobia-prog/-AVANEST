import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  ALTO_RISCO_K,
  ANTES_DE_CALCULAR,
  CA_MG_P,
  citar,
  conferirInfusaoK,
  conferirVariacao24h,
  deficitAsh,
  deficitPorAlvo,
  deficitPotassio,
  DISCREPANCIA_ACT,
  FATOR_ACT,
  HIPERCALEMIA,
  KCL_191,
  LIMIARES,
  LIMITES_HIPONATREMIA,
  LIMITES_K,
  PROCEDENCIA_CALCIO_CORRIGIDO,
  SEM_DEFICIT_AGUA_LIVRE,
  SOLUCOES,
  TRAVAS,
  variacaoSodio,
} from "./eletrolitos-correcoes.ts";

/* Os exemplos numéricos abaixo são os do próprio guia. Se um resultado mudar,
   ou a fórmula mudou ou alguém mexeu num fator — nos dois casos, é para parar. */

test("ΔNa reproduz o exemplo do guia: jovem 70 kg, Na 112, NaCl 3%", () => {
  const r = variacaoSodio({ naSerico: 112, naSolucao: 513, pesoKg: 70, faixaEtaria: "jovem", volumeMl: 150 })!;
  assert.equal(r.act, 42);
  assert.equal(r.deltaPorLitro, 9.33);
  assert.equal(r.deltaNoVolume, 1.4);
  assert.match(r.aviso, /Previsão inicial/);
});

test("ΔNa negativo na hipernatremia: idoso 70 kg, Na 160, glicose 5%", () => {
  const r = variacaoSodio({ naSerico: 160, naSolucao: 0, pesoKg: 70, faixaEtaria: "idoso" })!;
  assert.equal(r.act, 35);
  assert.equal(r.deltaPorLitro, -4.44);
  assert.equal(r.deltaNoVolume, undefined);
});

test("o fator de água corporal separa jovem de idoso", () => {
  assert.equal(FATOR_ACT.jovem, 0.6);
  assert.equal(FATOR_ACT.idoso, 0.5);
  const jovem = variacaoSodio({ naSerico: 120, naSolucao: 513, pesoKg: 80, faixaEtaria: "jovem" })!;
  const idoso = variacaoSodio({ naSerico: 120, naSolucao: 513, pesoKg: 80, faixaEtaria: "idoso" })!;
  assert.equal(jovem.act, 48);
  assert.equal(idoso.act, 40);
  assert.ok(idoso.deltaPorLitro > jovem.deltaPorLitro, "menos água, mais variação por litro");
});

test("a divergência do +1 fica registrada, e a fórmula usa a da figura", () => {
  assert.match(DISCREPANCIA_ACT, /figura 95\.12/);
  assert.match(DISCREPANCIA_ACT, /texto corrido/);
  const r = variacaoSodio({ naSerico: 112, naSolucao: 513, pesoKg: 70 })!;
  assert.match(r.formula, /\(ACT \+ 1\)/);
});

test("sem peso, sem sódio ou sem solução não há previsão", () => {
  assert.equal(variacaoSodio({ naSerico: 112, naSolucao: 513 }), undefined);
  assert.equal(variacaoSodio({ naSerico: 112, pesoKg: 70 }), undefined);
  assert.equal(variacaoSodio({ naSerico: 112, naSolucao: 513, pesoKg: 0 }), undefined);
});

test("só entram as soluções cujo sódio a fonte declara", () => {
  const comValor = SOLUCOES.filter((s) => Number.isFinite(s.sodio));
  assert.equal(comValor.length, 2);
  assert.equal(comValor.find((s) => s.id === "nacl3")!.sodio, 513);
  assert.equal(comValor.find((s) => s.id === "glicose5")!.sodio, 0);
  for (const s of comValor) assert.ok(s.fonte, `${s.nome} sem fonte`);
  assert.ok(SOLUCOES.some((s) => s.id === "outra"), "falta a opção de digitar o sódio");
});

test("a variação acumulada em 24 h avisa nos dois patamares", () => {
  assert.equal(conferirVariacao24h(6), undefined);
  assert.match(conferirVariacao24h(8.5)!, /faixa de 8 a 10/);
  assert.match(conferirVariacao24h(11)!, /passou o teto/);
  assert.match(conferirVariacao24h(-12)!, /passou o teto/, "queda também conta");
});

test("não existe déficit de água livre calculado", () => {
  assert.match(SEM_DEFICIT_AGUA_LIVRE, /não apresenta, no trecho, uma fórmula separada de déficit de água livre/);
});

test("déficit de potássio reproduz o exemplo: K 2,8 com referência 4,0", () => {
  const r = deficitPotassio(2.8)!;
  assert.equal(r.diferenca, 1.2);
  assert.equal(r.deficitAproximado, 400);
  assert.match(r.aviso, /não ordem de administração/);
});

test("potássio normal ou acima da referência não gera déficit", () => {
  assert.equal(deficitPotassio(4.2), undefined);
  assert.equal(deficitPotassio(4.0), undefined);
});

test("a infusão de potássio é conferida contra o limite do acesso", () => {
  const dentro = conferirInfusaoK({ mEq: 20, volumeMl: 1000, horas: 2, acesso: "periferico" })!;
  assert.equal(dentro.concentracao, 20);
  assert.equal(dentro.velocidade, 10);
  assert.equal(dentro.alertas.length, 0);
  assert.equal(dentro.volumeKclMl, 8);

  const fora = conferirInfusaoK({ mEq: 60, volumeMl: 500, horas: 1, acesso: "periferico" })!;
  assert.equal(fora.concentracao, 120);
  assert.equal(fora.velocidade, 60);
  assert.equal(fora.alertas.length, 2);
  assert.match(fora.alertas[0], /Concentração/);
  assert.match(fora.alertas[1], /Velocidade/);
});

test("o mesmo esquema pode passar no acesso central e falhar no periférico", () => {
  const e = { mEq: 30, volumeMl: 600, horas: 1 } as const;
  assert.equal(conferirInfusaoK({ ...e, acesso: "periferico" })!.alertas.length, 2);
  assert.equal(conferirInfusaoK({ ...e, acesso: "central" })!.alertas.length, 0);
  assert.equal(LIMITES_K.periferico.velocidade, 20);
  assert.equal(LIMITES_K.central.velocidade, 40);
});

test("o KCl 19,1% guarda a equivalência e a proibição da glicose", () => {
  assert.equal(KCL_191.mEqPorMl, 2.5);
  assert.match(KCL_191.nota, /Não diluir em glicose/);
});

test("os 100 mmol/h ficam como alerta, e nunca como opção", () => {
  assert.match(ALTO_RISCO_K, /não é opção do AVANEST/);
  assert.equal(LIMITES_K.central.velocidade < 100, true);
  assert.equal(LIMITES_K.periferico.velocidade < 100, true);
});

test("Ash reproduz o exemplo: 70 kg com BE de −10", () => {
  const r = deficitAsh(70, -10)!;
  assert.equal(r.deficit, 210);
  assert.equal(r.metade, 105);
  assert.match(r.aviso, /corrigir metade/);
});

test("BE positivo ou ausente não gera déficit de bicarbonato", () => {
  assert.equal(deficitAsh(70, 2), undefined);
  assert.equal(deficitAsh(70, 0), undefined);
  assert.equal(deficitAsh(0, -10), undefined);
});

test("a segunda fórmula de bicarbonato usa o espaço de distribuição de 0,6", () => {
  const r = deficitPorAlvo(70, 12, 18)!;
  assert.equal(r.deficit, 252);
  assert.equal(deficitPorAlvo(70, 18, 12), undefined, "alvo abaixo do atual não repõe");
});

test("os cinco distúrbios de Ca, Mg e P vêm com fonte e sem dose automática", () => {
  assert.equal(CA_MG_P.length, 5);
  for (const d of CA_MG_P) {
    assert.ok(d.fonte.obra, `${d.disturbio} sem obra`);
    assert.ok(d.conduta.length > 20, `${d.disturbio} sem conduta`);
  }
  assert.match(CA_MG_P.find((d) => d.disturbio.includes("Hipomagnesemia"))!.conduta, /nulas até haver fonte validada/);
  assert.match(CA_MG_P.find((d) => d.disturbio.includes("fosfatemia"))!.conduta, /Não inventar dose/);
});

test("a procedência do cálcio corrigido é declarada, e não atribuída ao SAESP", () => {
  assert.match(PROCEDENCIA_CALCIO_CORRIGIDO, /não localizada de modo explícito no SAESP nem no Miller/);
  assert.match(PROCEDENCIA_CALCIO_CORRIGIDO, /prefira interpretá-lo/);
});

test("as etapas da hipercalemia estão completas e com observação", () => {
  assert.equal(HIPERCALEMIA.length, 5);
  assert.ok(HIPERCALEMIA.some((e) => /Gluconato de cálcio 10%/.test(e.conduta)));
  assert.ok(HIPERCALEMIA.some((e) => /10 UI de insulina regular/.test(e.conduta)));
  assert.match(HIPERCALEMIA.find((e) => /cálcio/.test(e.conduta))!.observacao, /não reduz o potássio/);
  for (const e of HIPERCALEMIA) assert.ok(e.observacao.length > 20, `${e.etapa} sem observação`);
});

test("limiares e travas continuam declarados", () => {
  assert.equal(LIMIARES.hiponatremia.valor, 135);
  assert.equal(LIMIARES.hipocalemiaTratar.valor, 3.0);
  assert.equal(LIMIARES.hipomagnesemia.valor, 1.9);
  for (const l of Object.values(LIMIARES)) assert.match(citar(l.fonte), /SAESP|Miller/);

  assert.equal(ANTES_DE_CALCULAR.length, 4);
  assert.equal(TRAVAS.length, 6);
  assert.ok(TRAVAS.some((t) => /nunca vira dose total automática/i.test(t)));
  assert.equal(LIMITES_HIPONATREMIA.length, 3);
});
