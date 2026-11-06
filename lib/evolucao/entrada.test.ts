import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { avaliadosDeHoje, casaComONome, type AvaliacaoDoDia } from "./entrada.ts";

const ler = (c: string) => fs.readFileSync(new URL(`../../${c}`, import.meta.url), "utf8");

test("entrada: a busca do mapa casa todas as palavras, sem acento, em qualquer ordem", () => {
  assert.equal(casaComONome("JOÃO DA SILVA FICTÍCIO", "joao silva"), true);
  assert.equal(casaComONome("JOÃO DA SILVA FICTÍCIO", "silva jo"), true);
  assert.equal(casaComONome("João da Silva Fictício", "JOAO"), true);
  assert.equal(casaComONome("João da Silva Fictício", "maria"), false);
  assert.equal(casaComONome("João da Silva Fictício", "joao souza"), false, "todas as palavras, não qualquer uma");
  assert.equal(casaComONome("Qualquer", "   "), true, "sem nada escrito, todo mundo");
});

const paciente = (id: string, nome: string) => ({
  id, nome, data_nascimento: null, idade_anos: 40, sexo: null, convenio: null, hospital: null, cirurgia: null, procedimento: null,
});
const av = (patient_id: string, created_at: string, concluida_at: string | null = null, nome = "Paciente Fictício"): AvaliacaoDoDia => ({
  patient_id, created_at, concluida_at, cirurgia: " Endoscopia ", paciente: paciente(patient_id, nome),
});

test("entrada: os avaliados hoje, sem ficha, um por paciente, o mais recente primeiro", () => {
  // 06/11/2026 no fuso do serviço (UTC-3): de 03h00Z do dia 6 até 02h59Z do dia 7.
  const hoje = "2026-11-06";
  const lista = avaliadosDeHoje([
    av("a", "2026-11-06T11:00:00Z", "2026-11-06T11:20:00Z", "Ana Fictícia"),
    av("b", "2026-11-06T13:00:00Z", null, "Bruno Fictício"),
    av("a", "2026-11-06T09:00:00Z", null, "Ana Fictícia"),
    av("c", "2026-11-05T12:00:00Z", "2026-11-06T12:30:00Z", "Carla Fictícia"),
    av("d", "2026-11-06T02:30:00Z", null, "Davi Fictício"),
    av("e", "2026-11-06T14:00:00Z", "2026-11-06T14:10:00Z", "Eva Fictícia"),
    av("f", "2026-11-06T15:00:00Z", null, "Fábio Fictício"),
  ], { hoje, comFichaHoje: ["e"], noMapa: ["f"] });
  assert.deepEqual(lista.map((p) => p.id), ["b", "c", "a"], "d é de ontem à noite; e já tem ficha; f está no mapa");
  assert.deepEqual(lista[0].avaliacao, { em: "2026-11-06T13:00:00Z", rascunho: true, cirurgia: "Endoscopia" });
  assert.equal(lista[1].avaliacao?.rascunho, false, "começada ontem e concluída hoje entra");
  assert.equal(lista[2].nome, "Ana Fictícia");
  assert.equal(lista.every((p) => p.aberta === null), true);
  assert.equal(avaliadosDeHoje([av("x", "2026-11-06T13:00:00Z")], { hoje, comFichaHoje: [], limite: 0 }).length, 0);
});

test("entrada: em andamento primeiro, depois abrir e as encerradas; o mapa e os avaliados dentro da caixa de abrir", () => {
  const inicio = ler("app/evolucao/inicio-das-folhas.tsx");
  const [andamento, abrir, encerradas] = ["fcAndamento", "<NovaFolha", "fcEncerradas"].map((x) => inicio.indexOf(x));
  assert.ok(andamento > 0 && andamento < abrir && abrir < encerradas, "a ordem da pressa, também a do teclado");
  assert.match(inicio, /<NovaFolha institutionId=\{institutionId\} local=\{local\} mapa=\{mapa\} avaliadosHoje=\{avaliadosHoje\} \/>/);
  const nova = ler("app/evolucao/nova-folha.tsx");
  assert.match(nova, /<MapaDoDia[\s\S]*casos=\{doMapa\}/);
  assert.match(nova, /Avaliados hoje/);
  // O paciente nunca é ligado sozinho: a linha só abre direto com o cadastro sem dúvida (principalDoCaso).
  const mapa = ler("app/evolucao/mapa-do-dia.tsx");
  assert.match(mapa, /const p = c\.ficha \? null : c\.principal;/);
  assert.match(mapa, /if \(p\) void abrirCom\(c, p\);\s*else if \(c\.sugestoes\.length\) setEscolhendo/);
  assert.match(mapa, /Não é este paciente/);
});
