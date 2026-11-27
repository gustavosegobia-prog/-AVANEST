import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rotuloDaAcao, GRUPOS_DE_ACAO } from "./auditoria.ts";

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

// 27/11/2026: a recepção imprime de novo a ficha anestésica ENCERRADA de quem
// a perdeu. Só ler e imprimir; cada segunda via vai para a auditoria.

test("segunda via: a recepção acha a encerrada pelo nome e só imprime", () => {
  const painel = ler("components/segunda-via-da-ficha.tsx");
  assert.match(painel, /rpc\("pode_segunda_via"/, "só aparece para quem pode");
  assert.match(painel, /\.eq\("status", "encerrada"\)/);
  assert.match(painel, /<ImprimirFicha id=\{f\.id\}/);
  // Não há caminho para abrir a ficha: nem link, nem a tela dela.
  assert.doesNotMatch(painel, /href=|<Link|router\.push/);
  const recepcao = ler("components/recepcao.tsx");
  assert.match(recepcao, /<SegundaViaDaFicha institutionId=\{institutionId\} pacientes=\{pacientes\} \/>/);
  assert.match(recepcao, /Da parte clínica, só a segunda via da ficha anestésica encerrada\./);
});

test("segunda via: a impressão aceita a recepção e registra na auditoria", () => {
  const pagina = ler("app/evolucao/[id]/imprimir/page.tsx");
  assert.match(pagina, /const \{ supabase, perfil, clinico \} = await exigirAcessoAImpressao\(\);/);
  assert.match(pagina, /if \(!clinico\) await supabase\.rpc\("registrar_segunda_via", \{ p_evolucao_id: id \}\);/);
  assert.match(pagina, /href="\/dashboard" className="evoBotao fantasma">← Voltar à recepção/);
  const acesso = ler("lib/evolucao/acesso.ts");
  assert.match(acesso, /if \(clinico !== true && segundaVia !== true\) redirect\("\/dashboard"\);/);
  // A tela da ficha continua só para o acesso clínico.
  assert.match(ler("app/evolucao/[id]/page.tsx"), /exigirAcessoAEvolucao\(\)/);
  assert.equal(rotuloDaAcao({ entidade: "evolucao_anestesica", acao: "segunda_via_impressa" }), "Segunda via da ficha anestésica impressa");
  assert.ok(GRUPOS_DE_ACAO.find((g) => g.id === "clinico")?.entidades.includes("evolucao_anestesica"));
});
