import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  AUTORIZACAO_PADRAO, ITENS_PADRAO, MARCACOES, RISCOS_PADRAO, aplicarDados,
  copiaDoPadrao, ehOPadrao, limpar, marcacoesDesconhecidas, problemasDoTermo,
  termoVigenteEm, type VersaoDoTermo,
} from "./termo-consentimento.ts";

const ler = (caminho: string) =>
  fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");

const versao = (criado_em: string, marca: string): VersaoDoTermo =>
  ({ criado_em, itens: [`item ${marca}`], riscos: [`risco ${marca}`], autorizacao: `autorizo ${marca}` });

test("sem nenhuma versão, vale o texto de fábrica", () => {
  // É o estado da imensa maioria: a tabela guarda a DIFERENÇA, não o texto de
  // todo mundo. Copiar o padrão para dentro de cada organização na criação da
  // conta congelaria nela a redação do dia em que entrou, e uma correção nunca
  // mais alcançaria ninguém.
  assert.deepEqual(termoVigenteEm([], "2026-03-10T12:00:00Z"), copiaDoPadrao());
  assert.equal(termoVigenteEm([], null).itens.length, ITENS_PADRAO.length);
});

test("reimprimir março traz o termo de março", () => {
  // ESTE É O TESTE QUE JUSTIFICA A FUNCIONALIDADE INTEIRA. O termo é o papel
  // que o paciente ASSINOU. Se editar o texto mudasse o que já foi impresso, o
  // documento guardado no prontuário deixaria de bater com o que o sistema diz
  // que foi assinado — num processo, é a diferença entre ter e não ter
  // consentimento documentado.
  const versoes = [
    versao("2026-06-01T00:00:00Z", "de junho"),
    versao("2026-02-01T00:00:00Z", "de fevereiro"),
  ];
  assert.equal(termoVigenteEm(versoes, "2026-03-10T12:00:00Z").autorizacao, "autorizo de fevereiro");
  assert.equal(termoVigenteEm(versoes, "2026-09-10T12:00:00Z").autorizacao, "autorizo de junho");
});

test("avaliação concluída antes da primeira edição imprime o padrão", () => {
  // Ela imprimiu o padrão no dia em que foi assinada. Trazer o texto novo
  // agora seria reescrever o passado justamente na organização que resolveu
  // usar a funcionalidade.
  const versoes = [versao("2026-06-01T00:00:00Z", "novo")];
  assert.ok(ehOPadrao(termoVigenteEm(versoes, "2026-05-31T23:59:59Z")));
});

test("rascunho usa o texto de agora", () => {
  // Sem conclusão, o papel ainda vai ser impresso e assinado. O texto que vale
  // é o de hoje.
  const versoes = [versao("2020-01-01T00:00:00Z", "vigente")];
  assert.equal(termoVigenteEm(versoes, null).autorizacao, "autorizo vigente");
});

test("a ordem em que as versões chegam não importa", () => {
  // A consulta ordena, mas a escolha não pode DEPENDER da ordem: bastaria
  // alguém trocar o `order` da consulta para o termo passar a sair errado, e
  // errado sem erro nenhum na tela.
  const fora = [
    versao("2026-02-01T00:00:00Z", "fev"),
    versao("2026-06-01T00:00:00Z", "jun"),
    versao("2026-04-01T00:00:00Z", "abr"),
  ];
  assert.equal(termoVigenteEm(fora, "2026-05-01T00:00:00Z").autorizacao, "autorizo abr");
});

test("a versão escolhida vem copiada, não emprestada", () => {
  // Quem imprime não pode alterar por acidente a lista que a página guarda em
  // memória — a mesma que outra impressão vai ler em seguida.
  const versoes = [versao("2026-01-01T00:00:00Z", "x")];
  termoVigenteEm(versoes, "2026-02-01T00:00:00Z").itens.push("intruso");
  assert.deepEqual(versoes[0].itens, ["item x"]);
});

test("data inválida cai no padrão em vez de quebrar a impressão", () => {
  assert.ok(ehOPadrao(termoVigenteEm([versao("2020-01-01T00:00:00Z", "x")], "não é data")));
});

test("as marcações são preenchidas com o cadastro", () => {
  // É a resposta ao "e o nome da minha clínica, eu escrevo onde?": em lugar
  // nenhum — ele já sai. Digitado à mão, passaria a mentir no dia em que o
  // cadastro mudasse.
  assert.equal(
    aplicarDados("Autorizo {{clinica}}, em {{cidade}}, a anestesiar {{paciente}}.",
      { clinica: "Santa Casa", cidade: "Campo Mourão/PR", paciente: "Maria" }),
    "Autorizo Santa Casa, em Campo Mourão/PR, a anestesiar Maria.");
});

test("marcação sem dado FICA VISÍVEL, e não vira buraco", () => {
  // Apagar produziria "Autorizo  a realizar", que parece um termo pronto.
  // Aparecendo, o erro se denuncia na primeira impressão.
  assert.equal(aplicarDados("Autorizo {{clinica}}.", {}), "Autorizo {{clinica}}.");
  assert.equal(aplicarDados("Autorizo {{clinica}}.", { clinica: "   " }), "Autorizo {{clinica}}.");
});

test("marcação que o sistema não conhece é barrada antes de virar papel", () => {
  const termo = { ...copiaDoPadrao(), autorizacao: "Autorizo {{hospitl}} e {{clinica}}." };
  assert.deepEqual(marcacoesDesconhecidas(termo), ["hospitl"]);
  assert.match(problemasDoTermo(termo).join(" "), /\{\{hospitl\}\}/);
  // E o que ela DEVERIA ser aparece no mesmo aviso, senão o erro é só um "não".
  for (const m of MARCACOES) assert.match(problemasDoTermo(termo).join(" "), new RegExp(`\\{\\{${m.chave}\\}\\}`));
});

test("o termo não pode deixar de ser um termo", () => {
  // O sistema não é revisor jurídico e não julga o texto de ninguém. O que ele
  // barra é o papel que PARECERIA consentimento sem ser: sem item, sem risco
  // ou sem o parágrafo que o paciente assina.
  assert.deepEqual(problemasDoTermo({ itens: [], riscos: ["r"], autorizacao: "a" }).length, 1);
  assert.deepEqual(problemasDoTermo({ itens: ["i"], riscos: [], autorizacao: "a" }).length, 1);
  assert.deepEqual(problemasDoTermo({ itens: ["i"], riscos: ["r"], autorizacao: "   " }).length, 1);
  assert.deepEqual(problemasDoTermo(copiaDoPadrao()), []);
});

test("linha em branco não vira item vazio no papel", () => {
  // O botão "+ Acrescentar item" nasce vazio, e é comum acrescentar um e
  // desistir. Um <li> em branco no meio de uma lista numerada de documento
  // jurídico parece item apagado.
  assert.deepEqual(limpar({ itens: ["  a  ", "", "   "], riscos: ["b"], autorizacao: " c " }),
    { itens: ["a"], riscos: ["b"], autorizacao: "c" });
});

test("o padrão é copiado, nunca emprestado", () => {
  copiaDoPadrao().itens.push("intruso");
  assert.equal(copiaDoPadrao().itens.length, ITENS_PADRAO.length);
});

test("o texto de fábrica é palavra por palavra o que sempre foi impresso", () => {
  // Ele saiu de dentro de print-documents.tsx. Uma vírgula perdida na mudança
  // seria um termo diferente do que a organização já usa, sem ninguém ter
  // pedido nada — e ninguém releria dez parágrafos para conferir.
  assert.equal(ITENS_PADRAO.length, 10);
  assert.equal(RISCOS_PADRAO.length, 7);
  assert.match(ITENS_PADRAO[0], /^Foi claramente exposto a mim/);
  assert.match(ITENS_PADRAO[9], /retirar este consentimento a qualquer momento/);
  assert.match(AUTORIZACAO_PADRAO, /^Entendo que os meios utilizados/);
  // E não sobrou cópia nenhuma na tela de impressão: duas fontes do mesmo
  // texto é o jeito garantido de as duas discordarem.
  const impressao = ler("app/avaliacoes/[id]/documentos/print-documents.tsx");
  assert.doesNotMatch(impressao, /const CONSENT_ITEMS\s*=/);
  assert.doesNotMatch(impressao, /const CONSENT_RISKS\s*=/);
});

test("a numeração impressa é calculada, e não escrita à mão", () => {
  // O "4." dos riscos era constante. Uma organização que apagasse um item
  // passaria a imprimir 2, depois 4 — a lista pularia um número no meio de um
  // documento assinado.
  const impressao = ler("app/avaliacoes/[id]/documentos/print-documents.tsx");
  assert.doesNotMatch(impressao, /<b>4\. Os seguintes pontos/);
  assert.match(impressao, /Math\.min\(termo\.itens\.length,2\)\+2\}\. Os seguintes pontos/);
  assert.match(impressao, /<ol start=\{Math\.min\(termo\.itens\.length,2\)\+3\}>/);
});

test("a impressão escolhe pela conclusão, e não pela versão mais nova", () => {
  const impressao = ler("app/avaliacoes/[id]/documentos/print-documents.tsx");
  assert.match(impressao, /termoVigenteEm\(versoesDoTermo\?\?\[\],avaliacao\.concluida_at\)/);
});

test("o banco não deixa alterar nem apagar uma versão", () => {
  // A regra de verdade é a do banco: a tela é só a porta da frente. Sem
  // política de update/delete e com a permissão revogada, uma versão gravada é
  // definitiva — inclusive contra um POST direto no PostgREST.
  const migracao = ler("supabase/migrations/202609140001_termo_editavel.sql");
  assert.match(migracao, /for insert to authenticated/);
  assert.doesNotMatch(migracao, /for (update|delete|all) to authenticated/);
  assert.match(migracao, /revoke update, delete on public\.termos_consentimento/);
  // TRUNCATE não passa pelo RLS: as políticas recusariam linha por linha, mas
  // ele levaria a tabela inteira sem consultar nenhuma delas.
  assert.match(migracao, /revoke truncate on public\.termos_consentimento/);
});

test("quem escreve é o mesmo que o banco aceita", () => {
  // A política exige role admin/owner. Uma tela mais generosa que o banco
  // entrega um botão que só sabe devolver erro de permissão.
  assert.match(ler("supabase/migrations/202609140001_termo_editavel.sql"),
    /current_app_role\(\) in \('admin','owner'\)/);
  assert.match(ler("app/dashboard/dashboard-client.tsx"),
    /podeEditar=\{\["owner","admin"\]\.includes\(perfil\.role\)\}/);
});

test("a tela do Admin diz as duas coisas que evitam um documento errado", () => {
  const tela = ler("components/termo-admin.tsx");
  // 1. O cadastro já preenche — ninguém precisa digitar o nome da clínica.
  assert.match(tela, /O cadastro já preenche sozinho/);
  // 2. Editar não muda o que já foi assinado.
  assert.match(tela, /Editar não muda o que já foi assinado/);
});
