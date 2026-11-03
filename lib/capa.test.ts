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
