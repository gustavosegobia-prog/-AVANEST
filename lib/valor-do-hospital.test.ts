import test from "node:test";
import assert from "node:assert/strict";
import {
  botaoDeRepetir, chaveDoLocal, mesmoLocal, normalizarLocal, perguntaDeRepetir,
  ultimoValorNoLocal,
  zeradosNoMesmoLocal, type PlantaoComValor,
} from "./valor-do-hospital.ts";

const p = (extra: Partial<PlantaoComValor> & { id: string }): PlantaoComValor => ({
  data: "2026-09-01", valor: 0, local_id: null, local_texto: null,
  situacao: "escalado", ...extra,
});

const CIANORTE = "11111111-1111-1111-1111-111111111111";
const SANTA_CASA = "22222222-2222-2222-2222-222222222222";

test("o mesmo hospital cadastrado é reconhecido pelo id", () => {
  assert.equal(mesmoLocal(p({ id: "a", local_id: CIANORTE }),
                          p({ id: "b", local_id: CIANORTE })), true);
  assert.equal(mesmoLocal(p({ id: "a", local_id: CIANORTE }),
                          p({ id: "b", local_id: SANTA_CASA })), false);
});

test("o hospital digitado à mão é reconhecido apesar de acento e caixa", () => {
  // É quem MAIS digita valor repetido: não tem modelo salvo, então lança tudo
  // na mão. Comparar só por `local_id` deixaria justamente essa pessoa de fora.
  assert.equal(mesmoLocal(p({ id: "a", local_texto: "Hospital São José" }),
                          p({ id: "b", local_texto: "hospital sao jose" })), true);
  assert.equal(mesmoLocal(p({ id: "a", local_texto: "Cianorte" }),
                          p({ id: "b", local_texto: "  CIANORTE  " })), true);
  assert.equal(mesmoLocal(p({ id: "a", local_texto: "Cianorte" }),
                          p({ id: "b", local_texto: "Campo Mourão" })), false);
});

test("sem local dos dois lados NÃO é o mesmo hospital", () => {
  // "Plantão sem local" não é um hospital, é a ausência de um. Tratar a
  // ausência como identidade faria o valor da sedação no consultório vazar
  // para o plantão do hospital que ninguém cadastrou ainda.
  assert.equal(mesmoLocal(p({ id: "a" }), p({ id: "b" })), false);
  assert.equal(chaveDoLocal(p({ id: "a" })), "");
});

test("id manda sobre texto", () => {
  // Um plantão cadastrado e um digitado à mão com o mesmo nome não se
  // confundem: o cadastrado tem identidade própria.
  assert.equal(mesmoLocal(p({ id: "a", local_id: CIANORTE }),
                          p({ id: "b", local_texto: "Cianorte" })), false);
});

test("o valor novo vem do último plantão naquele hospital", () => {
  const historico = [
    p({ id: "1", local_id: CIANORTE, data: "2026-07-10", valor: 1000 }),
    p({ id: "2", local_id: CIANORTE, data: "2026-08-20", valor: 1200 }),
    p({ id: "3", local_id: SANTA_CASA, data: "2026-09-01", valor: 800 }),
  ];
  assert.equal(ultimoValorNoLocal(historico, p({ id: "n", local_id: CIANORTE })), 1200);
  assert.equal(ultimoValorNoLocal(historico, p({ id: "n", local_id: SANTA_CASA })), 800);
});

test("o MAIS RECENTE, e não a média nem o mais frequente", () => {
  // Valor de plantão sobe. A média de doze meses devolveria o preço do ano
  // passado justamente para quem acabou de renegociar.
  const historico = [
    p({ id: "1", local_id: CIANORTE, data: "2026-01-10", valor: 900 }),
    p({ id: "2", local_id: CIANORTE, data: "2026-02-10", valor: 900 }),
    p({ id: "3", local_id: CIANORTE, data: "2026-03-10", valor: 900 }),
    p({ id: "4", local_id: CIANORTE, data: "2026-09-10", valor: 1500 }),
  ];
  assert.equal(ultimoValorNoLocal(historico, p({ id: "n", local_id: CIANORTE })), 1500);
});

test("plantão zerado não ensina nada sobre quanto o hospital paga", () => {
  const historico = [
    p({ id: "1", local_id: CIANORTE, data: "2026-08-01", valor: 1200 }),
    p({ id: "2", local_id: CIANORTE, data: "2026-09-01", valor: 0 }),
  ];
  assert.equal(ultimoValorNoLocal(historico, p({ id: "n", local_id: CIANORTE })), 1200);
});

test("plantão cancelado não conta", () => {
  const historico = [
    p({ id: "1", local_id: CIANORTE, data: "2026-08-01", valor: 1000 }),
    p({ id: "2", local_id: CIANORTE, data: "2026-09-01", valor: 9999, situacao: "cancelado" }),
  ];
  assert.equal(ultimoValorNoLocal(historico, p({ id: "n", local_id: CIANORTE })), 1000);
});

test("sem histórico devolve zero, que é o que o sistema já fazia", () => {
  assert.equal(ultimoValorNoLocal([], p({ id: "n", local_id: CIANORTE })), 0);
  assert.equal(ultimoValorNoLocal(
    [p({ id: "1", local_id: SANTA_CASA, valor: 500 })],
    p({ id: "n", local_id: CIANORTE })), 0);
});

test("a resposta não depende da ordem em que o banco devolveu", () => {
  const mesmaData = [
    p({ id: "b", local_id: CIANORTE, data: "2026-09-01", valor: 200 }),
    p({ id: "a", local_id: CIANORTE, data: "2026-09-01", valor: 100 }),
  ];
  assert.equal(ultimoValorNoLocal(mesmaData, p({ id: "n", local_id: CIANORTE })), 200);
  assert.equal(ultimoValorNoLocal([...mesmaData].reverse(),
    p({ id: "n", local_id: CIANORTE })), 200);
});

test("aplicar a todos pega SÓ os zerados do mesmo hospital", () => {
  // Os seis plantões de Cianorte do exemplo: um preenchido e cinco em zero.
  const mes = [
    p({ id: "origem", local_id: CIANORTE, valor: 1200 }),
    p({ id: "z1", local_id: CIANORTE, valor: 0 }),
    p({ id: "z2", local_id: CIANORTE, valor: 0 }),
    p({ id: "outroHospital", local_id: SANTA_CASA, valor: 0 }),
  ];
  const alvos = zeradosNoMesmoLocal(mes, mes[0]);
  assert.deepEqual(alvos.map((x) => x.id), ["z1", "z2"]);
});

test("valor já digitado NUNCA é sobrescrito", () => {
  // É a decisão que você tomou: um plantão de feriado que valeu mais, uma
  // diária negociada. Dinheiro sobrescrito em silêncio só aparece no
  // fechamento do mês, quando já virou nota emitida.
  const mes = [
    p({ id: "origem", local_id: CIANORTE, valor: 1200 }),
    p({ id: "feriado", local_id: CIANORTE, valor: 1800 }),
    p({ id: "zerado", local_id: CIANORTE, valor: 0 }),
  ];
  const alvos = zeradosNoMesmoLocal(mes, mes[0]);
  assert.deepEqual(alvos.map((x) => x.id), ["zerado"]);
  assert.ok(!alvos.some((x) => x.id === "feriado"), "o feriado de R$ 1.800 tem de sobreviver");
});

test("cancelado fica de fora do aplicar a todos", () => {
  const mes = [
    p({ id: "origem", local_id: CIANORTE, valor: 1200 }),
    p({ id: "morto", local_id: CIANORTE, valor: 0, situacao: "cancelado" }),
  ];
  assert.deepEqual(zeradosNoMesmoLocal(mes, mes[0]), []);
});

test("sem outros zerados, não há o que oferecer", () => {
  const mes = [p({ id: "origem", local_id: CIANORTE, valor: 1200 })];
  assert.deepEqual(zeradosNoMesmoLocal(mes, mes[0]), []);
});

test("a pergunta diz quantos e onde; o botão diz o valor", () => {
  // O CONTEXTO VAI NA PERGUNTA. Com tudo no botão, no telefone ele virava uma
  // frase de três linhas cortada pela altura fixa do botão — a pessoa lia "aos
  // outros 5 plantões do HOSPITAL SANTA" e o resto sumia.
  assert.equal(perguntaDeRepetir(5, "Santa Casa"),
    "Repetir nos outros 5 plantões do Santa Casa?");
  assert.equal(perguntaDeRepetir(1, "Cianorte"),
    "Repetir no outro plantão do Cianorte?");
  assert.equal(perguntaDeRepetir(2, ""),
    "Repetir nos outros 2 plantões do mesmo local?");
});

test("o botão cabe numa linha", () => {
  // O espaço depois do "R$" é INSEPARÁVEL (U+00A0) — é o que `toLocaleString`
  // produz em pt-BR. Comparar com espaço comum reprova um texto que está certo;
  // foi o que aconteceu na primeira execução, e é a segunda vez no projeto
  // (ver lib/nota-do-contador.test.ts).
  const comum = (t: string) => t.replace(/\u00A0/g, " ");
  assert.equal(comum(botaoDeRepetir(1200)), "Aplicar R$ 1.200,00");
  assert.equal(comum(botaoDeRepetir(800)), "Aplicar R$ 800,00");
  assert.ok(botaoDeRepetir(1200).length <= 22, "o botão tem de caber numa linha no telefone");
});

test("normalizar não engole o nome inteiro", () => {
  assert.equal(normalizarLocal("Santa Casa"), "santa casa");
  assert.equal(normalizarLocal(null), "");
  assert.equal(normalizarLocal("   "), "");
});
