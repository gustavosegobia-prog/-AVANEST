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
  assert.ok(/async function marcarPlantoes/.test(financeiro), "sumiu a função da baixa");
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

test("emitir a nota é um passo próprio, com data própria", () => {
  // O plantão pulava de "realizado" direto para "pago", e o sistema não sabia
  // dizer de quem era a demora: sem nota, quem deve uma ação é o médico; com a
  // nota, quem deve é o hospital. Só o segundo vira telefonema.
  const financeiro = ler("components/meu-financeiro.tsx");
  const gravacao = financeiro.match(/situacao:\s*"faturado"[^}]*}/);
  assert.ok(gravacao, "sumiu a gravação da nota emitida");
  // A DATA VAI JUNTO, pelo mesmo motivo do pagamento: sem ela "com nota" é uma
  // bandeira sem idade, e não dá para saber se a nota saiu ontem — e aí esperar
  // é o normal — ou em julho, e aí o telefonema está atrasado há dois meses.
  assert.ok(/faturado_em:\s*dataDaBaixa/.test(gravacao![0]),
    `a data da nota não vai junto: ${gravacao![0]}`);
  // Emitir nota não é receber: `pago_em` continua nulo.
  assert.ok(/pago_em:\s*null/.test(gravacao![0]),
    "emitir a nota não pode carimbar o pagamento");
  // E desfazer limpa as duas datas — um plantão "realizado" que guardasse a
  // data da nota antiga voltaria a parecer faturado no primeiro relatório.
  assert.ok(/situacao:\s*"realizado",\s*pago_em:\s*null,\s*faturado_em:\s*null/.test(financeiro),
    "desfazer tem de limpar faturado_em também");
  // O botão existe na tela, e não só a função.
  assert.ok(/Emiti a nota/.test(financeiro), "sumiu o botão de emitir a nota");
});

test("a porta do painel diz as duas coisas que há atrás dela", () => {
  // O painel passou a fazer duas coisas e a porta continuou com o nome de uma
  // só. Quem chega querendo marcar nota não abre um botão escrito "Dar baixa",
  // e conclui que o sistema não tem onde fazer isso — que foi exatamente o que
  // aconteceu. Tinha; estava atrás de uma placa errada.
  const financeiro = ler("components/meu-financeiro.tsx");
  const porta = financeiro.match(/baixaDe === l\.nome \? "Fechar" : "([^"]+)"/);
  assert.ok(porta, "sumiu o botão que abre o painel");
  assert.match(porta![1], /[Nn]ota/,
    `"${porta![1]}" não menciona a nota: quem vem marcar nota não vai clicar aqui`);
  // E, aberto, o painel explica os dois destinos antes da lista de caixinhas.
  assert.ok(/mfBaixaComo/.test(financeiro), "sumiu o modo de usar do painel");
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

test("uma lista só desenha as barras, o balão e a legenda", () => {
  // A cor sozinha responde "tem algo aqui" e obriga a ir procurar o número em
  // outro lugar. Passar o mouse na faixa mostra QUANTO ela vale — e o leitor de
  // tela ouve a mesma divisão.
  //
  // Barras, balão, texto anunciado e legenda saem todos de FAIXAS. Escritos
  // separados, um deles fica para trás no dia em que uma faixa mudar de nome ou
  // de cor — e um balão que anuncia a cor errada é pior do que balão nenhum.
  const financeiro = ler("components/meu-financeiro.tsx");
  const lista = financeiro.match(/const FAIXAS = \[([^]*?)\] as const;/);
  assert.ok(lista, "sumiu a lista das faixas");
  const classes = [...lista![1].matchAll(/classe: "(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(classes, ["mfPrevisto", "mfAReceber", "mfAtrasado", "mfRecebido"],
    "a ordem das faixas é do topo para o chão da coluna");
  // Nenhuma delas pode estar escrita à mão fora da lista.
  const foraDaLista = financeiro.replace(lista![0], "");
  for (const classe of classes)
    assert.ok(!new RegExp(`className="${classe}"`).test(foraDaLista),
      `${classe} está escrita à mão fora de FAIXAS e vai divergir`);
  // O BALÃO É NOSSO, e não o `title` do navegador. Com o nativo era preciso
  // acertar o mouse numa faixa que pode ter seis pixels de altura; aqui a
  // coluna inteira é o alvo e as quatro linhas aparecem juntas.
  assert.ok(financeiro.includes('className="mfBalao"'), "sumiu o balão do mês");
  assert.ok(!/title=\{/.test(financeiro),
    "voltou um `title` nativo — ele abre em cima do balão e diz outra coisa");
  // O balão repete o que o `aria-label` do botão já anuncia; sem esconder, o
  // leitor de tela leria tudo duas vezes.
  assert.match(financeiro, /className="mfBalao" aria-hidden="true"/,
    "o balão precisa ser invisível para o leitor de tela");
  // E ele sai da mesma lista, na ordem em que a coluna se lê: de baixo para cima.
  assert.match(financeiro, /\[\.\.\.FAIXAS\]\.reverse\(\)\.filter\(\(f\) => f\.valor\(m\) > 0\)/,
    "o balão precisa listar só as faixas que existem no mês");
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

test("a faixa cinza não promete futuro em mês que já passou", () => {
  // Ela é o plantão em situação "escalado" — na escala, ainda não confirmado
  // como feito. Num mês adiante isso de fato ainda vai acontecer; num mês
  // passado é um plantão que aconteceu e ninguém confirmou. Um julho aberto em
  // setembro anunciava um plantão do dia 31/07 como futuro.
  const financeiro = ler("components/meu-financeiro.tsx");
  const lista = financeiro.match(/const FAIXAS = \[([^]*?)\] as const;/);
  assert.ok(lista, "sumiu a lista das faixas");
  assert.ok(!/rotulo: "Ainda vai acontecer"/.test(lista![1]),
    "a faixa voltou a prometer futuro em mês que já passou");
  assert.match(lista![1], /classe: "mfPrevisto", rotulo: "Escalado, a confirmar"/);
  // E o número lá em cima diz a mesma coisa que a faixa: dois nomes para o
  // mesmo valor é o começo de duas contas diferentes.
  const rotulos = [...financeiro.matchAll(/Escalado, a confirmar/g)].length;
  assert.ok(rotulos >= 2, "o resumo e a faixa têm de usar o mesmo nome");
});

test("nenhuma linha do balão é longa demais para a caixa", () => {
  // As linhas não quebram (`white-space:nowrap`), então rótulo comprido não
  // encolhe a caixa: vaza para fora dela. Foi o que aconteceu com "Parado há
  // mais de 60 dias", a linha mais longa do balão.
  //
  // Medido no navegador com os quatro rótulos e valores de um mês real: 267px
  // de conteúdo. O teto de 300px no CSS dá a folga; este teste guarda o outro
  // lado, que é o rótulo não voltar a crescer.
  const financeiro = ler("components/meu-financeiro.tsx");
  const lista = financeiro.match(/const FAIXAS = \[([^]*?)\] as const;/);
  assert.ok(lista, "sumiu a lista das faixas");
  const rotulos = [...lista![1].matchAll(/rotulo: "([^"]+)"/g)].map((m) => m[1]);
  assert.equal(rotulos.length, 4);
  for (const rotulo of rotulos)
    assert.ok(rotulo.length <= 22, `"${rotulo}" tem ${rotulo.length} letras e estoura o balão`);

  const teto = ler("app/globals.css").match(/\.mfBalao\{[^}]*max-width:(\d+)px/);
  assert.ok(teto, "o balão ficou sem teto de largura");
  assert.ok(Number(teto![1]) >= 280, `${teto![1]}px é pouco para a linha mais longa`);
});
