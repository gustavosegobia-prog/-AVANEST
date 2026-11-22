import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 21/11/2026: quatro gravações do cabeçalho da ficha recusadas como conflito,
// duas delas com 3 ms de diferença. Era a própria pessoa: a gravação lenta e a
// seguinte saíam com a mesma versão. Uma gravação de cada vez.
const hook = fs.readFileSync(new URL("../../components/evolucao/use-folha.ts", import.meta.url), "utf8");

test("cabeçalho da ficha: uma gravação de cada vez, e a que chega no meio espera a vez", () => {
  const corpo = hook.slice(hook.indexOf("const gravarCabecalho = useCallback"), hook.indexOf("useEffect(() => { gravarDeNovo.current"));
  assert.match(corpo, /^const gravarCabecalho = useCallback\(async \(\) => \{\s*if \(gravando\.current\) return;/);
  // A trava liga antes da chamada e desliga logo depois da resposta, com erro ou sem.
  const liga = corpo.indexOf("gravando.current = true;");
  const chamada = corpo.indexOf('rpc("salvar_cabecalho_evolucao"');
  const desliga = corpo.indexOf("gravando.current = false;");
  assert.ok(liga > 0 && liga < chamada && chamada < desliga && desliga < corpo.indexOf("if (error)"));
  // Ao terminar, o que ficou pendente sai na sequência, com a versão nova.
  assert.match(corpo, /lockRef\.current = linha\.lock_version;[\s\S]*if \(cabecalhoPendente\.current\) gravarDeNovo\.current\(\);/);
});
