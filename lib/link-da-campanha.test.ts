import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  LINK_DA_CAMPANHA, ORIGEM_PADRAO, linkComOrigem, origemDoLink,
} from "./link-da-campanha.ts";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

test("a campanha finalmente tem uma porta", () => {
  // ESTE ERA O BURACO. A promessa estava na capa e no /planos desde o começo,
  // mas /criar-conta sem convite e sem plano respondia "Cadastro por convite —
  // peça o link a quem administra o sistema". Quem lia "2 meses grátis" e
  // queria experimentar batia nessa parede: a campanha não levava a lugar
  // nenhum.
  const pagina = ler("app/criar-conta/page.tsx");
  assert.match(pagina, /if \(!token && origem\)/);
  // E o ramo novo vem ANTES do muro, senão ele nunca é alcançado.
  assert.ok(pagina.indexOf("if (!token && origem)") < pagina.indexOf("Cadastro por convite"),
    "o muro do convite continua na frente da campanha");
});

test("o link é curto o bastante para caber num direct", () => {
  // Ele é lido no telefone, dentro do Instagram, que corta o meio do endereço
  // com reticências. Um /criar-conta?origem=instagram viraria "avanest.com.br/
  // criar-co…gram" na tela de quem recebe.
  assert.equal(LINK_DA_CAMPANHA, "https://www.avanest.com.br/2meses");
  // O que aparece na mensagem é o endereço sem o "https://" — é essa metade
  // que precisa caber antes das reticências.
  assert.ok(LINK_DA_CAMPANHA.replace(/^https:\/\//, "").length <= 26);
  // E o endereço tem de ser DITÁVEL em voz alta: sem interrogação, sem igual.
  assert.doesNotMatch(LINK_DA_CAMPANHA, /[?=&]/);
});

test("a mesma origem escrita de jeitos diferentes conta como uma só", () => {
  // "Instagram", "instagram " e "Instagram/Stories" viram três linhas
  // diferentes na hora de somar, e uma contagem que se divide sozinha não
  // responde à única pergunta que existe para responder: de onde vieram.
  assert.equal(origemDoLink("Instagram"), "instagram");
  assert.equal(origemDoLink(" instagram "), "instagram");
  assert.equal(origemDoLink("Instagram/Stories"), "instagram-stories");
  assert.equal(origemDoLink("divulgação"), "divulgacao");
});

test("origem vazia ou lixo vira a origem padrão, e não string vazia", () => {
  // Guardar "" seria guardar "não sei" com cara de resposta.
  assert.equal(origemDoLink(undefined), ORIGEM_PADRAO);
  assert.equal(origemDoLink(""), ORIGEM_PADRAO);
  assert.equal(origemDoLink("   "), ORIGEM_PADRAO);
  assert.equal(origemDoLink("!!!"), ORIGEM_PADRAO);
});

test("o que vem da barra de endereços não entra cru na conta", () => {
  // O valor vai parar nos metadados do usuário. Ele é normalizado, não copiado.
  assert.equal(origemDoLink("<script>alert(1)</script>"), "script-alert-1-script");
  assert.equal(origemDoLink("a".repeat(200)).length, 32);
  // E não sobra hífen solto na ponta depois do corte.
  assert.doesNotMatch(origemDoLink(`${"a".repeat(31)} instagram`), /-$/);
  // Um array (?de=x&de=y) não vira "x,y".
  assert.equal(origemDoLink(["instagram", "whatsapp"]), "instagram");
});

test("o link só ganha ?de= quando há o que medir", () => {
  assert.equal(linkComOrigem(), LINK_DA_CAMPANHA);
  assert.equal(linkComOrigem("2meses"), LINK_DA_CAMPANHA);
  assert.equal(linkComOrigem("Instagram"), `${LINK_DA_CAMPANHA}?de=instagram`);
});

test("a origem é gravada na conta, e não num cookie", () => {
  // O caminho real atravessa aparelhos: a conta é criada no telefone, o e-mail
  // de confirmação é aberto no computador, e só então a organização nasce. Um
  // cookie ou um parâmetro de URL não sobrevivem a isso.
  assert.match(ler("app/criar-conta/sign-up-form.tsx"),
    /origem \? \{ data: \{ origem \} \}/);
});

test("a página promete o que o sistema cumpre, e com a mesma conta", () => {
  // A data por extenso sai de lib/teste-gratis.ts, que é quem o banco copia.
  // Escrita à mão na propaganda, ela seria uma data diferente da que a conta
  // realmente recebe.
  const pagina = ler("app/2meses/page.tsx");
  assert.match(pagina, /fimDoTeste\(new Date\(\)\)/);
  assert.match(pagina, /MESES_DE_TESTE/);
  // Sem cartão, dito com essa palavra: é a objeção concreta, e "grátis"
  // sozinho não a responde.
  assert.match(pagina, /Sem cartão de crédito/);
  // O ESCOPO, antes do botão. Vender dois meses e entregar metade do sistema
  // sem avisar transforma um teste em reclamação — e uma reclamação vinda do
  // Instagram volta pelo mesmo caminho, em público.
  const escopo = pagina.indexOf("Recepção e Financeiro abrem ao assinar");
  const botao = pagina.indexOf("Criar minha conta grátis");
  assert.ok(escopo > 0 && escopo < botao, "o escopo do teste precisa vir antes do botão");
  // E a promessa que segura quem não assinar no fim.
  assert.match(pagina, /Nada é apagado/);
});

test("quem já tem conta não lê propaganda", () => {
  // É o caso do próprio anestesiologista testando o link antes de mandar, e o
  // de quem clica de novo no direct semanas depois.
  assert.match(ler("app/2meses/page.tsx"), /if \(user\) redirect\("\/dashboard"\)/);
});

test("o cadastro pela campanha não promete pagamento nenhum", () => {
  // A tela de "confirme seu e-mail" é a última coisa que a pessoa vê antes de
  // sair da aba. Dizer ali "concluir a assinatura" desmente o "sem cartão" que
  // a trouxe.
  assert.match(ler("app/criar-conta/sign-up-form.tsx"),
    /origem \? " começar seus 2 meses grátis\."/);
});
