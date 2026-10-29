import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { mensagemDoConvite, NOME_DO_PAPEL_NO_CONVITE, ONDE_TRABALHA } from "./convite-mensagem.ts";

const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");

// As funções que o convite aceita (convites_role_check, no banco).
const FUNCOES_DO_CONVITE = ["recepcao", "medico", "financeiro", "admin", "centro"];

test("toda função que o convite aceita tem nome e frase na mensagem", () => {
  for (const funcao of FUNCOES_DO_CONVITE) {
    assert.ok(NOME_DO_PAPEL_NO_CONVITE[funcao], `nome de ${funcao}`);
    assert.ok(ONDE_TRABALHA[funcao], `frase de ${funcao}`);
  }
  assert.equal(NOME_DO_PAPEL_NO_CONVITE.centro, "Centro cirúrgico");
});

test("a enfermeira do mapa é convidada como Centro cirúrgico, e não como 'centro'", () => {
  const texto = mensagemDoConvite(
    { role: "centro", email: "enfermeira@exemplo.com", expires_at: "2026-11-28T12:00:00Z" },
    "Hospital Fictício — Centro Cirúrgico", "https://www.avanest.com.br/convite/abc",
  );
  assert.match(texto, /como Centro cirúrgico\./);
  assert.match(texto, /mapa do centro cirúrgico/);
  assert.doesNotMatch(texto, /como centro\b/);
});

test("as telas do convite usam os mesmos nomes da mensagem, sem lista copiada", () => {
  for (const tela of ["app/convite/[token]/page.tsx", "app/criar-conta/page.tsx"]) {
    const codigo = ler(tela);
    assert.match(codigo, /const PAPEIS = NOME_DO_PAPEL_NO_CONVITE;/, tela);
  }
});

test("convidar pessoa: o link é o padrão, e o e-mail avisa do spam", () => {
  // O e-mail do convite sai do Supabase, em inglês, e caiu no spam (29/10/2026).
  const tela = ler("components/admin-pessoa.tsx");
  assert.match(tela, /useState<Forma>\("link"\)/);
  assert.match(tela, /role === "medico" \? \["link", "email", "sem_conta"\] : \["link", "email"\]/);
  assert.match(tela, /Gerar link de convite \(recomendado\)/);
  assert.match(tela, /cai no spam/);
});
