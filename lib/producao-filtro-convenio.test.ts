import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Produção do mês (15/11/2026): "se eu quiser editar o plano aqui, se houver
// errado no cadastro" e "imprimir só com o filtro de um plano ou dois, sem
// aparecer o restante".
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const tela = ler("components/producao-do-dia.tsx");

test("produção do mês: o filtro de convênio vale para a lista, o marcar todos e as folhas", () => {
  // Nenhum escolhido é o mês inteiro; a chave junta "UNIMED" e "Unimed".
  assert.match(tela, /const visiveis = filtroAtivo\.length\s*\? itens\.filter\(\(i\) => soConvenios\.has\(chaveDoPagador\(i\.convenio\)\)\)\s*: itens;/);
  assert.match(tela, /onClick=\{\(\) => onImprimir\(visiveis\)\}/, "lista por convênio imprime só os filtrados");
  assert.match(tela, /onClick=\{\(\) => onPlanilhaConvenio\(visiveis\)\}/, "e a planilha também");
  assert.match(tela, /const paraNota = selecionados\.length \? selecionados : visiveis;/, "a nota sem marcação sai dos filtrados");
  assert.match(tela, /const selecionados = visiveis\.filter\(\(i\) => marcados\.has\(i\.id\)\);/, "marcado escondido pelo filtro não conta");
  assert.match(tela, /new Set\(visiveis\.map\(\(i\) => i\.id\)\)/, "marcar todos marca só os que aparecem");
  assert.match(tela, /\{visiveis\.map\(\(i\) => \{/);
  assert.match(tela, /aria-pressed=\{filtroAtivo\.length === 0\}/);
});

test("produção do mês: corrigir o convênio na linha, com a grafia do cadastro e o honorário refeito", () => {
  assert.match(tela, /aria-label=\{`Corrigir convênio ou cirurgia de \$\{i\.paciente\}`\}/);
  assert.match(tela, /const convenio = grafiaConhecida\(corrigindo\.convenio\.trim\(\), conhecidos\) \|\| i\.convenio;/);
  assert.match(tela, /await definir\(i\.id, \{ convenio, procedimento \}\);/);
  // O banco devolve o honorário para "calcular" quando o convênio muda
  // (migração 202610230013); a tela mostra isso na hora.
  assert.match(tela, /guardarHonorario\(i\.id, \{ honorario_situacao: "nao_calculado" \}\);/);
  assert.match(ler("supabase/migrations/202610230013_honorario_na_producao.sql"),
    /new\.convenio is distinct from old\.convenio[\s\S]{0,200}new\.honorario_situacao := 'nao_calculado';/);
  assert.match(ler("components/plantoes.tsx"), /<ProducaoDoMes\s+mes=\{mes\} nomeMes=\{MESES\[m - 1\]\} ano=\{ano\} conveniosConhecidos=\{conveniosConhecidos\}/);
});
