import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * AS ÁREAS EXTRAS ABRIAM VAZIAS.
 *
 * O administrador marca "também acessa: Recepção / Médico" e a tela mostra a
 * área — mas o banco olhava só o papel. Medido numa transação desfeita:
 * Financeiro + extra Recepção via 0 pacientes; Recepção + extra Médico via 0
 * avaliações. 202609300009 soma políticas que respeitam a extra, dando ler,
 * criar e editar — não apagar — e tira "Administrador" das extras.
 */
const ler = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const sql = ler("supabase/migrations/202609300009_areas_extras_valem_no_banco.sql");
const tela = ler("app/dashboard/dashboard-client.tsx");
const faturar = ler("app/api/avaliacoes/[id]/faturar/route.ts");

test("extras dão ler, criar e editar — e nunca apagar", () => {
  for (const acao of ["for select", "for insert", "for update"]) {
    assert.ok(sql.includes(acao), `sumiu a política de ${acao}`);
  }
  assert.doesNotMatch(sql, /for (delete|all)\b/, "uma extra passou a poder apagar");
});

test("pacientes e agenda para extra Recepção ou Médico; clínico só para extra Médico", () => {
  assert.match(sql, /foreach t in array array\['pacientes', 'agendamentos'\] loop/);
  assert.match(sql, /public\.current_has_permission\('recepcao'\) or public\.current_has_permission\('medico'\)/);
  for (const t of ["avaliacoes", "documentos", "exames", "historias", "vias_aereas"]) {
    assert.ok(sql.includes(`'${t}'`), `a tabela clínica ${t} ficou fora`);
  }
  assert.match(sql, /bucket_id = any \(array\['anexos', 'documentos'\]\)/, "os arquivos anexos ficaram fora");
});

test("Administrador deixa de ser área extra, no banco e na tela", () => {
  assert.match(sql, /v_novo text := \$v\$where item in \('recepcao','medico','financeiro'\);\$v\$;/);
  assert.match(tela, /export const AREAS_EXTRAS = \["recepcao", "medico", "financeiro"\] as const;/,
    "a caixa de Administrador voltou à tela, e o banco a descarta ao salvar");
});

test("quem tem Médico como extra consegue concluir e faturar a avaliação", () => {
  assert.match(faturar, /\.select\("id,institution_id,role,status,permissoes"\)/);
  assert.match(faturar, /extras\.includes\("medico"\) \|\| extras\.includes\("todos"\)/,
    "a rota de faturar voltou a olhar só o papel — avaliação concluída sem lançamento");
});
