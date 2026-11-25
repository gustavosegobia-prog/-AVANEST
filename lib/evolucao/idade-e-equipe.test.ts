import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { anosCompletos, ehCesarea, idadeParaGravar } from "./idade-e-equipe.ts";

const ler = (caminho: string) => fs.readFileSync(new URL(`../../${caminho}`, import.meta.url), "utf8");

test("anos completos contam o aniversário só no dia", () => {
  assert.equal(anosCompletos("1990-11-25", "2026-11-25"), 36);
  assert.equal(anosCompletos("1990-11-26", "2026-11-25"), 35);
  assert.equal(anosCompletos("2026-02-10", "2026-11-25"), 0);
});

test("com a data de nascimento, a idade sai dela", () => {
  assert.deepEqual(idadeParaGravar("1990-11-26", "50", "2026-11-25"),
    { ok: true, valor: { data_nascimento: "1990-11-26", idade_anos: 35 } });
});

test("só a idade: a data antiga sai do cadastro", () => {
  assert.deepEqual(idadeParaGravar("", "42", "2026-11-25"),
    { ok: true, valor: { data_nascimento: null, idade_anos: 42 } });
  assert.deepEqual(idadeParaGravar("", "0", "2026-11-25"),
    { ok: true, valor: { data_nascimento: null, idade_anos: 0 } });
});

test("o que não serve vem com a frase do que corrigir", () => {
  const erro = (n: string, a: string) => {
    const r = idadeParaGravar(n, a, "2026-11-25");
    return r.ok ? null : r.erro;
  };
  assert.equal(erro("", ""), "Informe a data de nascimento ou a idade em anos.");
  assert.equal(erro("2026-02-30", ""), "Data de nascimento inválida.");
  assert.equal(erro("2027-01-01", ""), "A data de nascimento está no futuro.");
  assert.equal(erro("1890-01-01", ""), "Confira o ano de nascimento: dá mais de 120 anos.");
  assert.equal(erro("", "121"), "A idade em anos vai de 0 a 120.");
  assert.equal(erro("", "4,5"), "A idade em anos vai de 0 a 120.");
});

test("cesárea pelo texto da cirurgia, do jeito que se escreve", () => {
  for (const c of ["Cesárea", "CESAREA", "cesariana", "Cesareana segmentar", "Parto cesáreo", "cesária eletiva", "Cesárea + laqueadura"]) {
    assert.equal(ehCesarea(c), true, c);
  }
  for (const c of ["Colecistectomia", "Parto normal", "Histerectomia", "", null, "cesarismo"]) {
    assert.equal(ehCesarea(c), false, String(c));
  }
});

test("a ficha pergunta a equipe e deixa corrigir a idade", () => {
  const rodape = ler("components/evolucao/rodape-da-folha.tsx");
  for (const chave of ["segundo_cirurgiao", "auxiliar", "pediatra"]) assert.match(rodape, new RegExp(`mudar\\(\\{ ${chave}: v \\}\\)`));
  assert.match(rodape, /ehCesarea\(dados\.procedimento\)/);
  const folha = ler("components/evolucao/folha-anestesica.tsx");
  assert.match(folha, /onEditarIdade=\{aberta \? /);
  assert.match(folha, /from\("pacientes"\)\.update\(r\.valor\)\.eq\("id", paciente\.id\)/);
});
