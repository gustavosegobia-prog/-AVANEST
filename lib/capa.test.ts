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

test("capa, Quem faz o AVANEST: antes das perguntas, sem CRM, título nem cargo, e fora de produção até ser confirmado", async () => {
  const { ARQUIVO_DA_FOTO, QUEM_FAZ, mostrarQuemFaz } = await import("./quem-faz.ts");
  const { AUTOR } = await import("./autoria.ts");
  const texto = capa();
  const quemFaz = texto.indexOf('className={`avnQuemFaz'), perguntas = texto.indexOf('className="recBloco avnPerguntasCapa"');
  assert.ok(quemFaz > 0 && quemFaz < perguntas, "o bloco vem antes das perguntas frequentes");
  // Nada de CRM, "Dr." ou cargo no que o bloco escreve.
  const escrito = [QUEM_FAZ.titulo, QUEM_FAZ.nome, ...QUEM_FAZ.paragrafos].join(" ");
  assert.doesNotMatch(escrito, /CRM|RQE|\bDr\.?\s|\bDra\.?\s|médico anestesiologista|coordenador|diretor|fundador|CEO/i);
  assert.ok(!escrito.includes(AUTOR.crm));
  assert.equal(QUEM_FAZ.nome, AUTOR.nome);
  assert.doesNotMatch(texto.slice(quemFaz, perguntas), /nomeCompleto|registro\(\)|AUTOR\.cargo/);
  // Até a confirmação: marcado, e só fora de produção.
  if (!QUEM_FAZ.confirmado) {
    assert.equal(mostrarQuemFaz("production"), false);
    assert.equal(mostrarQuemFaz("preview"), true);
    assert.equal(mostrarQuemFaz(undefined), true);
    assert.match(texto, /Texto aguardando confirmação: não vai ao ar assim\./);
  }
  // A foto: o arquivo tem de existir quando o caminho for preenchido.
  assert.equal(ARQUIVO_DA_FOTO, "public/capa/quem-faz.webp");
  if (QUEM_FAZ.foto) assert.ok(fs.existsSync(new URL(`../public${QUEM_FAZ.foto}`, import.meta.url)), `falta ${QUEM_FAZ.foto}`);
});
