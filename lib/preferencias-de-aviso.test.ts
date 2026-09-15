import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CHAVES, INTERRUPTOR, PADRAO, ROTULOS, aceita, comPadrao, comoTocar, paraGravar,
} from "./preferencias-de-aviso.ts";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

/**
 * O arquivo SEM os comentários.
 *
 * Os comentários deste projeto citam o caminho ERRADO para explicar por que ele
 * era errado — aqui, "ficam no banco, e não no localStorage" —, e um teste que
 * procura a palavra proibida no arquivo inteiro reprova justamente a
 * documentação da escolha certa. É a terceira vez que isto acontece no
 * projeto; ver lib/teste-gratis-campanha.test.ts e lib/avisos-push.test.ts.
 */
const semComentarios = (caminho: string) =>
  ler(caminho).split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")
                && !l.trim().startsWith("/*"))
    .join("\n");

test("tudo nasce ligado, e é isso que dispensa migrar alguém", () => {
  // As contas que já existem não têm nada gravado, e continuam recebendo o que
  // recebiam ontem. Conta nova também: a "configuração padrão para novos
  // usuários" não é um insert na criação, é a ausência de linha significando
  // "tudo".
  for (const chave of CHAVES) assert.equal(PADRAO[chave], true, `${chave} devia nascer ligada`);
  assert.deepEqual(comPadrao(null), PADRAO);
  assert.deepEqual(comPadrao(undefined), PADRAO);
});

test("preferência nova nasce ligada para quem já salvou as antigas", () => {
  // É a razão de o merge ser sobre o padrão e não uma substituição. Sem isso,
  // quem mexeu nas preferências uma vez deixaria de receber toda categoria
  // criada depois — e o defeito só apareceria como "não recebi o aviso" meses
  // adiante, sem ninguém ligar uma coisa à outra.
  const antigo = { escala_publicada: false };
  const lido = comPadrao(antigo);
  assert.equal(lido.escala_publicada, false);
  assert.equal(lido.lembrete_plantao, true);
  assert.equal(lido.plantao_cancelado, true);
});

test("só um false explícito desliga", () => {
  // `0`, `""` e `null` dentro do objeto são dado malformado, não decisão.
  // Tratá-los como "desligado" silenciaria o telefone de alguém por causa de um
  // jsonb torto — e o silêncio é o defeito mais difícil de perceber que existe.
  const lido = comPadrao({ som: 0, vibracao: "", lembrete_plantao: null, escala_publicada: false });
  assert.equal(lido.som, true);
  assert.equal(lido.vibracao, true);
  assert.equal(lido.lembrete_plantao, true);
  assert.equal(lido.escala_publicada, false);
});

test("lixo no lugar do objeto não derruba nada", () => {
  // A coluna pode ter sido editada à mão, e a leitura roda dentro do cron —
  // onde uma exceção mata o envio de todo mundo, não só o de quem tem o dado
  // torto.
  for (const lixo of ["texto", 42, [], true]) {
    assert.deepEqual(comPadrao(lixo), PADRAO, `${JSON.stringify(lixo)} devia cair no padrão`);
  }
});

test("para gravar, só as chaves conhecidas e só booleanos", () => {
  const sujo = { ...PADRAO, som: false, role: "owner", lixo: 1 } as never;
  const limpo = paraGravar(sujo);
  assert.deepEqual(Object.keys(limpo).sort(), [...CHAVES].sort());
  assert.equal(limpo.som, false);
});

test("cada tipo de aviso sabe qual interruptor o governa", () => {
  const tudoLigado = comPadrao(null);
  assert.equal(aceita(tudoLigado, "escala"), true);
  const semEscala = comPadrao({ escala_publicada: false });
  assert.equal(aceita(semEscala, "escala"), false);
  // Oferta, convite e resposta são a mesma história para quem recebe: o plantão
  // está trocando de mãos.
  const semTroca = comPadrao({ plantao_trocado: false });
  assert.equal(aceita(semTroca, "troca"), false);
  assert.equal(aceita(semTroca, "troca_resolvida"), false);
  // E desligar a troca não desliga o lembrete.
  assert.equal(aceita(semTroca, "lembrete_plantao"), true);
});

test("o que não tem interruptor sempre toca", () => {
  // Decisão, não esquecimento: resposta do suporte é retorno de algo que a
  // pessoa mesma pediu, e mensagem da sala ela silencia saindo da conversa.
  // Interruptor para tudo transforma a tela de preferências numa mesa de som.
  const nada = comPadrao(Object.fromEntries(CHAVES.map((c) => [c, false])));
  assert.equal(aceita(nada, "chat"), true);
  assert.equal(aceita(nada, "suporte"), true);
  assert.equal(aceita(nada, "tipo_que_nao_existe"), true);
});

test("som e vibração viajam DENTRO da notificação", () => {
  // Quem monta a notificação é o service worker, e ele roda com o aplicativo
  // fechado, sem acesso a nada que a página tenha guardado. E a preferência é
  // da conta: quem silenciou no celular silenciou no tablet.
  assert.deepEqual(comoTocar(comPadrao(null)), { silencioso: false, vibrar: true });
  assert.deepEqual(comoTocar(comPadrao({ som: false, vibracao: false })),
    { silencioso: true, vibrar: false });
});

test("o service worker aplica o que chega, e não um padrão próprio", () => {
  const sw = ler("public/sw.js");
  assert.match(sw, /dados\.silencioso === true \? \{ silent: true \}/);
  assert.match(sw, /dados\.vibrar === false \? \[\]/);
});

test("o banco filtra as mesmas chaves que o TypeScript", () => {
  // A migração escreve a lista de novo, de propósito: é a fronteira entre o que
  // o navegador manda e o que o banco guarda, e fronteira que confia na outra
  // ponta não é fronteira. Este teste é o que impede as duas listas de
  // divergirem em silêncio.
  const sql = ler("supabase/migrations/202609150001_preferencias_de_aviso.sql");
  for (const chave of CHAVES) {
    assert.match(sql, new RegExp(`'${chave}'`), `a função do banco não conhece ${chave}`);
  }
});

test("a preferência não pode virar uma porta para mudar o próprio papel", () => {
  // `perfis` guarda role, permissoes e status NA MESMA LINHA, e RLS por coluna
  // não existe no Postgres: abrir um update para a pessoa mexer na própria
  // linha entregaria o papel junto. Por isso é uma função, e por isso ela
  // escreve uma coluna só.
  const sql = ler("supabase/migrations/202609150001_preferencias_de_aviso.sql");
  assert.match(sql, /update public\.perfis set preferencias_aviso = v_limpo/);
  assert.match(sql, /where id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /create policy .* on public\.perfis for update/i);
  // E a função é revogada de PUBLIC: o Postgres concede EXECUTE a todo mundo
  // por padrão em função nova.
  assert.match(sql, /revoke execute on function public\.salvar_preferencias_de_aviso\(jsonb\) from public, anon/);
});

test("cada interruptor da tela tem rótulo, grupo e explicação", () => {
  // Um interruptor sem explicação é um interruptor que ninguém mexe: "Plantão
  // alterado" sozinho não diz se cobre o plantão que alguém lançou para você.
  assert.equal(ROTULOS.length, CHAVES.length);
  for (const r of ROTULOS) {
    assert.ok(CHAVES.includes(r.chave), `${r.chave} não é uma preferência`);
    assert.ok(r.titulo.length >= 3, `${r.chave} sem título`);
    assert.ok(r.detalhe.length > 20, `${r.chave} sem explicação`);
  }
  assert.deepEqual([...new Set(ROTULOS.map((r) => r.grupo))], ["escala", "plantao", "geral"]);
});

test("a tela salva no banco, e não no aparelho", () => {
  // É a exigência escrita do pedido — "sincronizadas com a conta, não apenas
  // armazenadas localmente" — e também a única forma de funcionar: quem manda
  // a notificação é o servidor, de madrugada, e ele não lê o localStorage de
  // ninguém.
  const tela = semComentarios("components/preferencias-de-aviso.tsx");
  assert.match(tela, /rpc\("salvar_preferencias_de_aviso"/);
  assert.doesNotMatch(tela, /localStorage/);
});

test("quem recebe é quem decide, e a rota de envio pergunta a ele", () => {
  // Sem isto o interruptor só valeria para o lembrete diário, e quem desligasse
  // "plantão trocado" continuaria recebendo troca — que é metade das
  // notificações do sistema.
  const avisar = ler("app/api/push/avisar/route.ts");
  assert.match(avisar, /preferenciaDe\.get\(linha\.perfil_id\)/);
  assert.match(avisar, /if \(!aceita\(preferencia, tipo\)\)/);
  const cron = ler("app/api/push/lembretes/route.ts");
  assert.match(cron, /aceita\(preferencias, "lembrete_plantao"\)/);
});

test("todo tipo que a rota manda tem um interruptor ou é proposital", () => {
  // A lista dos que NÃO têm é conferida por nome: acrescentar um tipo novo sem
  // interruptor passa a exigir uma decisão explícita aqui, em vez de o tipo
  // nascer sem controle nenhum e ninguém notar.
  const semInterruptor = ["chat"];
  // A lista sai da união de tipos de `avisarPush`, que é o contrato entre a
  // tela e a rota — e não de uma varredura do corpo da rota: procurar
  // `tipo === "..."` no arquivo pescava junto o `typeof corpo?.tipo ===
  // "string"` da leitura do pedido.
  const uniao = ler("components/ativar-notificacoes.tsx")
    .match(/tipo: ("[a-z_]+"(?:\s*\|\s*"[a-z_]+")*)/)?.[1] ?? "";
  const tipos = [...uniao.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
  assert.ok(tipos.length >= 7, `só achei ${tipos.length} tipos na união de avisarPush`);
  for (const tipo of tipos) {
    assert.ok(INTERRUPTOR[tipo] || semInterruptor.includes(tipo),
      `o tipo "${tipo}" não tem interruptor nem está na lista dos propositais`);
  }
});
