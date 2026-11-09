import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { nomeParaCadastrar } from "./escala.ts";

// O nome que não está na equipe, cadastrado direto da janela "Quem entra na
// escala" (09/11/2026: "ir na outra página é muita burocracia").
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const equipe = [{ nome: "DRA ALESSANDRA" }, { nome: "Dr Gustavo Segobia" }, { nome: "DR JULIANO" }];

test("escala: oferece cadastrar só o nome que não está na equipe", () => {
  assert.equal(nomeParaCadastrar("  Dra   Fictícia  Nova ", equipe), "Dra Fictícia Nova");
  assert.equal(nomeParaCadastrar("dra alessandra", equipe), null, "mesmo nome, outra grafia: não duplica");
  assert.equal(nomeParaCadastrar("Dr Gustavo Segóbia", equipe), null, "sem acento conta igual");
  assert.equal(nomeParaCadastrar("Jo", equipe), null, "menos de três letras: ainda buscando");
  assert.equal(nomeParaCadastrar("49131", equipe), null, "número é CRM, não nome");
  assert.equal(nomeParaCadastrar("", equipe), null);
  assert.equal(nomeParaCadastrar("Ana", []), "Ana", "equipe vazia: o primeiro nome entra");
});

test("escala: a janela cadastra sem conta pela rota de Admin e já põe na escala", () => {
  const tela = ler("components/plantoes.tsx");
  assert.match(tela, /body: JSON\.stringify\(\{ nome, role: "medico", sem_acesso: true, crm \}\)/);
  assert.match(tela, /await alternarNaEscala\(r\.id, true\);/);
  // Só o administrador vê o botão (a rota também recusa os outros).
  assert.match(tela, /onCadastrar=\{ehAdmin \? cadastrarNaEscala : undefined\}/);
  assert.match(tela, /\{cadastrando \? "Cadastrando…" : "\+ Adicionar à escala"\}/);
  // O rodapé conta todos os marcados, e diz quantos estão sem CRM.
  assert.match(tela, /<strong>\{dentro\}<\/strong> de \{equipe\.length\} na escala/);
  assert.match(tela, /const dentro = equipe\.filter\(\(p\) => estado\[p\.id\]\)\.length;/);
  const rota = ler("app/api/admin/users/route.ts");
  assert.match(rota, /return NextResponse\.json\(\{ ok: true, id: criado\.id \}\);/);
  assert.match(rota, /!\["admin", "owner"\]\.includes\(actor\.role\)/, "só administrador ou proprietário cadastra");
});
