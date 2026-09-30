import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * FUNÇÃO QUE NÃO CONFERE NADA NÃO PODE SER CHAMADA POR QUEM ESTÁ LOGADO.
 *
 * Estas nove recebem o identificador de qualquer organização ou pessoa e
 * respondem — duas ainda apagam dados de todas as organizações. Medido numa
 * transação desfeita, depois de 202609300012: as nove recusam o usuário
 * logado; minha_assinatura e excluir_usuario, que as chamam por dentro,
 * seguem funcionando; producao_recebida aceita o médico com o Financeiro
 * como área extra e continua recusando o médico sem ele.
 */
const sql = readFileSync(
  new URL("../supabase/migrations/202609300012_auxiliares_fora_do_alcance.sql", import.meta.url), "utf8");

const AUXILIARES = [
  "atendimento_aberto_do_paciente(uuid, uuid)",
  "contar_profissionais(uuid)",
  "inicio_do_ciclo(uuid)",
  "plano_sugerido(uuid)",
  "perfil_tem_clinico(uuid)",
  "perfil_tem_escala(uuid)",
  "perfil_tem_registros(uuid)",
  "limpar_adiamentos_vencidos()",
  "limpar_recibos_de_aviso()",
];

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("as nove saem de authenticated e ficam só com a chave de serviço", () => {
  for (const f of AUXILIARES) {
    assert.match(sql, new RegExp(`revoke execute on function public\\.${escapar(f)}\\s+from public, anon, authenticated;`),
      `${f} voltou a ser alcançável por quem está logado`);
    assert.match(sql, new RegExp(`grant execute on function public\\.${escapar(f)}\\s+to service_role;`),
      `${f} deixou de estar disponível para a chave de serviço`);
  }
  assert.doesNotMatch(sql, /grant\s+execute[^;]*to[^;]*authenticated/,
    "nenhuma destas pode ser devolvida a authenticated");
});

test("producao_recebida pergunta pela permissão do Financeiro, não pelo papel", () => {
  assert.match(sql, /v_novo  text := \$v\$if not public\.current_has_permission\('financeiro'\) then\$v\$;/);
  assert.match(sql, /raise exception 'producao_recebida mudou de forma inesperada/,
    "a troca deixou de recusar um corpo diferente do esperado");
});

test("nenhuma tela chama as auxiliares pelo navegador", () => {
  const telas = [
    "../components/producao-do-dia.tsx",
    "../components/plantoes.tsx",
    "../app/dashboard/dashboard-client.tsx",
    "../app/dashboard/page.tsx",
  ].map((p) => readFileSync(new URL(p, import.meta.url), "utf8")).join("\n");
  for (const f of AUXILIARES) {
    const nome = f.slice(0, f.indexOf("("));
    assert.doesNotMatch(telas, new RegExp(`rpc\\("${nome}"`), `${nome} é chamada de uma tela e seria recusada`);
  }
});
