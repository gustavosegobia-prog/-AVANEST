import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { saiComPlantoes, textoDaExclusao, type SaiComOCadastro } from "./excluir-cadastro.ts";

// As regras do banco estão em supabase/testes/excluir-cadastro-banco.mjs; aqui,
// o que a tela decide e diz antes do toque (08/11/2026).
const s = (x: Partial<SaiComOCadastro>): SaiComOCadastro =>
  ({ plantoes: 13, pacientes_no_mapa: 20, outros: 0, clinico: 0, sem_conta: true, ...x });

test("excluir cadastro: sai com os plantões só o sem conta que só tem plantões", () => {
  assert.equal(saiComPlantoes(s({})), true);
  assert.equal(saiComPlantoes(s({ sem_conta: false })), false, "quem tem login: desativar");
  assert.equal(saiComPlantoes(s({ outros: 1 })), false, "produção, troca ou faturamento: desativar");
  assert.equal(saiComPlantoes(s({ clinico: 1 })), false);
  assert.equal(saiComPlantoes(s({ plantoes: 0 })), false, "sem plantões, a exclusão de sempre resolve");
  assert.equal(saiComPlantoes(null), false);
});

test("excluir cadastro: o aviso diz os números, e o botão também", () => {
  const t = textoDaExclusao("DR GUSTAVO", s({}));
  assert.equal(t.botao, "Excluir com 13 plantões");
  assert.match(t.aviso, /Junto com o cadastro saem os 13 plantões dele na escala\. 20 pacientes do mapa ficam sem anestesista\./);
  assert.match(t.aviso, /Não tem volta\.$/);
  const um = textoDaExclusao("DR MOLLA", s({ plantoes: 1, pacientes_no_mapa: 0 }));
  assert.equal(um.botao, "Excluir com 1 plantão");
  assert.match(um.aviso, /Junto com o cadastro sai o plantão dele na escala\. Os plantões apagados/);
  assert.doesNotMatch(um.aviso, /mapa/);
  const tela = fs.readFileSync(new URL("../components/admin-pessoa.tsx", import.meta.url), "utf8");
  assert.match(tela, /rpc\("o_que_sai_com_o_cadastro", \{ p_perfil_id: pessoa\.id \}\)/);
  assert.match(tela, /rpc\("excluir_cadastro_com_plantoes", \{ p_perfil_id: pessoa\.id \}\)/);
  assert.match(tela, /confirmar=\{comPlantoes \? comPlantoes\.botao : "Excluir definitivamente"\}/);
});
