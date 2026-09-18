import test from "node:test";
import assert from "node:assert/strict";
import {
  appEmbutido, conviteDeInstalacao, ehIOS, explicacaoDoConvite,
  PASSOS_DO_SAFARI, tituloDoConvite, type Leitura,
} from "./instalacao.ts";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 "
  + "(KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1";
const IPHONE_INSTAGRAM = IPHONE_SAFARI + " Instagram 320.0.0.29.109 (iPhone14,2; iOS 18_7)";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 "
  + "(KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) "
  + "Chrome/131.0.0.0 Mobile Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
  + "(KHTML, like Gecko) Version/18.0 Safari/605.1.15";

const ler = (ua: string, extra: Partial<Leitura> = {}): Leitura =>
  ({ ua, naTelaDeInicio: false, ...extra });

test("iPhone no Safari recebe o passo a passo", () => {
  const c = conviteDeInstalacao(ler(IPHONE_SAFARI));
  assert.deepEqual(c, { mostrar: true, caso: "safari", app: null });
});

test("JÁ INSTALADO não vê nada", () => {
  // É a checagem que impede a faixa de virar ruído diário para quem já fez o
  // que ela pede — o jeito mais rápido de ensinar alguém a ignorar avisos.
  assert.deepEqual(
    conviteDeInstalacao(ler(IPHONE_SAFARI, { naTelaDeInicio: true })),
    { mostrar: false },
  );
});

test("O NAVEGADOR DO INSTAGRAM GANHA OUTRA INSTRUÇÃO", () => {
  // É por onde a campanha chega: o link vai no direct, e quem toca não abre o
  // Safari. Ali "Adicionar à Tela de Início" não existe — mandar procurar esse
  // botão é mandar procurar o que não está na tela.
  const c = conviteDeInstalacao(ler(IPHONE_INSTAGRAM));
  assert.equal(c.mostrar, true);
  assert.equal(c.mostrar && c.caso, "embutido");
  assert.equal(c.mostrar && c.app, "Instagram");
});

test("o Instagram vence o Safari no mesmo user agent", () => {
  // O user agent do navegador embutido CONTÉM "Safari". Testar o Safari
  // primeiro classificaria todo mundo que vem do direct como instalável.
  assert.ok(IPHONE_INSTAGRAM.includes("Safari"), "a premissa do teste mudou");
  assert.equal(appEmbutido(IPHONE_INSTAGRAM), "Instagram");
});

test("os outros navegadores embutidos também são reconhecidos", () => {
  for (const [ua, esperado] of [
    ["... FBAN/FBIOS;FBAV/450.0 ...", "Facebook"],
    ["... WhatsApp/2.24 ...", "WhatsApp"],
    ["... LinkedInApp/9.0 ...", "LinkedIn"],
    ["... Telegram-iOS/10 ...", "Telegram"],
  ] as const) {
    assert.equal(appEmbutido(ua), esperado, ua);
  }
  assert.equal(appEmbutido(IPHONE_SAFARI), null);
});

test("Chrome no iPhone é mandado para o Safari", () => {
  const c = conviteDeInstalacao(ler(IPHONE_CHROME));
  assert.equal(c.mostrar && c.caso, "outro-navegador");
});

test("Android e computador não veem a faixa", () => {
  // No Android a notificação funciona na aba comum: não há urgência em
  // instalar, e repetir o convite ali só ensina a ignorá-lo.
  assert.deepEqual(conviteDeInstalacao(ler(ANDROID)), { mostrar: false });
  assert.deepEqual(conviteDeInstalacao(ler(MAC)), { mostrar: false });
});

test("iPad moderno se diz Mac, e o toque o entrega", () => {
  assert.equal(ehIOS(ler(MAC, { plataforma: "MacIntel", pontosDeToque: 5 })), true);
  assert.equal(ehIOS(ler(MAC, { plataforma: "MacIntel", pontosDeToque: 0 })), false);
  assert.equal(ehIOS(ler(MAC)), false);
});

test("o título diz o que fazer, e muda com o caso", () => {
  assert.equal(tituloDoConvite("safari"), "Instale o AVANEST na tela de início");
  assert.equal(tituloDoConvite("embutido"), "Abra no Safari para instalar");
  assert.equal(tituloDoConvite("outro-navegador"), "Abra no Safari para instalar");
});

test("a explicação do navegador embutido NOMEIA o aplicativo", () => {
  // "Você está num navegador embutido" não quer dizer nada para quem é médico.
  // "Você está no navegador do Instagram" é a tela que a pessoa está vendo.
  const t = explicacaoDoConvite("embutido", "Instagram");
  assert.ok(t.includes("Instagram"), t);
  assert.ok(t.includes("Safari"), t);
});

test("os três toques do Safari batem com os botões que existem no iPhone", () => {
  assert.equal(PASSOS_DO_SAFARI.length, 3);
  assert.ok(PASSOS_DO_SAFARI[0].texto.includes("Compartilhar"));
  assert.ok(PASSOS_DO_SAFARI[1].texto.includes("Adicionar à Tela de Início"));
  assert.ok(PASSOS_DO_SAFARI[2].texto.includes("Adicionar"));
});

test("o ícone acompanha o passo que tem botão para procurar", () => {
  // O terceiro passo é um botão de texto no canto da tela, sem glifo nenhum —
  // desenhar um ali seria inventar um símbolo que o iPhone não mostra.
  assert.equal(PASSOS_DO_SAFARI[0].icone, "compartilhar");
  assert.equal(PASSOS_DO_SAFARI[1].icone, "adicionar");
  assert.equal(PASSOS_DO_SAFARI[2].icone, null);
});

test("nenhum texto promete o que o iPhone não faz", () => {
  // O Safari não tem instalação por botão: não existe `beforeinstallprompt`
  // no iOS. Prometer um botão aqui seria mentira, e a pessoa procuraria.
  for (const caso of ["safari", "embutido", "outro-navegador"] as const) {
    const t = `${tituloDoConvite(caso)} ${explicacaoDoConvite(caso, "Instagram")}`;
    assert.ok(!/clique em instalar|botão instalar/i.test(t), t);
  }
});
