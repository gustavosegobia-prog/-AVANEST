import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { aceita, comPadrao } from "./preferencias-de-aviso.ts";

// "LEMBRAR QUEM FALTA" (22/11/2026): quem monta a escala vê quem ainda não
// confirmou e toca o telefone só dessas pessoas. O plantão só vira oferta
// para o grupo se o próprio médico anunciar — o sistema não oferece sozinho.

const ler = (caminho: string) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const rota = ler("app/api/push/avisar/route.ts");
const tela = ler("components/plantoes.tsx");

test("só quem monta a escala lembra a equipe, com limite próprio", () => {
  assert.match(rota, /if \(tipo === "escala" \|\| tipo === "lembrar_confirmacao"\) \{\s*const \{ data: podePublicar \} = await supabase\.rpc\("pode_montar_escala"\)/);
  assert.match(rota, /enforceRateLimit\(`avisar-confirmacao:\$\{user\.id\}`, \{ limit: 5,/);
});

test("a conta do servidor é a da tela, sem plantão só seu nem o de quem pediu", () => {
  const ramo = rota.slice(rota.indexOf('} else if (tipo === "lembrar_confirmacao")'), rota.indexOf('} else if (tipo === "plantao_novo"'));
  assert.ok(ramo.length > 200, "o ramo do lembrete sumiu");
  assert.match(ramo, /\.eq\("situacao", "escalado"\)\.is\("confirmado_em", null\)\.eq\("privado", false\)/);
  assert.match(ramo, /faltamConfirmar\(plantoes \?\? \[\], new Date\(\), euPerfil\.id\)/);
  assert.match(ramo, /consulta\.is\("local_id", null\)/);
  assert.match(ramo, /consulta\.eq\("local_id", local\)/);
  // Nada de e-mail: o lembrete é só push (e o sino, que cada um já vê).
  assert.match(rota, /const emails = tipo === "escala" \? await mandarOsEmails\(\) : 0;/);
});

test("a faixa é só de quem monta, na escala do grupo, e manda o hospital aberto", () => {
  assert.match(tela, /const faltam = ehAdmin && escopo === "grupo" \? faltamConfirmar\(daEscala, agora, perfilId\) : \[\];/);
  assert.match(tela, /JSON\.stringify\(\{ tipo: "lembrar_confirmacao", mes, local: hospitalAtivo \}\)/);
  assert.match(tela, /Lembrar quem falta/);
});

test("quem desligou o lembrete de plantão não recebe este", () => {
  assert.equal(aceita(comPadrao({ lembrete_plantao: false }), "lembrar_confirmacao"), false);
  assert.equal(aceita(comPadrao(null), "lembrar_confirmacao"), true);
});
