import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DIAS_DE_TESTE, DIAS_PARA_AVISAR, dataPorExtenso, diasQueFaltam, estadoDoTeste, fimDoTeste,
  fraseDoTeste,
} from "./teste-gratis.ts";

const em = (iso: string) => new Date(`${iso}T12:00:00Z`);

test("o teste vai até o fim do 15º dia depois do cadastro", () => {
  // 15 dias grátis desde 27/10/2026. O dia do cadastro não conta: quem entra
  // às 22h não perde o dia.
  assert.equal(DIAS_DE_TESTE, 15);
  assert.equal(fimDoTeste(em("2026-10-28")).toISOString().slice(0, 10), "2026-11-12");
  assert.equal(fimDoTeste(em("2026-10-01")).toISOString().slice(0, 10), "2026-10-16");
});

test("ninguém recebe menos do que a frase promete", () => {
  // "15 dias grátis" tem de ser verdade para quem entra em qualquer dia, e a
  // qualquer hora.
  for (const quando of ["2026-10-01T00:00:01Z", "2026-10-15T12:00:00Z", "2026-10-31T23:59:00Z"]) {
    const entrada = new Date(quando);
    const dias = (fimDoTeste(entrada).getTime() - entrada.getTime()) / 86_400_000;
    assert.ok(dias >= 15, `entrando em ${quando} sobram só ${dias.toFixed(1)} dias`);
  }
});

test("a virada de mês e de ano e o fevereiro curto não quebram a conta", () => {
  assert.equal(fimDoTeste(em("2026-12-20")).toISOString().slice(0, 10), "2027-01-04");
  assert.equal(fimDoTeste(em("2027-02-20")).toISOString().slice(0, 10), "2027-03-07");
  assert.equal(fimDoTeste(em("2028-02-20")).toISOString().slice(0, 10), "2028-03-06");
});

test("o teste vale até o fim do último dia, e não até a meia-noite dele", () => {
  // Com a meia-noite, quem abrisse às nove da manhã do último dia encontraria
  // a conta vencida — um dia a menos do que o combinado, e justamente no dia
  // em que a pessoa está decidindo se assina.
  const fim = fimDoTeste(em("2026-10-28"));
  assert.equal(estadoDoTeste(fim, new Date("2026-11-12T09:00:00Z")).fase, "acabando");
  assert.equal(estadoDoTeste(fim, new Date("2026-11-13T00:00:01Z")).fase, "acabou");
});

test("o banco conta o mesmo prazo da tela", () => {
  // `fim_do_teste_gratis()` data o teste de quem se cadastra (criar_organizacao
  // e o gatilho protege_assinatura); se a conta dela e a de fimDoTeste se
  // separarem, a tela promete um dia e a cobrança vence em outro.
  const migracao = readFileSync("supabase/migrations/202610280002_teste_de_15_dias.sql", "utf8");
  const m = /date_trunc\('day', a_partir_de\) \+ interval '(\d+) days' - interval '1 microsecond'/.exec(migracao);
  assert.ok(m, "a conta da função mudou de forma");
  assert.equal(Number(m![1]), DIAS_DE_TESTE + 1, "o banco e lib/teste-gratis.ts discordam do prazo");
});

test("os dias que faltam arredondam para cima", () => {
  // Faltando trinta horas a pessoa lê "faltam 2 dias", e não "falta 1".
  const ate = new Date("2026-11-30T23:59:59Z");
  assert.equal(diasQueFaltam(ate, new Date("2026-11-29T18:00:00Z")), 2);
  assert.equal(diasQueFaltam(ate, new Date("2026-11-30T18:00:00Z")), 1);
  assert.equal(diasQueFaltam(ate, new Date("2026-12-05T00:00:00Z")), 0);
});

test("a tela só começa a falar a cinco dias do fim", () => {
  // Avisar no último dia não é avisar, é cobrar; avisar desde o primeiro dia
  // de um teste de quinze é ruído.
  assert.equal(DIAS_PARA_AVISAR, 5);
  const ate = new Date("2026-11-30T23:59:59Z");
  assert.equal(estadoDoTeste(ate, new Date("2026-10-01T12:00:00Z")).fase, "correndo");
  const naBorda = new Date(ate.getTime() - DIAS_PARA_AVISAR * 86_400_000 + 3_600_000);
  assert.equal(estadoDoTeste(ate, naBorda).fase, "acabando");
});

test("a frase muda de tom, e nunca implora", () => {
  const ate = new Date("2026-11-30T23:59:59Z");
  const cedo = fraseDoTeste(estadoDoTeste(ate, new Date("2026-10-01T12:00:00Z")), ate);
  assert.match(cedo, /Sem cartão/);
  assert.ok(!/Assine/.test(cedo), "no começo a faixa informa, não cobra");

  const perto = fraseDoTeste(estadoDoTeste(ate, new Date("2026-11-27T12:00:00Z")), ate);
  assert.match(perto, /Faltam \d+ dias/);
  assert.match(perto, /Assine para continuar/);

  // Quem chega ao fim precisa ouvir que NÃO perdeu nada — é o que decide se a
  // pessoa volta ou se conta para os colegas que o sistema apagou o trabalho.
  const fim = fraseDoTeste(estadoDoTeste(ate, new Date("2026-12-10T12:00:00Z")), ate);
  assert.match(fim, /Seus dados continuam aqui/);
});

test("um dia no singular", () => {
  const ate = new Date("2026-11-30T23:59:59Z");
  assert.match(fraseDoTeste(estadoDoTeste(ate, new Date("2026-11-30T10:00:00Z")), ate),
    /^Falta 1 dia/);
});

test("a data sai por extenso, no fuso da data e não do leitor", () => {
  assert.equal(dataPorExtenso(new Date("2026-11-30T23:59:59Z")), "30 de novembro de 2026");
});
