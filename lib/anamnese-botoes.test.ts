import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const form = fs.readFileSync(
  new URL("../app/avaliacoes/[id]/assessment-form.tsx", import.meta.url), "utf8");

const botoesDe = (pergunta: string): string[] => {
  const m = form.match(new RegExp(`\\n  ${pergunta}:\\[(.+?)\\],\\n`, "s"));
  assert.ok(m, `não achei os botões de ${pergunta}`);
  return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
};

test("os botões de resposta rápida nomeiam a doença, não o órgão", () => {
  // "Tireoide" na anamnese não informa nada: hipo e hipertireoidismo pedem
  // condutas opostas na sala, e quem lê a ficha depois fica sem saber qual dos
  // dois o paciente tem. O mesmo vale para "Renal" e "Hepática".
  const botoes = botoesDe("outras_doencas");
  for (const orgao of ["Tireoide", "Renal", "Hepática", "Reumatológica"]) {
    assert.ok(!botoes.includes(orgao), `"${orgao}" é órgão ou aparelho, não diagnóstico`);
  }
  for (const doenca of ["Hipotireoidismo", "Hipertireoidismo", "Doença renal crônica", "Cirrose"]) {
    assert.ok(botoes.includes(doenca), `faltou "${doenca}"`);
  }
});

test("nenhum botão tem vírgula", () => {
  // As escolhas são gravadas num campo de texto único, separadas por vírgula,
  // e relidas pelo mesmo separador. Um botão com vírgula no nome se partiria
  // em dois ao ser relido, e nenhum dos pedaços voltaria a casar com o botão.
  const listas = form.match(/const QUESTION_CHIPS[\s\S]+?\n\};/);
  assert.ok(listas);
  for (const [, texto] of listas![0].matchAll(/"([^"]+)"/g)) {
    assert.ok(!texto.includes(","), `"${texto}" tem vírgula`);
  }
});
