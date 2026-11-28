import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { avisoDoCpf } from "./cpf.ts";

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

// 28/11/2026: o cadastro do paciente confere os dígitos do CPF, de graça.
// Dos 38 CPFs de paciente gravados até aqui, 10 não conferiam.

test("cpf do paciente: barrado ao salvar quando os dígitos não conferem", () => {
  const painel = ler("app/dashboard/dashboard-client.tsx");
  assert.match(painel, /const avisoCpf=avisoDoCpf\(cpfDigits\);\n\s+if\(avisoCpf\)\{\n\s+setError\(avisoCpf\);/);
  assert.doesNotMatch(painel, /Informe um CPF válido com 11 números\./, "a conferência antiga só contava os números");
  assert.equal(avisoDoCpf("529.982.247-25"), null);
  assert.equal(avisoDoCpf("529.982.247-24"), "Esse CPF não confere. Verifique os números.");
  assert.equal(avisoDoCpf("123"), "Informe o CPF com os 11 números.");
});

test("cpf do paciente: o aviso aparece embaixo do campo, antes de salvar", () => {
  const painel = ler("app/dashboard/dashboard-client.tsx");
  assert.match(painel, /const cpfErrado=mask==="cpf"&&valor\.replace\(\/\\D\/g,""\)\.length===11&&!cpfValido\(valor\);/);
  assert.match(painel, /\{cpfErrado&&<small id=\{`\$\{name\}-aviso`\} className="fieldError" role="alert">Esse CPF não confere\. Verifique os números\.<\/small>\}/);
  assert.match(ler("app/globals.css"), /\.clinicalField input\[aria-invalid="true"\]\{border-color:#b4232c/);
});
