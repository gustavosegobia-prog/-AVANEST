import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

// 06/11/2026: "está se repetindo nos dias sozinho". O paciente do dia 05
// aparecia no dia 26: o painel da escala trocava o dia sem desmontar a lista,
// e a resposta do dia anterior chegava por último. Reproduzido no navegador
// (prévia com a resposta do dia 05 atrasada) e corrigido nas duas pontas.
test("a produção do dia não leva a lista de um dia para outro", () => {
  const lista = ler("components/producao-do-dia.tsx");
  // A troca de dia zera a lista, o carregando, o erro e o rascunho do Anotar.
  assert.match(lista, /if \(diaDaLista !== dia\) \{\s*setDiaDaLista\(dia\);\s*setItens\(\[\]\);\s*setCarregando\(true\);\s*setErro\(""\);\s*setNovo\(vazio\);/);
  // A resposta de um dia que já não está aberto é descartada.
  assert.match(lista, /const pedido = \+\+pedidoAtual\.current;[\s\S]*?if \(pedido !== pedidoAtual\.current\) return;/);
  // E o painel da escala monta uma lista por dia.
  assert.match(ler("components/plantoes.tsx"), /<ProducaoDoDia\s+key=\{dia\}/);
});
