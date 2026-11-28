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

test("gestante: tipo sanguíneo e Rh em alerta vermelho, na tela e na folha", async () => {
  const { sangueDaGestanteTexto } = await import("./sangue-da-gestante.ts");
  assert.equal(sangueDaGestanteTexto({ gestacao: "Sim", gestacao_tipo_sanguineo: "O", gestacao_fator_rh: "Negativo" }), "tipo sanguíneo O · Rh negativo");
  assert.equal(sangueDaGestanteTexto({ gestacao: "Sim", gestacao_fator_rh: "Positivo" }), "Rh positivo");
  assert.equal(sangueDaGestanteTexto({ gestacao: "Não", gestacao_tipo_sanguineo: "A" }), "", "sem gestação, sem alerta");
  assert.equal(sangueDaGestanteTexto({ gestacao: "Sim" }), "", "nada marcado, sem alerta");
  const ficha = ler("app/avaliacoes/[id]/assessment-form.tsx");
  assert.match(ficha, /\{sangueDaGestante && <span className="alertaSangue"><Icone nome="alerta" tamanho=\{17\}\/> <b>Gestante:<\/b> \{sangueDaGestante\}<\/span>\}/);
  const folha = ler("app/avaliacoes/[id]/documentos/print-documents.tsx");
  assert.match(folha, /<div className="paperAllergy paperSangue">⚠ GESTANTE · \{sangueDaGestanteTexto\(dados\)\.toUpperCase\(\)\}<\/div>/);
  assert.match(ler("app/globals.css"), /\.paperSangue\{border:2px solid #c00;color:#c00;text-align:center\}/);
});

test("ficha anestésica: o tipo sanguíneo da gestante vem da avaliação, e a célula fica vermelha", async () => {
  const { tipoSanguineoDaGestante } = await import("./sangue-da-gestante.ts");
  assert.equal(tipoSanguineoDaGestante({ gestacao: "Sim", gestacao_tipo_sanguineo: "O", gestacao_fator_rh: "Negativo" }), "O negativo");
  assert.equal(tipoSanguineoDaGestante({ gestacao: "Sim", gestacao_fator_rh: "Positivo" }), "Rh positivo");
  assert.equal(tipoSanguineoDaGestante({ gestacao: "Sim", gestacao_tipo_sanguineo: "AB" }), "AB");
  assert.equal(tipoSanguineoDaGestante({ gestacao: "Não", gestacao_tipo_sanguineo: "A" }), "");
  const { cabecalhoInicial } = await import("./evolucao/importar.ts");
  const paciente = { nome: "Paciente Fictícia", data_nascimento: null, idade_anos: 29, sexo: "Feminino", convenio: "SUS",
    hospital: null, cirurgia: "Cesariana", procedimento: null };
  const agora = new Date("2026-11-28T10:00:00Z");
  const gestante = cabecalhoInicial(paciente, { id: "av1", dados: { gestacao: "Sim", gestacao_tipo_sanguineo: "O", gestacao_fator_rh: "Negativo" } }, agora);
  assert.equal(gestante.papel_tipo_sanguineo, "O negativo");
  const outra = cabecalhoInicial(paciente, { id: "av2", dados: { gestacao: "Não" } }, agora);
  assert.equal(outra.papel_tipo_sanguineo, "");
  const folha = ler("components/evolucao/pre-da-folha.tsx");
  assert.match(folha, /rotulo="Tipo Sanguíneo:" valor=\{c\.tipo_sanguineo\} onMudar=\{campo\("tipo_sanguineo"\)\}\s+alerta=\{Boolean\(c\.tipo_sanguineo\.trim\(\)\)\}/);
  assert.match(ler("app/globals.css"), /\.imprFolha \.evoPFCel\.tipo\.alerta \.v\{color:#c00;font-weight:700;/);
});
