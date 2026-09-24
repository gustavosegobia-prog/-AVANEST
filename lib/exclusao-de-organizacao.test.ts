import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  bloqueioParaExcluir, confirmacaoConfere, podeExcluir,
} from "./exclusao-de-organizacao.ts";

const vazia = { nome: "AMPEX ANESTESIA", pacientes: 0, avaliacoes: 0, usuarios: 0 };

test("organização que nunca saiu do papel pode ser excluída", () => {
  assert.equal(bloqueioParaExcluir(vazia), null);
  assert.equal(podeExcluir(vazia), true);
});

test("PRONTUÁRIO NÃO SE APAGA", () => {
  // É a regra que decide este arquivo inteiro. Ficha pré-anestésica é
  // prontuário, e prontuário tem guarda obrigatória — o dono da plataforma não
  // tem o direito de apagar o que um anestesiologista assinou.
  const comFicha = { ...vazia, nome: "Leandro — Individual", pacientes: 1, avaliacoes: 1, usuarios: 1 };
  const motivo = bloqueioParaExcluir(comFicha);
  assert.ok(motivo?.includes("prontuário"), motivo ?? "");
  assert.ok(motivo?.includes("Cancelar"), "precisa dizer o que fazer no lugar");
  assert.equal(podeExcluir(comFicha), false);
});

test("usuário sozinho já basta para bloquear", () => {
  // Organização sem paciente mas com gente dentro: apagar tiraria o acesso de
  // alguém que hoje entra no sistema.
  const motivo = bloqueioParaExcluir({ ...vazia, nome: "Mateus — Cardiologia", usuarios: 1 });
  assert.ok(motivo?.includes("1 usuário(s)"), motivo ?? "");
});

test("o motivo diz O QUE tem dentro, e não só que não dá", () => {
  const motivo = bloqueioParaExcluir({ ...vazia, pacientes: 22, avaliacoes: 1, usuarios: 14 });
  assert.ok(motivo?.includes("22 paciente(s)"), motivo ?? "");
  assert.ok(motivo?.includes("1 ficha(s)"), motivo ?? "");
  assert.ok(motivo?.includes("14 usuário(s)"), motivo ?? "");
  // "a, b e c" — o "e" antes do último.
  assert.ok(motivo?.includes(" e 14 usuário(s)"), motivo ?? "");
});

test("A PRÓPRIA ORGANIZAÇÃO NUNCA, e esse motivo vem primeiro", () => {
  // Excluir a própria organização é trancar-se do lado de fora do sistema, sem
  // volta pela interface. Vale mesmo que ela esteja vazia.
  const minha = { ...vazia, minha: true };
  assert.ok(bloqueioParaExcluir(minha)?.includes("sem acesso"));
  assert.equal(podeExcluir(minha), false);
});

test("a confirmação é DIGITAR O NOME, não um 'tem certeza?'", () => {
  // Caixa de certeza é clicada no automático — mesmo gesto de fechar um aviso.
  // Copiar o nome obriga a olhar qual linha vai sumir, que é justamente o erro
  // a evitar: excluir a organização de baixo.
  assert.equal(confirmacaoConfere("AMPEX ANESTESIA", "AMPEX ANESTESIA"), true);
  assert.equal(confirmacaoConfere("AMPEX", "AMPEX ANESTESIA"), false);
  assert.equal(confirmacaoConfere("", "AMPEX ANESTESIA"), false);
});

test("confere apesar de acento, caixa e espaço sobrando", () => {
  // A ideia é provar atenção, não testar datilografia.
  assert.equal(confirmacaoConfere("  fundhospar — centro cirúrgico ", "FUNDHOSPAR — Centro Cirúrgico"), true);
  assert.equal(confirmacaoConfere("ruan  —  Individual", "ruan — Individual"), true);
});

test("nome vazio não vira confirmação automática", () => {
  // Sem isto, uma organização com nome em branco seria excluída por um campo
  // em branco — dois vazios que "conferem".
  assert.equal(confirmacaoConfere("", ""), false);
});

test("AS TRAVAS ESTÃO NO BANCO, e não só aqui", () => {
  // Escritas só no TypeScript, bastaria uma chamada nova meses adiante para
  // apagar prontuário. A função do banco recusa por qualquer caminho.
  const sql = fs.readFileSync(
    new URL("../supabase/migrations/202609240001_excluir_organizacao.sql", import.meta.url), "utf8");
  assert.match(sql, /e_super_admin\(\)/);
  assert.match(sql, /v_minha = p_id/);
  assert.match(sql, /v_pacientes > 0 or v_avaliacoes > 0 or v_perfis > 0/);
  assert.match(sql, /revoke execute on function public\.excluir_organizacao\(uuid\) from public, anon/);
});
