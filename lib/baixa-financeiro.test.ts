import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * ONDE SE DÁ BAIXA.
 *
 * A escala responde "isto aconteceu?"; o Meu financeiro responde "isto
 * entrou?". Estavam no mesmo lugar, e o resultado era procurar um depósito na
 * tela dos turnos — que é onde ninguém vai quando quer conferir dinheiro.
 *
 * Estes testes leem os arquivos que vão para produção, e não uma cópia da
 * regra: uma regra copiada para o teste continua passando depois de o código
 * mudar, que é o contrário do que ela existe para fazer.
 */
const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("a escala não marca mais pagamento", () => {
  const escala = ler("components/plantoes.tsx");
  assert.ok(!/async function marcarRecebido/.test(escala),
    "`marcarRecebido` voltou para a escala");
  // O seletor de situação da escala não oferece "Pago" para quem ainda não
  // está pago: receber não é uma coisa que acontece com o turno.
  assert.ok(!/^\s*<option value="pago">Pago<\/option>/m.test(escala),
    "a opção Pago voltou a ser oferecida sem condição no seletor da escala");
  // E nada mais nessa tela escreve a situação "pago" no banco.
  assert.ok(!/situacao:\s*"pago"/.test(escala),
    "a escala voltou a gravar situacao: \"pago\"");
});

test("a baixa está no Meu financeiro, e grava a data junto", () => {
  const financeiro = ler("components/meu-financeiro.tsx");
  assert.ok(/async function darBaixa/.test(financeiro), "sumiu a função de dar baixa");
  // A DATA VAI JUNTO COM A SITUAÇÃO, e é isto que o teste guarda. Um plantão
  // "pago" sem `pago_em` é um plantão que o fechamento do mês não consegue
  // somar no mês certo — e o defeito só apareceria no fechamento, meses depois.
  const gravacao = financeiro.match(/situacao:\s*"pago"[^}]*}/);
  assert.ok(gravacao, "não achei a gravação do pagamento");
  assert.ok(/pago_em:\s*dataDaBaixa/.test(gravacao![0]),
    `a data do depósito não vai junto: ${gravacao![0]}`);
  // E desfazer limpa a data, senão sobra um pagamento sem pagamento.
  assert.ok(/situacao:\s*"realizado",\s*pago_em:\s*null/.test(financeiro),
    "desfazer a baixa tem de limpar pago_em");
});

test("a tela manda a pessoa para onde a ação de fato está", () => {
  // O aviso do "a receber" apontava para a Escala. Um aviso que aponta para o
  // lugar errado é pior do que nenhum: manda procurar e não achar.
  const financeiro = ler("components/meu-financeiro.tsx");
  const aviso = financeiro.match(/já é seu: o trabalho está[^]*?<\/p>}/);
  assert.ok(aviso, "não achei o aviso do que há a receber");
  assert.ok(!/Minha escala/.test(aviso![0]),
    "o aviso ainda manda dar baixa na escala");
  assert.ok(/Plantões por local/.test(aviso![0]),
    "o aviso precisa dizer onde a baixa está");
});
