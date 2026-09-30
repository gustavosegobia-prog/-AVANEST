import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** A ÁREA MÉDICA — ligações da tela e o que não pode voltar. */
const ler = (c: string) => readFileSync(new URL(`../${c}`, import.meta.url), "utf8");
const tela = ler("components/area-medica.tsx");
const painel = ler("app/dashboard/dashboard-client.tsx");
const form = ler("app/avaliacoes/[id]/assessment-form.tsx");

test("entrada: Área médica, local e data, Nova avaliação e as quatro seções", () => {
  assert.match(tela, /<h1>Área médica<\/h1>/);
  assert.match(tela, /\["agenda", "Meu dia"[\s\S]*\["avaliacoes", "Avaliações"[\s\S]*\["pendencias", "Pendências"[\s\S]*\["documentos", "Documentos"/);
  assert.doesNotMatch(painel, /Consultas pré-anestésicas agendadas/);
  assert.doesNotMatch(painel, /Documentos mais recentes/, "o atalho desabilitado sem explicação voltou");
});

test("pendências verificadas separadas de lembretes e do que não é registrado", () => {
  assert.match(tela, /aria-label="Pendências verificadas"/);
  assert.match(tela, /aria-label="Lembretes gerais"/);
  assert.match(tela, /aria-label="Informações indisponíveis"/);
  assert.match(tela, /Nenhuma pendência nos registros deste escopo\./);
  assert.doesNotMatch(tela + painel, /orientacoes_enviadas/, "o envio não é registrado: não pode virar contagem");
  assert.doesNotMatch(painel, /action="ENVIAR"/);
});

test("várias avaliações para retomar aparecem em lista, com local, datas e Continuar", () => {
  assert.match(tela, /retomar\.map\(\(a\) =>/);
  assert.match(tela, /Outro local: /);
  assert.match(tela, /Iniciada em \{momentoBr\(a\.created_at\)\} · última alteração \{momentoBr\(a\.updated_at\)\}/);
});

test("sem CPF completo nem horário inventado na listagem", () => {
  assert.match(tela, /cpfMascarado\(p\?\.cpf\)/);
  assert.doesNotMatch(tela, /\{p\??\.cpf\}/);
  assert.doesNotMatch(tela + painel, /8 ?\+ ?index/);
});

test("abrir avaliação não duplica, e consulta nova de paciente antigo começa nova versão", () => {
  assert.match(painel, /if \(abrindoRef\.current\) return;/);
  assert.match(painel, /existing\.status === "concluida" && !\(appointmentId && !assessmentId\)/);
});

test("salvamento: sessão expirada e conexão caída ditas como tal; sair com alteração pergunta", () => {
  assert.match(form, /Sua sessão expirou\./);
  assert.match(form, /Sem conexão com a internet\./);
  assert.match(form, /window\.addEventListener\("beforeunload", aoSair\)/);
  assert.match(form, /\.eq\("lock_version",expectedLockVersion\)/, "o controle de versão contra sobrescrita sumiu");
});

test("falha de carregamento vira aviso, e não lista vazia", () => {
  assert.match(ler("app/dashboard/page.tsx"), /falhasDeCarga=\{\[erroAvaliacoes \? "as avaliações" : null, erroAgendamentos \? "a agenda" : null\]/);
  assert.match(tela, /Não foi possível carregar \{falhasDeCarga\.join\(" e "\)\} agora/);
});
