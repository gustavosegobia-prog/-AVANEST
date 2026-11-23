import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { avisoDoCpf, cpfFormatado, cpfValido, digitosDoCpf } from "./cpf.ts";

const ler = (caminho: string) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("CPF de dígitos certos passa, com ou sem pontuação", () => {
  for (const cpf of ["529.982.247-25", "52998224725", "123.456.789-09", " 111.444.777-35 "]) {
    assert.equal(cpfValido(cpf), true, cpf);
  }
});

test("dígito trocado, número repetido e tamanho errado não passam", () => {
  for (const cpf of ["529.982.247-24", "123.456.789-00", "111.111.111-11", "000.000.000-00", "1234567890", "123456789012", "", null]) {
    assert.equal(cpfValido(cpf), false, String(cpf));
  }
});

test("a frase diz o que fazer", () => {
  assert.equal(avisoDoCpf("123.456"), "Informe o CPF com os 11 números.");
  assert.equal(avisoDoCpf("529.982.247-24"), "Esse CPF não confere. Verifique os números.");
  assert.equal(avisoDoCpf("529.982.247-25"), null);
});

test("formata e limpa", () => {
  assert.equal(digitosDoCpf("529.982.247-25"), "52998224725");
  assert.equal(cpfFormatado("52998224725"), "529.982.247-25");
  assert.equal(cpfFormatado("123"), "123");
});

test("o cadastro e o convite pedem o CPF e gravam pela função do banco", () => {
  for (const tela of ["app/comecar/onboarding-form.tsx", "app/convite/[token]/accept-invite-form.tsx"]) {
    const fonte = ler(tela);
    assert.match(fonte, /name="cpf"[^>]*required/, `${tela}: campo obrigatório`);
    assert.match(fonte, /avisoDoCpf\(texto\("cpf"\)\)/, `${tela}: confere antes de enviar`);
    assert.match(fonte, /rpc\("definir_meu_cpf", \{ p_cpf: digitosDoCpf\(texto\("cpf"\)\) \}\)/, `${tela}: grava pelo banco`);
  }
});

test("no banco, o CPF fica numa tabela que só a própria pessoa lê", () => {
  const sql = ler("supabase/migrations/202611230002_cpf_do_usuario.sql");
  assert.match(sql, /create table if not exists public\.perfis_cpf/);
  assert.match(sql, /check \(public\.cpf_valido\(cpf\) and /);
  assert.match(sql, /for select to authenticated\s+using \(perfil_id = \(select auth\.uid\(\)\)\)/);
  assert.doesNotMatch(sql, /alter table public\.perfis add/);
});
