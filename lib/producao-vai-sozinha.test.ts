import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// A produção que vai sozinha ao financeiro (07/11/2026). As regras do banco
// estão em supabase/testes/producao-sozinha-banco.mjs; aqui, a rotina, o
// agendamento e a tela.
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

test("produção sozinha: a rotina roda depois da meia-noite de Brasília e manda até ontem", () => {
  const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
  const cron = vercel.crons.find((c) => c.path === "/api/producao/enviar-do-dia");
  assert.ok(cron, "agendada");
  // 03:10 UTC = 00:10 em Brasília (UTC-3): o dia anterior já acabou.
  assert.equal(cron.schedule, "10 3 * * *");
  const rota = ler("app/api/producao/enviar-do-dia/route.ts");
  assert.match(rota, /segredoConfere\(request\.headers\.get\("authorization"\), segredo\)/, "sem o segredo não roda");
  assert.match(rota, /const ate = somarDias\(hoje\(\), -1\);/);
  assert.match(rota, /admin\.rpc\("enviar_producao_sozinha", \{ p_ate: ate \}\)/);
});

test("produção sozinha: por pessoa, começando desligado, e a tela diz o que acontece", () => {
  const sql = ler("supabase/migrations/202611070003_producao_vai_sozinha.sql").replace(/--.*$/gm, "");
  assert.match(sql, /add column if not exists producao_vai_sozinha boolean not null default false/);
  assert.doesNotMatch(sql, /instituicoes\s+add column/i, "não é ligado para a organização inteira");
  assert.match(sql, /grant execute on function public\.enviar_producao_sozinha\(date\) to service_role;/);
  assert.match(sql, /revoke all on function public\.enviar_producao_sozinha\(date\) from public, anon, authenticated;/);
  const tela = ler("components/producao-do-dia.tsx");
  assert.match(tela, /rpc\("definir_producao_vai_sozinha", \{ p_ligado: ligado \}\)/);
  assert.match(tela, /<strong>Enviar sozinho todo dia<\/strong>/);
  assert.match(tela, /Depois da meia-noite, o que é de ontem para trás vai ao financeiro\. Você continua podendo corrigir\./);
  // Antes da migração (ou sem saber), a opção não aparece.
  assert.match(tela, /\{vaiSozinha !== null && \(/);
});
