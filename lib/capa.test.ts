import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ler = (caminho: string) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const capa = () => ler("app/page.tsx");
const secao = (texto: string, classe: string) => {
  const inicio = texto.indexOf(`<section className="${classe}"`);
  assert.ok(inicio >= 0, `sumiu a seção ${classe}`);
  return texto.slice(inicio, texto.indexOf("</section>", inicio));
};

test("capa, Comece hoje: três passos, cada um conferido no fluxo de verdade", () => {
  const comece = secao(capa(), "avnComece");
  assert.equal(comece.match(/<li>/g)?.length, 3);
  assert.match(comece, /Sem projeto de implantação\. Funciona no celular, no tablet e no computador\./);
  // Sem número digitado: o teste é DIAS_DE_TESTE / OFERTA_DO_TESTE.
  assert.doesNotMatch(comece, /\b15 dias\b|meses/);
  assert.match(comece, /href=\{`\$\{CAMINHO_DA_CAMPANHA\}\?de=comece-hoje`\}/);
  // 1. O botão da campanha leva a criar a conta, com e-mail e senha.
  assert.match(ler("app/15dias/page.tsx"), /href=\{`\/criar-conta\?origem=\$\{origem\}`\}/);
  const cadastro = ler("app/criar-conta/sign-up-form.tsx");
  assert.match(cadastro, /type="email"/);
  assert.match(cadastro, /Crie uma senha/);
  // 2. Depois da conta, /comecar: sozinho ou grupo; em seguida o cartão, em /assinatura.
  assert.match(cadastro, /`\/comecar\$\{plano/);
  const comecar = ler("app/comecar/onboarding-form.tsx");
  assert.match(comecar, /Sou anestesiologista individual/);
  assert.match(comecar, /Vou criar um grupo/);
  assert.match(comecar, /router\.replace\(plano \? `\/assinatura\?plano=\$\{encodeURIComponent\(plano\)\}` : "\/assinatura"\)/);
  // 3. A primeira avaliação nasce no botão "Nova avaliação" da área médica, e não depende de local cadastrado.
  assert.match(ler("components/area-medica.tsx"), />\+ Nova avaliação<\/button>/);
  assert.match(ler("app/dashboard/dashboard-client.tsx"), /local_atendimento_id: localAtivo\?\.id \?\? null/);
});

test("capa, Quem está por trás do AVANEST: antes das perguntas, o texto do responsável (segunda versão), sem CRM, e fora de produção se deixar de estar confirmado", async () => {
  const { ARQUIVO_DA_FOTO, QUEM_FAZ, mostrarQuemFaz } = await import("./quem-faz.ts");
  const { AUTOR } = await import("./autoria.ts");
  const texto = capa();
  const quemFaz = texto.indexOf('className={`avnQuemFaz'), perguntas = texto.indexOf('className="recBloco avnPerguntasCapa"');
  assert.ok(quemFaz > 0 && quemFaz < perguntas, "o bloco vem antes das perguntas frequentes");
  // O texto é o que o responsável escreveu e confirmou em 05/11/2026 (segunda versão),
  // com a assinatura e a linha do papel como ele as escreveu.
  assert.equal(QUEM_FAZ.titulo, "Quem está por trás do AVANEST");
  assert.equal(QUEM_FAZ.assinatura, "Dr. Gustavo Segobia da Silva");
  assert.equal(QUEM_FAZ.papel, "Médico | Fundador do AVANEST");
  assert.equal(QUEM_FAZ.paragrafos.length, 3);
  assert.match(QUEM_FAZ.paragrafos[0], /^Sou Gustavo Segobia da Silva, médico, e criei o AVANEST/);
  assert.match(texto.slice(quemFaz, perguntas), /QUEM_FAZ\.assinatura[\s\S]*QUEM_FAZ\.papel/);
  // O CRM não entra (pedido do responsável), nem "anestesiologista": ele é residente (R3)
  // e o título de especialista vem em março de 2027.
  const escrito = [QUEM_FAZ.titulo, QUEM_FAZ.assinatura, QUEM_FAZ.papel, ...QUEM_FAZ.paragrafos].join(" ");
  assert.doesNotMatch(escrito, /CRM|RQE|anestesiologista/i);
  assert.ok(!escrito.includes(AUTOR.crm));
  assert.equal(QUEM_FAZ.nome, AUTOR.nome);
  assert.doesNotMatch(texto.slice(quemFaz, perguntas), /nomeCompleto|registro\(\)|AUTOR\.cargo/);
  // Confirmado, vai a todo lugar; sem confirmação, marcado e só fora de produção.
  if (QUEM_FAZ.confirmado) {
    assert.equal(mostrarQuemFaz("production"), true);
  } else {
    assert.equal(mostrarQuemFaz("production"), false);
    assert.equal(mostrarQuemFaz("preview"), true);
    assert.equal(mostrarQuemFaz(undefined), true);
  }
  assert.match(texto, /Texto aguardando confirmação: não vai ao ar assim\./);
  // A foto: o arquivo tem de existir quando o caminho for preenchido.
  assert.equal(ARQUIVO_DA_FOTO, "public/capa/quem-faz.webp");
  if (QUEM_FAZ.foto) assert.ok(fs.existsSync(new URL(`../public${QUEM_FAZ.foto}`, import.meta.url)), `falta ${QUEM_FAZ.foto}`);
});

test("o número do teste não é digitado nos botões e no rodapé: sai de DIAS_DE_TESTE / OFERTA_DO_TESTE", () => {
  // Mudou o teste, mudam os botões. Antes, cada "Começar 15 dias grátis" era um número escrito à mão.
  const semComentarios = (c: string) => ler(c).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
  for (const arquivo of ["app/page.tsx", "components/pagina-de-conteudo.tsx", "components/rodape-publico.tsx"]) {
    const codigo = semComentarios(arquivo);
    assert.doesNotMatch(codigo, /Começar 15 dias|depois dos 15 dias|>15 dias grátis</, arquivo);
    assert.match(codigo, /OFERTA_DO_TESTE/, arquivo);
  }
});

test("o número de protocolos não é digitado: sai do catálogo, o que está liberado para quem usa", async () => {
  // A capa, o /recursos e o /15dias diziam "49 protocolos" à mão quando o módulo já tinha 50.
  const { PROTOCOLOS_LIBERADOS, QUANTOS_DE_APOIO, QUANTOS_DE_CRISE } = await import("./intercorrencias/catalogo.ts");
  assert.equal(QUANTOS_DE_CRISE, PROTOCOLOS_LIBERADOS.filter((p) => p.categoria !== "apoio").length);
  assert.equal(QUANTOS_DE_CRISE + QUANTOS_DE_APOIO, PROTOCOLOS_LIBERADOS.length);
  assert.ok(QUANTOS_DE_CRISE > 0 && QUANTOS_DE_APOIO > 0);
  const semComentarios = (c: string) => ler(c).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join("\n");
  for (const arquivo of ["app/page.tsx", "app/recursos/page.tsx", "app/15dias/page.tsx"]) {
    const codigo = semComentarios(arquivo);
    assert.doesNotMatch(codigo, /\b\d+ protocolos\b/, arquivo);
    assert.match(codigo, /QUANTOS_DE_CRISE\}? protocolos/, arquivo);
  }
});
