import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** A RECEPÇÃO — ligações da tela com o banco e as restrições que não podem voltar. */
const ler = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const tela = ler("components/recepcao.tsx");
const painel = ler("app/dashboard/dashboard-client.tsx");
const sql = ler("supabase/migrations/202609300016_agenda_da_recepcao.sql");

test("uma ação só no topo: Nova avaliação pré-anestésica (cadastro e consulta de uma vez)", () => {
  assert.match(tela, />\s*\+ Nova avaliação pré-anestésica\s*</);
  assert.match(tela, /className="primaryClinical recAgendar" data-acao="novo-paciente"/);
  assert.doesNotMatch(tela, /data-acao="agendar-consulta"/, "voltou o Agendar consulta repetido no topo");
  assert.doesNotMatch(tela, /setAgendando\(\{ paciente: null \}\)/, "voltou um Agendar consulta sem paciente");
  assert.match(tela, /onClick=\{\(\) => setAgendando\(\{ paciente: p \}\)\}>Agendar consulta<\/button>/);
  assert.match(painel, /<RecepcaoView perfilId=\{perfil\.id\}/);
});

test("a recepção não lê avaliações: o andamento vem da função que devolve só a etapa", () => {
  assert.doesNotMatch(tela, /from\("avaliacoes"\)/);
  assert.match(tela, /rpc\("andamento_da_agenda"/);
  assert.match(sql, /returns table \(agendamento_id uuid, etapa text, medico_id uuid\)/);
  assert.doesNotMatch(tela, /financeiro_|valor_particular|receber_particular/, "a Recepção não mexe em dinheiro");
});

test("transições validadas no banco — pela função e pelo update direto", () => {
  assert.match(sql, /create trigger agendamento_antes_de_gravar\s+before insert or update on public\.agendamentos/);
  assert.match(sql, /new\.status_by := coalesce\(auth\.uid\(\), new\.status_by\);/);
  assert.match(tela, /rpc\("registrar_presenca", \{ p_agendamento_id: c\.id, p_status: destino \}\)/);
});

test("histórico: cada mudança vira evento; o passado só com o que estava gravado", () => {
  assert.match(sql, /create trigger agendamento_registra_evento\s+after insert or update on public\.agendamentos/);
  assert.match(sql, /revoke insert, update, delete, truncate on public\.agendamento_eventos from anon, authenticated;/);
  assert.match(sql, /from public\.auditoria au/);
  assert.match(tela, /if \(!c\.status_at \|\| c\.status === "agendado"\) return null;/, "sem carimbo inventado");
  assert.doesNotMatch(tela, /8 ?\+ ?index/, "horário inventado pela posição na lista");
});

test("reagendar preserva a marcação antiga e usa a mesma limpeza do desmarcar", () => {
  assert.match(sql, /perform public\.registrar_presenca\(v_antigo\.id, 'reagendado'\);/);
  assert.match(tela, /rpc\("reagendar_consulta"/);
});

test("estado vazio com ações úteis, sem repetir o topo", () => {
  assert.match(tela, /Ver próxima data com consultas \(\{dataCurtaBr\(proxima\)\}\)/);
  assert.match(tela, /Cadastrar novo paciente/);
});

test("CPF já cadastrado: a mesma janela marca a consulta para o cadastro existente", () => {
  const painel = ler("app/dashboard/dashboard-client.tsx");
  assert.match(painel, /<h2 id="titulo-novo-paciente">Nova avaliação pré-anestésica<\/h2>/);
  assert.match(painel, /Agendar para \$\{duplicado\.nome\}/);
  assert.match(painel, /patient_id: dup\.id, data: c\.data, horario,/);
  assert.match(painel, /onCpfMudou=\{\(\)=>\{ setDuplicadoNoCadastro\(null\); setError\(""\); \}\}/);
});
