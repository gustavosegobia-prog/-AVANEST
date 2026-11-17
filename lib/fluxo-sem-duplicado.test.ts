import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  avisoDeAnotacaoRepetida, destinoDaFichaAberta, ehJaExiste, jaAnotadoNoDia, mesmoPacienteSemCpf,
} from "./fluxo-sem-duplicado.ts";

// O caminho do paciente sem nada em dobro (17/11/2026). O teste de ponta a
// ponta rodou no banco real dentro de uma transação desfeita no fim: cadastro
// → consulta → chegada → pagamento no balcão → avaliação → faturamento → mapa
// → ficha → produção → financeiro, tentando duplicar cada passo. Passavam em
// dobro: a avaliação em rascunho, a ficha aberta e a anotação à mão com o nome
// escrito de outro jeito. Estes testes guardam a correção. Pacientes fictícios.
const ler = (c: string) => fs.readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const migracao = ler("supabase/migrations/202611170001_fluxo_sem_duplicado.sql");

test("produção: o mesmo paciente com outra grafia é o mesmo paciente", () => {
  const dia = [
    { paciente: "José da Silva Teste", evolucao_id: "f1" },
    { paciente: "Maria Fictícia", evolucao_id: null },
  ];
  assert.equal(jaAnotadoNoDia(dia, "Jose  da Silva teste")?.evolucao_id, "f1");
  assert.equal(jaAnotadoNoDia(dia, "MARIA FICTICIA")?.paciente, "Maria Fictícia");
  assert.equal(jaAnotadoNoDia(dia, "Maria Fictícia Souza"), null);
  assert.equal(jaAnotadoNoDia(dia, "   "), null);
  assert.match(avisoDeAnotacaoRepetida(dia[0]), /já está na produção deste dia — veio da ficha anestésica/);
  assert.match(avisoDeAnotacaoRepetida(dia[1]), /toque em "\+ Anotar" de novo/);
});

test("recepção: o cadastro sem CPF (da ficha ou do mapa) é achado pelo nome e nascimento; com outro CPF, é outra pessoa", () => {
  const mesmoNascimento = [
    { id: "a", nome: "Ana Paula Teste", cpf: "390.533.447-05" },
    { id: "b", nome: "Ana Paula Teste", cpf: null },
    { id: "c", nome: "Outra Pessoa", cpf: "" },
  ];
  assert.equal(mesmoPacienteSemCpf(mesmoNascimento, "ana  paula teste")?.id, "b");
  assert.equal(mesmoPacienteSemCpf([mesmoNascimento[0]], "Ana Paula Teste"), null);
  assert.equal(mesmoPacienteSemCpf(mesmoNascimento, "Ana Teste"), null);
});

test("ficha: quando o banco recusa a segunda aberta, continua-se na mesma, ou diz onde ela está", () => {
  assert.equal(ehJaExiste({ code: "23505" }), true);
  assert.equal(ehJaExiste({ code: "42501" }), false);
  assert.equal(ehJaExiste(null), false);
  assert.deepEqual(destinoDaFichaAberta({ id: "f", localId: "h1", localNome: "Hospital A" }, "h1"), { id: "f" });
  assert.deepEqual(destinoDaFichaAberta({ id: "f", localId: null, localNome: null }, "h1"), { id: "f" });
  assert.deepEqual(destinoDaFichaAberta({ id: "f", localId: "h1", localNome: "Hospital A" }, null), { id: "f" });
  const outro = destinoDaFichaAberta({ id: "f", localId: "h1", localNome: "Hospital A" }, "h2");
  assert.ok("erro" in outro && /ficha aberta em Hospital A\. Encerre aquela ficha/.test(outro.erro));
});

test("banco: uma avaliação em rascunho e uma ficha aberta por paciente; a ficha acha a anotação pelo nome simples", () => {
  assert.match(migracao, /create unique index if not exists avaliacoes_um_rascunho_por_paciente\s+on public\.avaliacoes \(institution_id, patient_id\)\s+where status = 'rascunho';/);
  assert.match(migracao, /create unique index if not exists evolucoes_uma_aberta_por_paciente\s+on public\.evolucoes_anestesicas \(institution_id, patient_id\)\s+where status = 'aberta';/);
  assert.match(migracao, /and public\.nome_simples\(x\.paciente\) = public\.nome_simples\(v_paciente\)/);
  assert.doesNotMatch(migracao, /lower\(btrim\(x\.paciente\)\) = lower\(btrim\(v_paciente\)\)/);
  // Continua só para o encerramento chamar (não fica ao alcance da API).
  assert.match(migracao, /revoke all on function public\.producao_da_ficha\(uuid\) from public, anon, authenticated;/);
});

test("telas: quando o banco recusa o segundo, cada uma leva ao registro que já existe", () => {
  const abrir = ler("app/evolucao/abrir-ficha.ts");
  assert.match(abrir, /if \(ehJaExiste\(error\)\) \{[\s\S]{0,400}\.eq\("patient_id", paciente\.id\)\.eq\("status", "aberta"\)[\s\S]{0,300}return destinoDaFichaAberta\(/);
  const painel = ler("app/dashboard/dashboard-client.tsx");
  assert.match(painel, /if \(ehJaExiste\(createError\)\) \{[\s\S]{0,300}\.eq\("patient_id", patientId\)\.eq\("status", "rascunho"\)[\s\S]{0,400}router\.push\(`\/avaliacoes\/\$\{rascunho\.id\}`\);/);
  // A consulta só é religada se ainda não tem avaliação.
  assert.match(painel, /\.eq\("id", appointmentId\)\.is\("avaliacao_id", null\);/);
  assert.match(painel, /const semCpf=mesmoPacienteSemCpf\(mesmoDia\?\?\[\],patientName\);/);
  const producao = ler("components/producao-do-dia.tsx");
  assert.match(producao, /const repetido = jaAnotadoNoDia\(itens, paciente\);\s*if \(repetido && repetidoConfirmado !== nomeSimples\(paciente\)\) \{/);
});
