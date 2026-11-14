import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// A ficha esquecida aberta fecha sozinha depois da virada do dia (14/11/2026).
// A regra roda no banco (migração 202611140001); aqui, o agendamento, a rota,
// quem pode chamar e o que a lista e a impressão mostram.
const ler = (c: string) => fs.readFileSync(new URL(`../../${c}`, import.meta.url), "utf8");
const MIGRACAO = "supabase/migrations/202611140001_fichas_esquecidas_fecham_sozinhas.sql";

test("fichas esquecidas: a rotina roda de hora em hora, com o segredo do agendador", () => {
  const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };
  const cron = vercel.crons.find((c) => c.path === "/api/evolucao/fechar-do-dia");
  assert.ok(cron, "agendada");
  assert.equal(cron.schedule, "20 * * * *");
  const rota = ler("app/api/evolucao/fechar-do-dia/route.ts");
  assert.match(rota, /segredoConfere\(request\.headers\.get\("authorization"\), segredo\)/, "sem o segredo não roda");
  assert.match(rota, /admin\.rpc\("fechar_fichas_esquecidas"\)/, "a rota não manda p_agora");
});

test("fichas esquecidas: só a chave de serviço chama, e a regra protege a cirurgia que vira a noite", () => {
  const sql = ler(MIGRACAO).replace(/--.*$/gm, "");
  assert.match(sql, /revoke all on function public\.fechar_fichas_esquecidas\(timestamptz\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.fechar_fichas_esquecidas\(timestamptz\) to service_role;/);
  // Antes de hoje em Brasília, e nada escrito há 3 horas.
  assert.match(sql, /date_trunc\('day', v_agora at time zone 'America\/Sao_Paulo'\) at time zone 'America\/Sao_Paulo'/);
  assert.match(sql, /e\.status = 'aberta'\s+and e\.created_at < v_corte/);
  assert.match(sql, /< v_agora - interval '3 hours'/);
  // Vazia some (com auditoria); com registro encerra sem dono, na hora do último registro.
  assert.match(sql, /'excluir',\s+jsonb_build_object\('motivo'/);
  assert.match(sql, /set status = 'encerrada', encerrada_em = v_fim, encerrada_por = null/);
  assert.match(sql, /perform public\.producao_da_ficha\(f\.id\)/, "a produção do dia é lançada como no Encerrar");
  assert.match(sql, /alter table public\.evolucao_versoes alter column encerrada_por drop not null;/);
});

test("fichas esquecidas: a lista e a impressão dizem que foi automática", () => {
  const pagina = ler("app/evolucao/page.tsx");
  assert.match(pagina, /sozinha: Boolean\(l\.encerrada_em\) && !l\.encerrada_por/);
  assert.match(ler("app/evolucao/inicio-das-folhas.tsx"), /f\.sozinha && "encerrada automaticamente"/);
  assert.match(ler("app/evolucao/[id]/imprimir/page.tsx"),
    /encerradaSozinha=\{folha\.status === "encerrada" && !folha\.encerrada_por\}/);
  assert.match(ler("components/evolucao/folha-impressa.tsx"),
    /encerrada automaticamente depois da virada do dia \(último registro em \$\{dataHora\(folha\.encerrada_em\)\}\)/);
});
