import test from "node:test";
import assert from "node:assert/strict";
import {
  DIAS_PARA_AVISAR, dataPorExtenso, diasQueFaltam, estadoDoTeste, fimDoTeste,
  fraseDoTeste,
} from "./teste-gratis.ts";

const em = (iso: string) => new Date(`${iso}T12:00:00Z`);

test("quem entra no dia 28 vive dois fechamentos inteiros", () => {
  // É a razão de contar por mês fechado e não por 60 dias corridos: sessenta
  // dias contados de 28/09 entregariam DOIS dias de setembro, e quem entrasse
  // no fim do mês conheceria metade do produto de quem entrou no dia 1º.
  assert.equal(fimDoTeste(em("2026-09-28")).toISOString().slice(0, 10), "2026-11-30");
  assert.equal(fimDoTeste(em("2026-09-01")).toISOString().slice(0, 10), "2026-11-30");
});

test("ninguém recebe menos do que a frase promete", () => {
  // "Dois meses grátis" tem de ser verdade para quem entra em qualquer dia.
  for (const dia of ["01", "10", "15", "28", "30"]) {
    const entrada = em(`2026-09-${dia}`);
    const fim = fimDoTeste(entrada);
    const dias = (fim.getTime() - entrada.getTime()) / 86_400_000;
    assert.ok(dias >= 60, `entrando em 2026-09-${dia} sobram só ${dias.toFixed(0)} dias`);
  }
});

test("a virada de ano e o mês curto não quebram a conta", () => {
  // Dezembro + 2 = fevereiro do ano seguinte, e fevereiro muda de tamanho.
  assert.equal(fimDoTeste(em("2026-12-15")).toISOString().slice(0, 10), "2027-02-28");
  assert.equal(fimDoTeste(em("2027-12-15")).toISOString().slice(0, 10), "2028-02-29");
  assert.equal(fimDoTeste(em("2026-11-30")).toISOString().slice(0, 10), "2027-01-31");
});

test("o teste vale até o fim do último dia, e não até a meia-noite dele", () => {
  // Com a meia-noite, quem abrisse às nove da manhã do último dia encontraria
  // a conta vencida — um dia a menos do que o combinado, e justamente no dia
  // em que a pessoa está decidindo se assina.
  const fim = fimDoTeste(em("2026-09-15"));
  assert.equal(estadoDoTeste(fim, new Date("2026-11-30T09:00:00Z")).fase, "acabando");
  assert.equal(estadoDoTeste(fim, new Date("2026-12-01T00:00:01Z")).fase, "acabou");
});

test("os dias que faltam arredondam para cima", () => {
  // Faltando trinta horas a pessoa lê "faltam 2 dias", e não "falta 1".
  const ate = new Date("2026-11-30T23:59:59Z");
  assert.equal(diasQueFaltam(ate, new Date("2026-11-29T18:00:00Z")), 2);
  assert.equal(diasQueFaltam(ate, new Date("2026-11-30T18:00:00Z")), 1);
  assert.equal(diasQueFaltam(ate, new Date("2026-12-05T00:00:00Z")), 0);
});

test("a tela só começa a falar a quinze dias do fim", () => {
  // Avisar no último dia não é avisar, é cobrar. Quinze dias é o tempo de
  // falar com o contador, olhar o preço e decidir sem pressa.
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

  const perto = fraseDoTeste(estadoDoTeste(ate, new Date("2026-11-25T12:00:00Z")), ate);
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
