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

test("o gráfico do ano fala por cor, e não por uma faixa de texto", () => {
  // Havia um aviso explicando o que era o "a receber" e onde dar baixa. Saiu:
  // o gráfico diz a mesma coisa em cor, e a ação está a um palmo dali. Faixa de
  // texto para explicar o que já se lê de relance é ruído entre a pessoa e o
  // que ela veio fazer.
  const financeiro = ler("components/meu-financeiro.tsx");
  assert.ok(!/financeNota aReceber/.test(financeiro),
    "a faixa de aviso do a-receber voltou");
  // As quatro faixas do gráfico, e a legenda que as nomeia.
  for (const faixa of ["mfRecebido", "mfAReceber", "mfAtrasado", "mfPrevisto"])
    assert.ok(financeiro.includes(faixa), `faltou a faixa ${faixa} no gráfico`);
});

test("o vermelho é reservado para o que está de fato parado", () => {
  // Plantão de semana que vem não é problema nenhum. Pintar o futuro de
  // vermelho faria todo mês adiante parecer atrasado, e um alarme que toca
  // sempre é um alarme que ninguém olha.
  const css = ler("app/globals.css");
  const previsto = css.match(/\.mfPrevisto\{([^}]*)\}/);
  assert.ok(previsto, "não achei a faixa do previsto");
  assert.ok(!/perigo|atencao/.test(previsto![1]),
    `o previsto está pintado de alerta: ${previsto![1]}`);
  assert.match(css, /\.mfAtrasado\{background:var\(--cor-perigo\)\}/);
  assert.match(css, /\.mfRecebido\{background:var\(--cor-sucesso\)\}/);
});

test("no tema escuro os números do resumo continuam coloridos", () => {
  // ISTO JÁ ESTAVA QUEBRADO, e não dava para ver compilando: lá em cima do
  // globals.css existe `.clinicalDark b{color:...}`, com DUAS partes de
  // seletor. Uma classe sozinha como `.mfVerde` tem uma só — e especificidade
  // maior vence posição no arquivo, então não adiantava a regra da cor vir
  // depois. No escuro, verde, âmbar, vermelho e cinza saíam todos brancos.
  const css = ler("app/globals.css");
  assert.match(css, /\.clinicalDark b\{color:var\(--cor-tinta\)\}|\.clinicalDark b\{/,
    "sumiu a regra que causa o conflito — reveja este teste");
  for (const [classe, token] of [
    ["mfVerde", "--cor-sucesso"], ["mfAmbar", "--cor-atencao"],
    ["mfVermelho", "--cor-perigo"], ["mfCinza", "--cor-tinta-fraca"],
  ]) {
    assert.ok(css.includes(`.clinicalDark .${classe}{color:var(${token})}`),
      `no escuro, .${classe} volta a perder a cor para .clinicalDark b`);
  }
});
