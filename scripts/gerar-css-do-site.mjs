/**
 * Gera app/site.css: o globals.css sem as regras que só o sistema usa.
 *
 *     node scripts/gerar-css-do-site.mjs
 *
 * POR QUÊ (auditoria de SEO de 15/11/2026). O globals.css tem 640 KB, quase
 * tudo do sistema por dentro (ficha anestésica, avaliação, financeiro…). As
 * páginas públicas — a capa, os guias, os escores, que são o que o Google mede
 * e o que o visitante novo abre — baixavam o arquivo inteiro antes de mostrar
 * a primeira letra: o Lighthouse contava ~600 ms de bloqueio e ~80 KiB de CSS
 * sem uso em cada uma.
 *
 * COMO, SEM RISCO PARA O SISTEMA:
 *   - o layout raiz carrega app/site.css (este arquivo gerado);
 *   - cada área do sistema (dashboard, evolucao, financeiro…) tem um layout
 *     que carrega o globals.css INTEIRO, na ordem de sempre. O site.css é um
 *     pedaço do mesmo arquivo, na mesma ordem, carregado antes: no sistema a
 *     cascata fica idêntica à de antes (a última cópia de cada regra é a do
 *     globals.css);
 *   - nas páginas públicas só saem regras que não podem tocar nelas.
 *
 * QUAL REGRA SAI. A que, em todos os seletores, tem uma classe que aparece no
 * código do sistema e em NENHUM arquivo que as páginas públicas importam (o
 * fecho dos imports de tudo o que está em app/ fora das áreas do sistema). Na
 * dúvida, fica:
 *   - classe que não aparece escrita em lugar nenhum (montada em tempo de
 *     execução) conta como pública;
 *   - classe dentro de :not(), :is(), :where(), :has() ou de [atributo] não
 *     decide nada (`.x:not(.evoY)` pega elemento público);
 *   - regra sem classe (tag, :root, variáveis), @keyframes e @font-face ficam.
 *
 * O globals.css continua sendo a fonte: edita-se ele, e o build regenera este
 * (package.json: "dev" e "build" rodam este script antes). O teste
 * lib/css-do-site.test.ts confere que o site.css commitado está em dia.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(RAIZ, "package.json"));
const postcss = require("postcss");

/** As áreas do sistema: exigem login, e o layout delas carrega o globals.css inteiro. */
export const AREAS_DO_SISTEMA = [
  "assinatura", "avaliacoes", "calculos", "centro-cirurgico", "comecar", "crises",
  "dashboard", "duas-etapas", "evolucao", "financeiro", "locais", "organizacoes",
];

const EXTENSOES = [".tsx", ".ts", ".jsx", ".js", ".mjs"];

function arquivosEm(dir) {
  const fora = [];
  if (!fs.existsSync(dir)) return fora;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fora.push(...arquivosEm(p));
    else if (EXTENSOES.includes(path.extname(e.name)) && !/\.test\.[jt]sx?$/.test(e.name)) fora.push(p);
  }
  return fora;
}

function resolver(de, alvo) {
  let base;
  if (alvo.startsWith("@/")) base = path.join(RAIZ, alvo.slice(2));
  else if (alvo.startsWith(".")) base = path.resolve(path.dirname(de), alvo);
  else return null;
  const tentativas = [base, ...EXTENSOES.map((x) => base + x), ...EXTENSOES.map((x) => path.join(base, "index" + x))];
  // Só código: o `import "./globals.css"` do layout não é uma página usando classe.
  return tentativas.find((t) => EXTENSOES.includes(path.extname(t)) && fs.existsSync(t) && fs.statSync(t).isFile()) ?? null;
}

const IMPORTS = /(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

/** Os arquivos que as páginas públicas carregam: o fecho dos imports. */
function fechoPublico() {
  const app = path.join(RAIZ, "app");
  const sementes = arquivosEm(app).filter((f) => {
    const rel = path.relative(app, f).split(path.sep);
    return rel[0] !== "api" && !AREAS_DO_SISTEMA.includes(rel[0]);
  });
  const vistos = new Set();
  const fila = [...sementes];
  while (fila.length) {
    const f = fila.pop();
    if (vistos.has(f)) continue;
    vistos.add(f);
    const texto = fs.readFileSync(f, "utf8");
    for (const m of texto.matchAll(IMPORTS)) {
      const alvo = resolver(f, m[1] ?? m[2] ?? m[3]);
      if (alvo && !vistos.has(alvo)) fila.push(alvo);
    }
  }
  return vistos;
}

const palavras = (texto) => new Set(texto.match(/[A-Za-z_][A-Za-z0-9_-]*/g) ?? []);

/** As classes de um seletor que DECIDEM: fora de :not()/:is()/:where()/:has() e de [atributo]. */
function classesQueDecidem(seletor) {
  let s = seletor.replace(/\[[^\]]*\]/g, "");
  let antes;
  do { antes = s; s = s.replace(/:[a-z-]+\([^()]*\)/gi, ""); } while (s !== antes);
  return [...s.matchAll(/\.(-?[_a-zA-Z][_a-zA-Z0-9-]*)/g)].map((m) => m[1]);
}

export function gerarCssDoSite() {
  const publicos = fechoPublico();
  const doPublico = new Set();
  for (const f of publicos) for (const p of palavras(fs.readFileSync(f, "utf8"))) doPublico.add(p);
  const emTodoLugar = new Set();
  for (const dir of ["app", "components", "lib"]) {
    for (const f of arquivosEm(path.join(RAIZ, dir))) for (const p of palavras(fs.readFileSync(f, "utf8"))) emTodoLugar.add(p);
  }
  const soDoSistema = (c) => emTodoLugar.has(c) && !doPublico.has(c);
  const seletorDoSistema = (s) => classesQueDecidem(s).some(soDoSistema);

  const css = fs.readFileSync(path.join(RAIZ, "app/globals.css"), "utf8");
  const raiz = postcss.parse(css);
  let regrasFora = 0;
  raiz.walkRules((regra) => {
    // Dentro de @keyframes os "seletores" são 0%, from, to: ficam.
    if (regra.parent?.type === "atrule" && /keyframes$/i.test(regra.parent.name)) return;
    const ficam = regra.selectors.filter((s) => !seletorDoSistema(s));
    if (!ficam.length) { regra.remove(); regrasFora++; }
    else if (ficam.length < regra.selectors.length) regra.selectors = ficam;
  });
  // @media e @supports que ficaram vazios.
  let mudou = true;
  while (mudou) {
    mudou = false;
    raiz.walkAtRules((at) => {
      if (at.nodes && at.nodes.length === 0) { at.remove(); mudou = true; }
    });
  }
  const cabecalho = "/* GERADO por scripts/gerar-css-do-site.mjs a partir de app/globals.css — não edite aqui.\n"
    + "   As páginas públicas carregam este; as áreas do sistema carregam o globals.css inteiro. */\n";
  return { css: cabecalho + raiz.toString(), regrasFora };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { css, regrasFora } = gerarCssDoSite();
  const destino = path.join(RAIZ, "app/site.css");
  const anterior = fs.existsSync(destino) ? fs.readFileSync(destino, "utf8") : "";
  if (anterior !== css) fs.writeFileSync(destino, css);
  console.log(`app/site.css: ${Math.round(css.length / 1024)} KB (${regrasFora} regras só do sistema ficaram de fora)${anterior === css ? ", sem mudança" : ""}`);
}
