import test from "node:test";
import assert from "node:assert/strict";
import type { Caso, Sala } from "./centro-cirurgico.ts";
import {
  diasDoMes, estatistica, faixaDeTempo, mesValido, mesVizinho, nomeDoMes, planilhaDoRelatorio, relatorioDoMes,
} from "./centro-relatorio.ts";

// Pacientes, cirurgiões e anestesistas fictícios.
const t = (data: string, h: string) => new Date(`${data}T${h}:00-03:00`).toISOString();
const base = {
  sala_id: null, ordem: null, horario: null, idade: null, prontuario: null, cirurgiao: null, convenio: null, anestesista_id: null,
  destino: null, entrada_sala_em: null, inicio_cirurgia_em: null, fim_cirurgia_em: null, saida_sala_em: null, alta_rpa_em: null,
  aldrete_alta: null, cancelado_motivo: null, observacoes: null,
} as const;
const caso = (id: string, data: string, resto: Partial<Caso>): Caso =>
  ({ ...base, id, data, paciente: `Paciente ${id}`, procedimento: "Cirurgia", etapa: "agendado", ...resto });

const SALAS: Sala[] = [
  { id: "s2", nome: "Sala 2", ordem: 2, ativa: true },
  { id: "s1", nome: "Sala 1", ordem: 1, ativa: true },
];
const CASOS: Caso[] = [
  // Da sala para a RPA e alta: 60 min em sala, 40 na RPA.
  caso("a", "2026-10-01", { sala_id: "s1", ordem: 1, horario: "07:30", cirurgiao: "DR. DANILO", convenio: "SUS", anestesista_id: "an1",
    etapa: "concluido", entrada_sala_em: t("2026-10-01", "07:30"), saida_sala_em: t("2026-10-01", "08:30"),
    alta_rpa_em: t("2026-10-01", "09:10"), destino: "quarto" }),
  // Da sala direto para a UTI: 120 min em sala, sem RPA.
  caso("b", "2026-10-01", { sala_id: "s2", ordem: 2, cirurgiao: "Dr Danilo", convenio: "Unimed", anestesista_id: "an2",
    etapa: "concluido", entrada_sala_em: t("2026-10-01", "08:00"), saida_sala_em: t("2026-10-01", "10:00"), destino: "uti" }),
  // Ficou "em sala": faltou o toque da saída.
  caso("c", "2026-10-02", { sala_id: "s1", ordem: 1, cirurgiao: "DR. RAFAEL", convenio: "SUS", anestesista_id: "an1",
    etapa: "em_sala", entrada_sala_em: t("2026-10-02", "09:00") }),
  // Ficou na RPA: faltou a alta.
  caso("d", "2026-10-02", { sala_id: "s1", ordem: 2, cirurgiao: "DR. RAFAEL", convenio: "UNIMED",
    etapa: "rpa", entrada_sala_em: t("2026-10-02", "10:00"), saida_sala_em: t("2026-10-02", "10:30") }),
  caso("e", "2026-10-03", { sala_id: "s2", etapa: "cancelado", cancelado_motivo: "Paciente sem jejum" }),
  caso("f", "2026-10-05", { sala_id: "s2" }),
  caso("g", "2026-10-20", { sala_id: "s2" }),
  // De outro mês: fica fora.
  caso("h", "2026-09-30", { etapa: "concluido", entrada_sala_em: t("2026-09-30", "07:00"), saida_sala_em: t("2026-09-30", "08:00") }),
];
const NOMES: Record<string, string> = { an1: "Dra. Ana Lima", an2: "Dr. Bruno Costa" };
const r = relatorioDoMes({ mes: "2026-10", hoje: "2026-10-10", casos: CASOS, salas: SALAS, nomeDoAnestesista: (id) => NOMES[id] });

test("o mês: dias, vizinhos, nome", () => {
  assert.equal(diasDoMes("2026-10").length, 31);
  assert.equal(diasDoMes("2026-02").length, 28);
  assert.equal(diasDoMes("2028-02").at(-1), "2028-02-29");
  assert.equal(mesVizinho("2026-01", -1), "2025-12");
  assert.equal(mesVizinho("2026-12", 1), "2027-01");
  assert.equal(nomeDoMes("2026-10"), "outubro de 2026");
  assert.ok(mesValido("2026-10") && !mesValido("2026-13") && !mesValido("10/2026") && !mesValido(undefined));
});

test("média, mais curto e mais longo, sem contar o que falta", () => {
  assert.deepEqual(estatistica([60, null, 30, 121]), { n: 3, media: 70, menor: 30, maior: 121 });
  assert.deepEqual(estatistica([null]), { n: 0, media: null, menor: null, maior: null });
  assert.equal(faixaDeTempo(estatistica([25, 65])), "25 min a 1h05");
});

test("o relatório do mês: feitas, canceladas e o que ficou sem registro", () => {
  assert.equal(r.feitas, 4);
  assert.equal(r.canceladas, 1);
  assert.equal(r.semRegistro, 1, "o agendado do dia 5, que já passou");
  assert.equal(r.aindaAgendados, 1, "o do dia 20");
  assert.equal(r.incompletas, 2);
  assert.equal(r.diretoUti, 1);
  assert.deepEqual(r.linhas.map((l) => [l.caso.id, l.emSala, l.naRpa, l.falta]), [
    ["a", 60, 40, []],
    ["b", 120, null, []],
    ["c", null, null, ["saída da sala"]],
    ["d", 30, null, ["alta da RPA"]],
  ]);
});

test("os tempos: em sala da entrada à saída, RPA da saída à alta; a UTI direta não entra na RPA", () => {
  assert.deepEqual(r.emSala, { n: 3, media: 70, menor: 30, maior: 120 });
  assert.deepEqual(r.naRpa, { n: 1, media: 40, menor: 40, maior: 40 });
});

test("por dia, sala, cirurgião, convênio e anestesista", () => {
  assert.equal(r.porDia.length, 31);
  assert.deepEqual(r.porDia.slice(0, 3).map((d) => d.n), [2, 2, 0]);
  assert.deepEqual(r.porSala.map((g) => [g.nome, g.n]), [["Sala 1", 3], ["Sala 2", 1]], "na ordem das salas");
  assert.deepEqual(r.porCirurgiao.map((g) => [g.nome, g.n, g.emSala.media]), [["DR. DANILO", 2, 90], ["DR. RAFAEL", 2, 30]],
    "“DR. DANILO” e “Dr Danilo” são o mesmo");
  assert.deepEqual(r.porConvenio, [{ convenio: "SUS", atos: 2 }, { convenio: "Unimed", atos: 2 }]);
  assert.deepEqual(r.porAnestesista, [{ nome: "Dra. Ana Lima", n: 2 }, { nome: "Dr. Bruno Costa", n: 1 }, { nome: "Sem anestesista", n: 1 }]);
  assert.deepEqual(r.motivos, [{ motivo: "Paciente sem jejum", n: 1 }]);
});

test("a planilha: uma linha por paciente, cancelado no dia dele, minutos como número", () => {
  const p = planilhaDoRelatorio(r);
  assert.equal(p[0][0], "Data");
  assert.equal(p.length, 1 + 4 + 1);
  assert.deepEqual(p.slice(1).map((l) => [l[0], l[3], l[11], l[13], l[15]]), [
    ["01/10/2026", "Paciente a", 60, 40, "Feita"],
    ["01/10/2026", "Paciente b", 120, "", "Feita"],
    ["02/10/2026", "Paciente c", "", "", "Feita, sem horário de saída da sala"],
    ["02/10/2026", "Paciente d", 30, "", "Feita, sem horário de alta da RPA"],
    ["03/10/2026", "Paciente e", "", "", "Cancelada: Paciente sem jejum"],
  ]);
  assert.deepEqual([p[1][9], p[1][10], p[1][12], p[1][14]], ["07:30", "08:30", "09:10", "Quarto / enfermaria"]);
  assert.equal(p[2][14], "UTI");
});
