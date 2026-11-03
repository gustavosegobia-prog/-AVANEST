import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ENCARREGADO, MEDIDAS_DE_SEGURANCA } from "./seguranca.ts";
import { DUAS_ETAPAS_LIGADA } from "./duas-etapas.ts";
import { organizacao } from "./schema.ts";

const ler = (caminho: string) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const tudo = () => MEDIDAS_DE_SEGURANCA.map((m) => [m.titulo, m.texto, m.naPolitica.destaque ?? "", m.naPolitica.texto].join(" ")).join(" ");

test("segurança: uma lista só, lida pela política, pelo /recursos e pelo /seguranca", () => {
  // Cada página tinha a sua lista escrita à mão. Nenhuma pode voltar a ter.
  const privacidade = ler("app/privacidade/page.tsx");
  const recursos = ler("app/recursos/page.tsx");
  const seguranca = ler("app/seguranca/page.tsx");
  for (const [nome, codigo] of [["privacidade", privacidade], ["recursos", recursos], ["seguranca", seguranca]]) {
    assert.match(codigo, /MEDIDAS_DE_SEGURANCA/, `${nome} não lê a lista de lib/seguranca.ts`);
  }
  // As frases que moravam nas páginas saíram delas: estão só na lista.
  assert.doesNotMatch(privacidade, /Backups automáticos da base|Senhas guardadas com hash/);
  assert.doesNotMatch(recursos, /Fica registrado quem fez o quê|não se misturam com os de outra/);
  // E o encarregado também é um só.
  assert.match(privacidade, /ENCARREGADO\.quem/);
  assert.match(seguranca, /ENCARREGADO\.quem/);
  assert.equal(ENCARREGADO.cnpj, organizacao().taxID, "o CNPJ do DPO é o da empresa");
});

test("segurança: a lista traz o que foi pedido, sem prometer o que está desligado", () => {
  const ids = MEDIDAS_DE_SEGURANCA.map((m) => m.id);
  assert.deepEqual(ids, ["isolamento", "perfis", "auditoria", "cifragem", "senhas", "anti-robo", "backup"]);
  assert.equal(new Set(ids).size, ids.length);
  const texto = tudo();
  assert.match(texto, /banco de dados/);
  assert.match(texto, /autor, a data e a hora/);
  assert.match(texto, /HTTPS/);
  assert.match(texto, /cifrados em repouso/);
  assert.match(texto, /[Bb]ackup/);
  // Verificação em duas etapas desligada (18/10/2026): nenhuma das três páginas pode prometê-la.
  if (!DUAS_ETAPAS_LIGADA) {
    for (const pagina of ["app/seguranca/page.tsx", "app/privacidade/page.tsx", "app/recursos/page.tsx"]) {
      assert.doesNotMatch(ler(pagina), /duas etapas|dois fatores|2FA/i, pagina);
    }
    assert.doesNotMatch(texto, /duas etapas|dois fatores|2FA/i);
  }
  // Nada de selo, certificação ou número que o sistema não tem.
  assert.doesNotMatch(texto + ler("app/seguranca/page.tsx"), /ISO ?27001|SOC ?2|certificad|99[,.]9|HIPAA/i);
});

test("segurança: a página entra no rodapé, no sitemap e no FAQ, e cabe no resultado do Google", () => {
  assert.match(ler("components/rodape-publico.tsx"), /href="\/seguranca"/);
  assert.match(ler("app/sitemap.ts"), /caminho: "\/seguranca"/);
  assert.doesNotMatch(ler("app/robots.ts"), /"\/seguranca"/);
  assert.match(ler("components/abertura-animada.tsx"), /"seguranca"/);
  // O FAQ "Os dados ficam seguros?" aponta para ela, na capa e na escala médica.
  const capa = ler("app/page.tsx");
  assert.match(capa.slice(capa.indexOf("Os dados dos pacientes ficam seguros?")), /^[^]*?href="\/seguranca"/);
  const escala = ler("app/escala-medica/page.tsx");
  assert.match(escala.slice(escala.indexOf("Os dados ficam seguros?"), escala.indexOf("Os dados ficam seguros?") + 400), /href="\/seguranca"/);
  assert.match(ler("app/recursos/page.tsx"), /leia: \["\/seguranca"/);
  const pagina = ler("app/seguranca/page.tsx");
  const titulo = pagina.match(/titulo: "(.+)",/)![1];
  const descricao = pagina.match(/descricao: "([^"]+)"\s*\n\s*\+ "([^"]+)",/)!;
  const d = descricao[1] + descricao[2];
  assert.ok(titulo.length <= 65, `título com ${titulo.length}`);
  assert.ok(d.length >= 100 && d.length <= 160, `descrição com ${d.length}`);
  assert.match(pagina, /paginaPublica\(\{/);
});
