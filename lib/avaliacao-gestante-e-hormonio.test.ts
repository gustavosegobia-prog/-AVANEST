import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { findMedicationGuideEntry } from "./medication-guide.ts";

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

// 27/11/2026: pedidos do anestesiologista na ficha pré-anestésica.

test("reposição hormonal: um toque na adição rápida, com a orientação do guia", () => {
  const ficha = ler("app/avaliacoes/[id]/assessment-form.tsx");
  assert.match(ficha, /"Levotiroxina","Reposição hormonal","Sinvastatina"/);
  // O botão vem escrito assim, e o guia reconhece (estrogênio / terapia hormonal).
  for (const nome of ["Reposição hormonal", "reposicao hormonal", "Estradiol"]) {
    assert.equal(findMedicationGuideEntry(nome)?.key, "contraceptivo", nome);
  }
});

test("gestante: tipo sanguíneo e fator Rh, de um toque, apagados no 'Não' e impressos", () => {
  const ficha = ler("app/avaliacoes/[id]/assessment-form.tsx");
  assert.match(ficha, /\["gestacao_tipo_sanguineo", "Tipo sanguíneo", \["A", "B", "AB", "O"\]\]/);
  assert.match(ficha, /\["gestacao_fator_rh", "Fator Rh", \["Positivo", "Negativo"\]\]/);
  // Tocar de novo no mesmo botão desmarca.
  assert.match(ficha, /onClick=\{\(\)=>set\(field,draft\[field\]===opcao\?"":opcao\)\}/);
  // Responder "Não" à gestação apaga também o tipo sanguíneo e o Rh.
  assert.match(ficha, /\.\.\.PREGNANCY_BLOOD_FIELDS\.map\(\(\[f\]\)=>f\)/);
  const impressao = ler("app/avaliacoes/[id]/documentos/print-documents.tsx");
  assert.match(impressao, /\["gestacao_tipo_sanguineo","Tipo sanguíneo"\],\n {2}\["gestacao_fator_rh","Fator Rh"\]/);
});
