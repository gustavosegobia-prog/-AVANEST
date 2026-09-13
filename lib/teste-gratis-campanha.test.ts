import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AREAS_DO_TESTE, AREAS_QUE_A_ASSINATURA_ABRE, areasNoTeste,
} from "./modulos.ts";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

/**
 * O arquivo SEM os comentários.
 *
 * Os comentários deste projeto citam o código errado para explicar por que ele
 * era errado, e um teste que procura o padrão proibido no arquivo inteiro
 * reprova justamente a documentação da correção. Foi o que aconteceu aqui na
 * primeira execução — e `lib/avisos-push.test.ts` já tinha aprendido o mesmo.
 */
const semComentarios = (caminho: string) =>
  ler(caminho).split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")
                && !l.trim().startsWith("/*"))
    .join("\n");

test("o login deixa entrar quem está no teste", () => {
  // ESTE ERA O DEFEITO DE ORIGEM. A regra era
  // `["trial","cancelado"].includes(plano)`, e com ela todo mundo em teste caía
  // na tela de pagamento: o "teste grátis" era uma porta fechada, e cada conta
  // precisava ser aberta na mão como cortesia. Das sete organizações de então,
  // cinco eram cortesia dada a dedo e duas pararam na tela de pagamento.
  for (const tela of ["app/login/page.tsx", "app/login/login-form.tsx"]) {
    const codigo = semComentarios(tela);
    assert.doesNotMatch(codigo, /\["trial",\s*"cancelado"\]/,
      `${tela} voltou a barrar quem está em teste`);
    assert.match(codigo, /assinatura\.liberada === false/,
      `${tela} tem de perguntar ao banco se está liberada, e não adivinhar pelo nome do plano`);
  }
});

test("a mesma pergunta decide a porta e o painel", () => {
  // Duas regras diferentes para "pode usar o sistema?" dariam um login que
  // deixa entrar e um painel que expulsa — ou o contrário, que é pior.
  assert.match(ler("app/dashboard/page.tsx"), /assinatura\.liberada === false/);
});

test("a organização nasce com data de fim do teste", () => {
  // Sem a data, `plano='trial'` é só um rótulo: não há prazo para correr nem
  // para avisar, e `minha_assinatura` trata data nula como acesso liberado
  // para sempre.
  const migracao = ler("supabase/migrations/202609130001_dois_meses_de_teste.sql");
  assert.match(migracao, /assinatura_ate\)/);
  assert.match(migracao, /public\.fim_do_teste_gratis\(\)/);
  // A conta do banco tem de ser a mesma de lib/teste-gratis.ts. Escrita duas
  // vezes, ela vira duas datas diferentes no dia em que uma das duas mudar —
  // e a tela passaria a contar dias que a trava não respeita.
  assert.match(migracao, /interval '3 months' - interval '1 microsecond'/);
});

test("a promessa aparece na capa e na página de planos", () => {
  // Quem chega direto no /planos por um link nunca viu a capa, e é ali que
  // está olhando número — é onde a objeção do cartão nasce.
  for (const tela of ["app/page.tsx", "app/planos/page.tsx"]) {
    const codigo = ler(tela);
    assert.match(codigo, /Use por 2 meses grátis/, `a promessa sumiu de ${tela}`);
    assert.match(codigo, /Sem cartão para começar/, `${tela} não responde à objeção do cartão`);
  }
});

test("a faixa do teste só aparece para quem está testando", () => {
  // Contar dias para quem já pagou é lembrar de um prazo que não é problema
  // dele. Cortesia também fica de fora: ela não tem prazo combinado.
  const pagina = ler("app/dashboard/page.tsx");
  assert.match(pagina, /assinatura\?\.plano === "trial"/);
  const cliente = ler("app/dashboard/dashboard-client.tsx");
  assert.match(cliente, /testeAte\s*\n?\s*\?\s*estadoDoTeste/);
});

test("o convite para assinar só aparece quando o prazo aperta", () => {
  // Antes disso o botão interromperia o que a pessoa veio fazer. O preço
  // continua a um clique, no menu da conta.
  assert.match(ler("app/dashboard/dashboard-client.tsx"),
    /teste\.fase !== "correndo" && \(/);
});

test("o teste abre a ficha e a escala, e nada mais", () => {
  // "2 meses grátis, só com acesso da parte médica e escalas." Recepção e
  // Financeiro são as duas áreas que só fazem sentido quando o serviço já
  // decidiu adotar o sistema: uma pressupõe alguém no balcão, a outra o mês
  // inteiro lançado.
  assert.deepEqual([...AREAS_DO_TESTE].sort(), ["admin", "medico", "plantoes"]);
  assert.deepEqual(areasNoTeste(["medico", "plantoes", "recepcao", "financeiro", "admin"]),
    ["medico", "plantoes", "admin"]);
});

test("o Admin atravessa o teste, e isso não é descuido", () => {
  // É por ele que se cadastra o local, se convida a equipe e SE ASSINA. Um
  // teste que trancasse a administração seria um teste sem porta de saída: a
  // pessoa não conseguiria preparar o sistema nem pagar quando decidisse ficar.
  assert.ok((AREAS_DO_TESTE as readonly string[]).includes("admin"));
});

test("o filtro do teste se SOMA ao dos módulos, não o substitui", () => {
  // Uma organização que não contratou Escala não passa a ter Escala por estar
  // em teste. Os três filtros se somam e a pessoa vê a interseção.
  const pagina = ler("app/dashboard/page.tsx");
  assert.match(pagina, /areasNoTeste\(areasLiberadas\(doPapel, modulos\)\)/);
});

test("a tela diz o que a assinatura abre", () => {
  // Sem isto a pessoa procura o Financeiro, não acha, e conclui que o sistema
  // está quebrado — em vez de entender que ele abre ao assinar.
  assert.deepEqual(AREAS_QUE_A_ASSINATURA_ABRE, ["recepcao", "financeiro"]);
  const cliente = ler("app/dashboard/dashboard-client.tsx");
  assert.match(cliente, /AREAS_QUE_A_ASSINATURA_ABRE\.map/);
  // E a lista sai de lib/modulos.ts: escrita à mão na tela, ela mentiria no
  // dia em que uma área mudasse de lado.
  assert.doesNotMatch(cliente, /Recepção e Financeiro abrem/);
});

test("a página de planos avisa o escopo antes de a pessoa entrar", () => {
  // Vender "dois meses grátis" e entregar metade do sistema sem avisar é a
  // forma mais rápida de transformar um teste em reclamação.
  const planos = ler("app/planos/page.tsx");
  assert.match(planos, /No teste você usa a ficha anestésica e a escala/);
});

test("a tela de assinatura recebe quem veio do fim do teste", () => {
  // O pedido era "no fim dos 2 meses, uma mensagem e o redirecionamento". O
  // redirecionamento é o `liberada === false` do painel; a mensagem é esta, e
  // ela fala do que foi combinado na capa — "2 meses" —, não do vocabulário
  // do sistema.
  const tela = ler("app/assinatura/page.tsx");
  assert.match(tela, /trial: "Seus 2 meses de teste terminaram\."/);
  // E a promessa que sustenta a campanha: nada é apagado.
  assert.match(tela, /Nada é apagado enquanto a assinatura estiver parada/);
});
