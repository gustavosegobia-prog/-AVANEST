import test from "node:test";
import assert from "node:assert/strict";
import {
  altaDaRpa, anestesistasDePlantao, avisoDoAldrete, cancelar, colunasDoMapa, conferirHorario, contagemPorEtapa,
  desfazer, duracao, entrarEmSala, horaDe, instanteDoPasso, linhaDoForm, formVazio, ordenarCasos, proximoPasso,
  resumoDoDia, rotuloDoDesfazer, sairDaSala, tempoNaEtapa, tempos, type Caso,
} from "./centro-cirurgico.ts";

const iso = (data: string, h: string) => new Date(`${data}T${h}:00-03:00`).toISOString();

const caso = (extra: Partial<Caso> = {}): Caso => ({
  id: "c1", data: "2026-10-21", sala_id: "s1", horario: "07:30:00", paciente: "Paciente A", idade: 40,
  prontuario: null, procedimento: "Colecistectomia", cirurgiao: "Dr. Cirurgião", convenio: "Unimed",
  anestesista_id: "a1", etapa: "agendado", destino: null, entrada_sala_em: null, inicio_cirurgia_em: null,
  fim_cirurgia_em: null, saida_sala_em: null, alta_rpa_em: null, aldrete_alta: null, cancelado_motivo: null,
  observacoes: null, ...extra,
});

test("o horário sai no fuso do serviço, e a duração em português", () => {
  assert.equal(horaDe(iso("2026-10-21", "07:35")), "07:35");
  assert.equal(horaDe("2026-10-21T02:10:00Z"), "23:10");
  assert.equal(horaDe(null), "");
  assert.equal(duracao(25), "25 min");
  assert.equal(duracao(65), "1h05");
  assert.equal(duracao(120), "2h");
  assert.equal(duracao(null), "");
});

test("o paciente anda pelas etapas, e cada passo grava só a sua hora", () => {
  assert.deepEqual(proximoPasso(caso()), { acao: "entrar", rotulo: "Entrou em sala" });
  assert.deepEqual(entrarEmSala("X"), { etapa: "em_sala", entrada_sala_em: "X" });
  assert.equal(proximoPasso(caso({ etapa: "em_sala" }))?.acao, "sair");
  assert.deepEqual(sairDaSala("Y", "rpa"), { etapa: "rpa", saida_sala_em: "Y", destino: null });
  // Da sala direto para a UTI: termina ali, sem passar pela RPA.
  assert.deepEqual(sairDaSala("Y", "uti"), { etapa: "concluido", saida_sala_em: "Y", destino: "uti" });
  assert.equal(proximoPasso(caso({ etapa: "rpa" }))?.rotulo, "Alta da RPA");
  assert.deepEqual(altaDaRpa("Z", 10, "quarto"), { etapa: "concluido", alta_rpa_em: "Z", aldrete_alta: 10, destino: "quarto" });
  assert.equal(proximoPasso(caso({ etapa: "concluido" })), null);
  assert.equal(proximoPasso(caso({ etapa: "cancelado" })), null);
  assert.deepEqual(cancelar("  Paciente sem jejum "), { etapa: "cancelado", cancelado_motivo: "Paciente sem jejum" });
});

test("desfazer volta um passo e apaga só a hora daquele passo", () => {
  const emSala = caso({ etapa: "em_sala", entrada_sala_em: "E" });
  assert.deepEqual(desfazer(emSala), { etapa: "agendado", entrada_sala_em: null });
  assert.equal(rotuloDoDesfazer(emSala), "Voltar para agendado");
  assert.deepEqual(desfazer(caso({ etapa: "rpa", entrada_sala_em: "E", saida_sala_em: "S" })), { etapa: "em_sala", saida_sala_em: null });
  const altaRpa = caso({ etapa: "concluido", entrada_sala_em: "E", saida_sala_em: "S", alta_rpa_em: "A", aldrete_alta: 10, destino: "quarto" });
  assert.deepEqual(desfazer(altaRpa), { etapa: "rpa", alta_rpa_em: null, aldrete_alta: null, destino: null });
  const uti = caso({ etapa: "concluido", entrada_sala_em: "E", saida_sala_em: "S", destino: "uti" });
  assert.deepEqual(desfazer(uti), { etapa: "em_sala", saida_sala_em: null, destino: null });
  assert.equal(rotuloDoDesfazer(uti), "Voltar para em sala");
  // O cancelamento desfeito devolve o paciente para onde ele estava.
  assert.deepEqual(desfazer(caso({ etapa: "cancelado", cancelado_motivo: "x" })), { etapa: "agendado", cancelado_motivo: null });
  assert.deepEqual(desfazer(caso({ etapa: "cancelado", entrada_sala_em: "E", cancelado_motivo: "x" })), { etapa: "em_sala", cancelado_motivo: null });
  assert.equal(desfazer(caso()), null);
});

test("o horário do passo não anda para trás nem passa de agora", () => {
  const agora = Date.parse("2026-10-21T10:00:00-03:00");
  const c = caso({ etapa: "em_sala", entrada_sala_em: iso("2026-10-21", "07:35") });
  assert.equal(conferirHorario(c, "sair", Date.parse("2026-10-21T09:10:00-03:00"), agora), null);
  assert.match(conferirHorario(c, "sair", Date.parse("2026-10-21T07:00:00-03:00"), agora) ?? "", /antes da entrada em sala \(07:35\)/);
  assert.match(conferirHorario(c, "sair", Date.parse("2026-10-21T11:00:00-03:00"), agora) ?? "", /depois de agora/);
  assert.equal(conferirHorario(c, "sair", NaN, agora), "Horário inválido.");
  const rpa = caso({ etapa: "rpa", entrada_sala_em: iso("2026-10-21", "07:35"), saida_sala_em: iso("2026-10-21", "09:10") });
  assert.match(conferirHorario(rpa, "alta", Date.parse("2026-10-21T09:00:00-03:00"), agora) ?? "", /antes da saída da sala \(09:10\)/);
});

test("a saída depois da meia-noite cai no dia seguinte", () => {
  const agora = Date.parse("2026-10-22T01:30:00-03:00");
  const c = caso({ etapa: "em_sala", entrada_sala_em: iso("2026-10-21", "23:10") });
  assert.equal(new Date(instanteDoPasso(c, "sair", "01:00", agora)).toISOString(), iso("2026-10-22", "01:00"));
  // Hora depois da entrada no mesmo dia continua no mesmo dia.
  assert.equal(new Date(instanteDoPasso(c, "sair", "23:50", agora)).toISOString(), iso("2026-10-21", "23:50"));
  // Entrada sem etapa anterior: o dia do mapa.
  assert.equal(new Date(instanteDoPasso(caso(), "entrar", "07:40", agora)).toISOString(), iso("2026-10-21", "07:40"));
});

test("tempo na etapa e tempos de sala e de RPA", () => {
  const agora = Date.parse("2026-10-21T08:47:00-03:00");
  assert.equal(tempoNaEtapa(caso({ etapa: "em_sala", entrada_sala_em: iso("2026-10-21", "07:35") }), agora), 72);
  assert.equal(tempoNaEtapa(caso(), agora), null);
  const t = tempos(caso({ entrada_sala_em: iso("2026-10-21", "07:35"), saida_sala_em: iso("2026-10-21", "09:10"), alta_rpa_em: iso("2026-10-21", "09:55") }));
  assert.deepEqual(t, { sala: 95, cirurgia: null, rpa: 45 });
});

test("Aldrete abaixo de 9 avisa, sem travar", () => {
  assert.equal(avisoDoAldrete(10), null);
  assert.equal(avisoDoAldrete(9), null);
  assert.match(avisoDoAldrete(8) ?? "", /Aldrete 8: abaixo de 9/);
  assert.equal(avisoDoAldrete(null), null);
});

test("o formulário exige só paciente, cirurgia e data, e limpa o resto", () => {
  const f = { ...formVazio("2026-10-21"), paciente: "  Maria   da Silva ", procedimento: "Hérnia inguinal", idade: "54", convenio: " " };
  const r = linhaDoForm(f);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.linha.paciente, "Maria da Silva");
    assert.equal(r.linha.idade, 54);
    assert.equal(r.linha.convenio, null);
    assert.equal(r.linha.sala_id, null);
    assert.equal(r.linha.horario, null);
  }
  assert.deepEqual(linhaDoForm({ ...f, paciente: " " }), { ok: false, erro: "Informe o nome do paciente." });
  assert.deepEqual(linhaDoForm({ ...f, procedimento: "" }), { ok: false, erro: "Informe a cirurgia." });
  assert.deepEqual(linhaDoForm({ ...f, idade: "200" }), { ok: false, erro: "Idade inválida." });
  assert.deepEqual(linhaDoForm({ ...f, horario: "7h" }), { ok: false, erro: "Horário inválido." });
});

test("o anestesista do horário vem da escala, e a madrugada é do plantão de ontem", () => {
  const escala = [
    { data: "2026-10-20", hora_inicio: "07:00:00", hora_fim: "07:00:00", perfil_id: "ontem" },
    { data: "2026-10-21", hora_inicio: "07:00:00", hora_fim: "07:00:00", perfil_id: "hoje" },
    { data: "2026-10-21", hora_inicio: "07:00:00", hora_fim: "13:00:00", perfil_id: "manha" },
    { data: "2026-10-21", hora_inicio: "13:00:00", hora_fim: "19:00:00", perfil_id: "tarde", situacao: "cancelado" },
  ];
  assert.deepEqual(anestesistasDePlantao(escala, "2026-10-21", "05:00"), ["ontem"]);
  assert.deepEqual(anestesistasDePlantao(escala, "2026-10-21", "08:00:00"), ["hoje", "manha"]);
  assert.deepEqual(anestesistasDePlantao(escala, "2026-10-21", "14:00"), ["hoje"]);
  // Sem horário: quem está no dia de trabalho, a partir das 7h.
  assert.deepEqual(anestesistasDePlantao(escala, "2026-10-21", null), ["hoje", "manha"]);
});

test("as colunas seguem as salas, e quem não tem sala fica no fim", () => {
  const salas = [
    { id: "s2", nome: "Sala 2", ordem: 2, ativa: true },
    { id: "s1", nome: "Sala 1", ordem: 1, ativa: true },
    { id: "s3", nome: "Sala 3", ordem: 3, ativa: false },
    { id: "s4", nome: "Sala 4", ordem: 4, ativa: false },
  ];
  const casos = [
    caso({ id: "a", sala_id: "s1", horario: "10:00:00" }),
    caso({ id: "b", sala_id: "s1", horario: "07:30:00" }),
    caso({ id: "c", sala_id: null }),
    caso({ id: "d", sala_id: "s3" }),
  ];
  const cols = colunasDoMapa(salas, casos);
  assert.deepEqual(cols.map((c) => c.sala?.nome ?? "Sem sala"), ["Sala 1", "Sala 2", "Sala 3", "Sem sala"]);
  assert.deepEqual(cols[0].casos.map((c) => c.id), ["b", "a"]);
  assert.deepEqual(ordenarCasos([caso({ id: "x", horario: null }), caso({ id: "y", horario: "09:00" })]).map((c) => c.id), ["y", "x"]);
});

test("o resumo do dia conta os atos por anestesista e por convênio, e aponta o que falta", () => {
  const casos = [
    caso({ id: "1", etapa: "concluido", entrada_sala_em: "E", anestesista_id: "a1", convenio: "Unimed" }),
    caso({ id: "2", etapa: "rpa", entrada_sala_em: "E", anestesista_id: "a1", convenio: "SUS" }),
    caso({ id: "3", etapa: "em_sala", entrada_sala_em: "E", anestesista_id: "a2", convenio: "Unimed" }),
    caso({ id: "4", etapa: "concluido", entrada_sala_em: "E", anestesista_id: null, convenio: null, paciente: "Sem dados" }),
    caso({ id: "5", etapa: "agendado" }),
    caso({ id: "6", etapa: "cancelado", cancelado_motivo: "Sem jejum" }),
  ];
  const nomes = new Map([["a1", "Dra. Ana"], ["a2", "Dr. Bruno"]]);
  const r = resumoDoDia(casos, (id) => nomes.get(id));
  assert.equal(r.atos, 4);
  assert.deepEqual(r.porAnestesista.map((l) => [l.nome, l.atos.length]), [["Dra. Ana", 2], ["Dr. Bruno", 1], ["Sem anestesista", 1]]);
  assert.deepEqual(r.porAnestesista[0].porConvenio, [{ convenio: "SUS", atos: 1 }, { convenio: "Unimed", atos: 1 }]);
  assert.deepEqual(r.porConvenio, [{ convenio: "Unimed", atos: 2 }, { convenio: "Sem convênio", atos: 1 }, { convenio: "SUS", atos: 1 }]);
  assert.deepEqual(r.pendencias, [{ casoId: "4", paciente: "Sem dados", falta: "Falta anestesista e convênio" }]);
  assert.equal(r.cancelados, 1);
  assert.equal(r.naoIniciados, 1);
  assert.deepEqual(contagemPorEtapa(casos), { agendado: 1, em_sala: 1, rpa: 1, concluido: 2, cancelado: 1 });
});
