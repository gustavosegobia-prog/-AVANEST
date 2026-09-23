import test from "node:test";
import assert from "node:assert/strict";
import { ehPdf } from "./texto-do-laudo.ts";

test("PDF é reconhecido pelo tipo declarado", () => {
  assert.equal(ehPdf({ type: "application/pdf", name: "exames" }), true);
  assert.equal(ehPdf({ type: "image/jpeg", name: "foto.jpg" }), false);
});

test("e pela extensão, quando o navegador não declara o tipo", () => {
  // Acontece de verdade: compartilhar um PDF pelo WhatsApp no Android chega
  // com type vazio. Sem a extensão, o laudo cairia no OCR — que rodaria em
  // cima de um arquivo que não é imagem e devolveria lixo.
  assert.equal(ehPdf({ type: "", name: "laudo.PDF" }), true);
  assert.equal(ehPdf({ name: "exames_sarah.pdf" }), true);
  assert.equal(ehPdf({}), false);
});

test("nome com 'pdf' no meio não engana", () => {
  // "pdf" no meio do nome é comum ("relatorio-pdf-scan.jpg") e não diz nada
  // sobre o formato: só a extensão final conta.
  assert.equal(ehPdf({ type: "image/png", name: "relatorio-pdf-scan.png" }), false);
  assert.equal(ehPdf({ type: "", name: "pdf_do_exame.jpeg" }), false);
});
