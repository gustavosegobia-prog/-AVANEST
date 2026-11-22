import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 22/11/2026 ("esse negócio de confirmar todo dia é ruim, a pessoa esquece. Na
// hora que lançar os plantões da equipe, ele tem que olhar e já confirmar o que
// ele quer. Se não confirmar, tem que anunciar ou passar para algum colega").
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

test("banco: confirma antes do plantão, só o dono, zera quando o plantão muda, e o que terminou vira realizado", () => {
  const sql = ler("supabase/migrations/202611220001_escala_confirmada_no_lancamento.sql");
  // Nada de "ainda não começou" nem de janela no dia.
  assert.doesNotMatch(sql, /ainda não começou/);
  assert.match(sql, /if auth\.uid\(\) is not null and new\.perfil_id is distinct from auth\.uid\(\) then/);
  assert.match(sql, /if new\.situacao = 'cancelado' then\s*raise exception 'Plantão cancelado não se confirma';/);
  assert.match(sql, /before update of perfil_id, data, hora_inicio, hora_fim, local_id, local_texto on public\.plantoes/);
  assert.match(sql, /set situacao = 'realizado', updated_at = now\(\)\s*where pl\.situacao = 'escalado'/);
  assert.match(sql, /revoke all on function public\.realizar_plantoes_passados\(timestamptz\) from public, anon, authenticated;/);
  // Os que ficaram para trás (pedido do responsável: "viram realizados").
  assert.match(sql, /select public\.realizar_plantoes_passados\(\);\s*$/);
});

test("rotina: roda de hora em hora com o segredo do agendador", () => {
  const rota = ler("app/api/escala/realizar-passados/route.ts");
  assert.match(rota, /segredoConfere\(request\.headers\.get\("authorization"\), segredo\)/);
  assert.match(rota, /admin\.rpc\("realizar_plantoes_passados"\)/);
  const vercel = JSON.parse(ler("vercel.json")) as { crons: { path: string; schedule: string }[] };
  assert.equal(vercel.crons.find((c) => c.path === "/api/escala/realizar-passados")?.schedule, "40 * * * *");
});

test("tela: confirmar e passar plantão lado a lado antes do dia; confirmar todos de uma vez; aviso da escala pede a confirmação", () => {
  const tela = ler("components/plantoes.tsx");
  assert.match(tela, /: p\.situacao === "escalado" && podeConfirmar\(p, new Date\(\)\) \? \(/);
  assert.match(tela, /\{!p\.privado && p\.situacao === "escalado" && p\.data > hojeISO && \(\s*<button className="outlineClinical" onClick=\{\(\) => onPassar\(p\)\}/);
  assert.match(tela, /onClick=\{\(\) => void confirmarTodos\(pendencias\.confirmacoes\)\}/);
  assert.match(tela, /\.update\(\{ confirmado_em: new Date\(\)\.toISOString\(\) \}\)\s*\.in\("id", lista\.map\(\(p\) => p\.id\)\)\.is\("confirmado_em", null\)/);
  assert.match(ler("app/api/push/avisar/route.ts"), /Confirme os seus, ou passe para um colega o que não puder fazer\./);
  // O aviso do sino precisa saber o que é só seu (ele não tem confirmação).
  assert.match(ler("app/dashboard/page.tsx"), /select\("data,situacao,valor,confirmado_em,privado,created_at,created_by"\)/);
  assert.match(ler("app/api/push/lembretes/route.ts"), /select\("perfil_id,data,situacao,valor,confirmado_em,privado"\)/);
});
