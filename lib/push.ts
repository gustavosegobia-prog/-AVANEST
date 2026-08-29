// Web Push, escrito à mão.
//
// POR QUE NÃO A BIBLIOTECA. A `web-push` resolve isto em três linhas, e é a
// escolha certa em quase todo projeto. Aqui ela entra num sistema que já
// conversa com o Stripe por `fetch` cru e escreve o próprio .xlsx: uma
// dependência a mais no servidor por um protocolo que cabe em duzentas linhas
// de `node:crypto` é dependência que alguém vai ter de auditar e atualizar
// para sempre. O que este arquivo usa é padrão fechado — RFC 8291 e RFC 8292
// não mudam.
//
// O QUE ACONTECE QUANDO SE MANDA UMA NOTIFICAÇÃO. O navegador do anestesista
// deu ao site uma "inscrição": um endereço (endpoint) num serviço de push da
// Google ou da Apple, mais duas chaves. O servidor de push é um carteiro que
// NÃO PODE LER a carta — por isso o conteúdo vai cifrado de ponta a ponta,
// com uma chave que só aquele navegador consegue derivar. Duas coisas
// separadas acontecem em cada envio:
//
//   1. CIFRAR o conteúdo (RFC 8291), para o carteiro não ler "Dr. Igor pediu
//      troca do plantão de sexta" no caminho.
//   2. ASSINAR o pedido (RFC 8292, "VAPID"), para o serviço de push saber que
//      é o AVANEST mandando, e não qualquer um que descobriu o endereço.
//
// UM AVISO SOBRE O IPHONE, que é onde isto mais vai ser usado. O Safari só
// entrega push quando o site foi ADICIONADO À TELA DE INÍCIO — no navegador,
// aberto numa aba, não existe. Não é limitação nossa: é da Apple, e vale
// igual para qualquer site. Quem usar pelo iPhone precisa instalar o atalho
// antes de a permissão sequer aparecer.

import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign } from "node:crypto";

// ── base64url ───────────────────────────────────────────────────────────────
// O push usa base64 SEM os caracteres que atrapalham em URL, e sem o "=" do
// fim. Trocar isso por base64 comum faz o serviço recusar com 400 e uma
// mensagem que não explica nada.

export const b64url = (b: Uint8Array | Buffer) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const deB64url = (s: string) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

// ── Derivação de chave (HKDF, RFC 5869) ─────────────────────────────────────

const extrair = (sal: Buffer, material: Buffer) =>
  createHmac("sha256", sal).update(material).digest();

/**
 * O "expand" do HKDF, sempre num bloco só.
 *
 * Tudo o que o Web Push deriva cabe em 32 bytes — a chave tem 16 e o nonce 12
 * —, então o contador de blocos é sempre 0x01 e o laço do RFC não precisa
 * existir. Pedir mais que 32 aqui devolveria silenciosamente bytes repetidos,
 * e por isso a função recusa em vez de mentir.
 */
function expandir(prk: Buffer, info: Buffer, tamanho: number) {
  if (tamanho > 32) throw new Error("HKDF: um bloco só dá 32 bytes");
  return createHmac("sha256", prk)
    .update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, tamanho);
}

const info = (rotulo: string, extra: Buffer = Buffer.alloc(0)) =>
  Buffer.concat([Buffer.from(`${rotulo}\0`, "utf8"), extra]);

/** A inscrição que o navegador entregou. */
export type Inscricao = {
  /** O endereço no serviço de push (Google, Apple, Mozilla). */
  endpoint: string;
  /** A chave pública do navegador, base64url — 65 bytes crus. */
  p256dh: string;
  /** O segredo de autenticação, base64url — 16 bytes. */
  auth: string;
};

/**
 * Cifra o conteúdo para UM navegador (RFC 8291, `aes128gcm`).
 *
 * O segredo compartilhado nasce de um ECDH entre uma chave efêmera nossa, que
 * existe só para esta mensagem, e a chave pública do navegador. Efêmera de
 * verdade: reaproveitar o par entre envios é o erro clássico daqui, porque
 * repetir chave e nonce no AES-GCM quebra a cifra inteira, e não só uma
 * mensagem.
 */
export function cifrar(conteudo: string, inscricao: Inscricao) {
  const chaveDoNavegador = deB64url(inscricao.p256dh);
  const authSecret = deB64url(inscricao.auth);
  if (chaveDoNavegador.length !== 65) throw new Error("p256dh precisa ter 65 bytes");
  if (authSecret.length !== 16) throw new Error("auth precisa ter 16 bytes");

  const efemero = createECDH("prime256v1");
  efemero.generateKeys();
  const nossaChave = efemero.getPublicKey();
  const compartilhado = efemero.computeSecret(chaveDoNavegador);

  // A ordem aqui é do RFC e não é decorativa: a chave do NAVEGADOR vem antes
  // da nossa. Invertida, os dois lados derivam chaves diferentes e a
  // notificação chega como um bloco de lixo que o navegador descarta calado.
  const prkDaChave = extrair(authSecret, compartilhado);
  const ikm = expandir(prkDaChave, info("WebPush: info", Buffer.concat([chaveDoNavegador, nossaChave])), 32);

  const sal = randomBytes(16);
  const prk = extrair(sal, ikm);
  const cek = expandir(prk, info("Content-Encoding: aes128gcm"), 16);
  const nonce = expandir(prk, info("Content-Encoding: nonce"), 12);

  // O 0x02 é o delimitador que marca o fim do conteúdo e o começo do
  // enchimento. Sem ele o navegador não sabe onde a mensagem acaba.
  const texto = Buffer.concat([Buffer.from(conteudo, "utf8"), Buffer.from([2])]);
  const cifra = createCipheriv("aes-128-gcm", cek, nonce);
  const cifrado = Buffer.concat([cifra.update(texto), cifra.final(), cifra.getAuthTag()]);

  // O cabeçalho vai junto com o corpo, em claro: sal, tamanho do registro,
  // e a nossa chave pública — é com ela que o navegador refaz o ECDH.
  const cabecalho = Buffer.alloc(21);
  sal.copy(cabecalho, 0);
  cabecalho.writeUInt32BE(4096, 16);
  cabecalho.writeUInt8(nossaChave.length, 20);

  return Buffer.concat([cabecalho, nossaChave, cifrado]);
}

// ── VAPID (RFC 8292): quem está mandando ────────────────────────────────────

/** A origem do endpoint — é ela que entra no `aud` do token. */
export const origemDo = (endpoint: string) => new URL(endpoint).origin;

/**
 * O par de chaves do VAPID, como ele aparece nas variáveis de ambiente:
 * base64url do ponto público de 65 bytes e do escalar privado de 32.
 */
export type ChavesVapid = { publica: string; privada: string; contato: string };

/**
 * Monta a chave privada P-256 a partir dos 32 bytes crus.
 *
 * O `node:crypto` não aceita o escalar solto; ele quer um JWK, e o JWK exige
 * também as coordenadas do ponto público. Elas saem da chave pública que já
 * temos: byte 0 é o marcador de "não comprimido", depois 32 bytes de X e 32
 * de Y.
 */
function chavePrivada({ publica, privada }: ChavesVapid) {
  const pub = deB64url(publica);
  const priv = deB64url(privada);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID: chave pública inválida");
  if (priv.length !== 32) throw new Error("VAPID: chave privada inválida");
  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC", crv: "P-256",
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
      d: b64url(priv),
    },
  });
}

/**
 * O token que prova que o envio é nosso.
 *
 * A assinatura tem de sair em `r||s` cru, de 64 bytes — que é o que o JWS
 * chama de ES256. O padrão do OpenSSL é DER, mais longo e de tamanho variável,
 * e um token assim é recusado com 401 sem explicação. É o que `ieee-p1363`
 * resolve.
 */
export function tokenVapid(chaves: ChavesVapid, endpoint: string, agora = Date.now()) {
  const cabecalho = b64url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64url(Buffer.from(JSON.stringify({
    aud: origemDo(endpoint),
    // Doze horas. O RFC permite até 24; o serviço de push recusa acima disso.
    exp: Math.floor(agora / 1000) + 12 * 60 * 60,
    sub: chaves.contato,
  })));
  const assinatura = sign("sha256", Buffer.from(`${cabecalho}.${corpo}`),
    { key: chavePrivada(chaves), dsaEncoding: "ieee-p1363" });
  return `${cabecalho}.${corpo}.${b64url(assinatura)}`;
}

/** O que vai no `Authorization` e nos demais cabeçalhos do POST. */
export function cabecalhos(chaves: ChavesVapid, endpoint: string, tamanho: number, agora = Date.now()) {
  return {
    Authorization: `vapid t=${tokenVapid(chaves, endpoint, agora)}, k=${chaves.publica}`,
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    "Content-Length": String(tamanho),
    // Quatro horas na fila do serviço de push. Aviso de escala que chega três
    // dias depois é pior que aviso nenhum: manda ao plantão errado.
    TTL: "14400",
    Urgency: "normal",
  };
}

// ── O envio ─────────────────────────────────────────────────────────────────

/** O que a notificação mostra. Vira JSON e é lido pelo service worker. */
export type Notificacao = {
  titulo: string;
  corpo: string;
  /** Para onde o clique leva, dentro do site. */
  url?: string;
  /**
   * Junta notificações do mesmo assunto numa só.
   *
   * Sem isto, publicar a escala do mês faz o telefone apitar uma vez por
   * plantão. Com a mesma `tag`, a segunda substitui a primeira.
   */
  tag?: string;
};

export type Resultado =
  | { ok: true; status: number }
  /** `expirou` = o navegador desinstalou ou limpou os dados: apague a inscrição. */
  | { ok: false; status: number; expirou: boolean; detalhe: string };

/**
 * Manda uma notificação para uma inscrição.
 *
 * Nunca lança por falha do serviço de push: um telefone trocado não pode
 * derrubar o aviso dos outros nove da equipe. O erro volta como valor, e quem
 * chama decide — 404 e 410 significam inscrição morta, e a linha sai do banco.
 */
export async function enviar(
  chaves: ChavesVapid, inscricao: Inscricao, notificacao: Notificacao,
): Promise<Resultado> {
  try {
    const corpo = cifrar(JSON.stringify(notificacao), inscricao);
    const resposta = await fetch(inscricao.endpoint, {
      method: "POST",
      headers: cabecalhos(chaves, inscricao.endpoint, corpo.length),
      body: new Uint8Array(corpo),
    });
    if (resposta.ok) return { ok: true, status: resposta.status };
    return {
      ok: false, status: resposta.status,
      expirou: resposta.status === 404 || resposta.status === 410,
      detalhe: (await resposta.text().catch(() => "")).slice(0, 300),
    };
  } catch (erro) {
    return {
      ok: false, status: 0, expirou: false,
      detalhe: erro instanceof Error ? erro.message : String(erro),
    };
  }
}

/** Lê o par de chaves do ambiente. Devolve nulo quando não foi configurado. */
export function chavesDoAmbiente(): ChavesVapid | null {
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  const contato = process.env.VAPID_SUBJECT || "mailto:contato@avanest.com.br";
  if (!publica || !privada) return null;
  return { publica, privada, contato };
}
