import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * PLANTÃO NÃO É RECEITA DO SERVIÇO — e esta regra chegou aqui em dois passos.
 *
 * PRIMEIRO, o Financeiro do grupo somava até o plantão PRIVADO, aquele que a
 * escala promete que "entra só na sua escala e no seu mês — ninguém do grupo
 * enxerga". Ele aparecia lá com hospital e valor. Pior: a política de RLS
 * mostra a cada um o próprio privado, então dois administradores abriam o mesmo
 * mês e liam "A receber" diferentes — medido no banco, R$ 61.600 para o dono
 * dos plantões e R$ 42.900 para o colega, sem nada na tela explicando. A
 * correção de então foi filtrar `privado = false`.
 *
 * DEPOIS descobriu-se que o filtro tratava a doença errada. `privado` responde
 * a "aparece na escala do grupo?", e não a "o dinheiro é do grupo?". Quem
 * administra a escala lança os próprios plantões já visíveis para a equipe, e
 * por tabela eles viravam dinheiro do serviço: um Financeiro mostrava
 * R$ 3.600,00 de "faturado no mês" que eram os seis plantões de UMA pessoa,
 * enquanto a lista de lançamentos embaixo dizia "nenhum lançamento cadastrado".
 * O número e a lista discordavam porque mediam coisas diferentes.
 *
 * O plantão é pago pelo hospital a quem o fez. Ele saiu do Financeiro do grupo
 * e continua somando inteiro em Meu financeiro de cada um — que é onde essa
 * conta é verdadeira. A regra de hoje é mais forte que a de ontem: em vez de
 * escolher quais plantões entram, nenhum entra.
 */
const ler = (caminho: string) =>
  readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("o Financeiro do grupo não soma plantão", () => {
  const tela = ler("app/dashboard/dashboard-client.tsx");
  const bloco = tela.match(/const receitas=useMemo\(\(\)=>\{([^]*?)\},\[/);
  assert.ok(bloco, "não achei a montagem da receita do grupo");
  assert.ok(!/dePlantao/.test(bloco![1]),
    "o plantão voltou a entrar na receita do serviço");
  // As duas que o serviço de fato fatura continuam entrando.
  assert.match(bloco![1], /deConsulta/, "sumiu a consulta pré-anestésica");
  assert.match(bloco![1], /deProducao/, "sumiu a produção anestésica");
});

test("a página nem busca plantão para o Financeiro", () => {
  // Não basta parar de somar: buscar doze meses de plantão a cada abertura do
  // Financeiro é uma consulta cara para um dado que ninguém mais usa ali. E
  // enquanto o dado chegar à tela, alguém volta a somá-lo sem querer.
  assert.ok(!/plantoesDaReceita/.test(ler("app/dashboard/page.tsx")),
    "a consulta de plantões para o Financeiro voltou");
  assert.ok(!/plantoesDaReceita/.test(ler("app/dashboard/dashboard-client.tsx")),
    "sobrou encanamento de plantoesDaReceita na tela");
});

test("meu financeiro: continua trazendo os meus plantões, privados inclusive", () => {
  // A outra metade, e a que impede o remédio de virar doença: o plantão não
  // some do sistema. Se esta consulta cair, ele deixa de ser contado em lugar
  // NENHUM — o que é bem pior do que contá-lo no lugar errado.
  const meu = ler("components/meu-financeiro.tsx");
  const i = meu.indexOf('cliente.from("plantoes")');
  assert.notEqual(i, -1, "a consulta de Meu financeiro mudou de forma");
  const trecho = meu.slice(i, i + 400);
  assert.match(trecho, /\.eq\("perfil_id", perfilId\)/, "Meu financeiro é filtrado por pessoa");
  assert.doesNotMatch(trecho, /\.eq\("privado"/,
    "o privado é seu e tem de aparecer no seu financeiro");
  assert.match(meu, /dePlantao/, "o plantão precisa virar receita em Meu financeiro");
});
