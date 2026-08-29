import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createECDH, createHmac, createDecipheriv, createPublicKey, randomBytes, verify,
} from "node:crypto";
import {
  b64url, cabecalhos, cifrar, deB64url, origemDo, tokenVapid, type ChavesVapid,
} from "./push.ts";

// ───────────────────────────────────────────────────────────────────────────
// O LADO DO NAVEGADOR, escrito aqui de propósito.
//
// Um teste que só chamasse `cifrar` e conferisse o tamanho do resultado
// passaria com a criptografia inteira errada — bytes embaralhados também têm
// o tamanho certo. O único jeito honesto de provar que a cifra funciona é
// DECIFRAR, e para isso o teste precisa fazer o que o Chrome faz ao receber.
//
// Este código é a leitura da RFC 8291 pelo lado de quem recebe: o segredo
// compartilhado sai do par de chaves OPOSTO ao do servidor, então um erro na
// derivação não some no espelho — as duas pontas simplesmente não se
// encontram e o teste quebra.
// ───────────────────────────────────────────────────────────────────────────

function decifrarComoONavegador(pacote: Buffer, chavePrivadaDoNavegador: ReturnType<typeof createECDH>, authSecret: Buffer) {
  const sal = pacote.subarray(0, 16);
  const tamanhoDoRegistro = pacote.readUInt32BE(16);
  const idLen = pacote.readUInt8(20);
  const chaveDoServidor = pacote.subarray(21, 21 + idLen);
  const cifrado = pacote.subarray(21 + idLen);

  const compartilhado = chavePrivadaDoNavegador.computeSecret(chaveDoServidor);
  const minhaPublica = chavePrivadaDoNavegador.getPublicKey();

  const expandir = (prk: Buffer, rotulo: string, extra: Buffer, n: number) =>
    createHmac("sha256", prk)
      .update(Buffer.concat([Buffer.from(`${rotulo}\0`, "utf8"), extra, Buffer.from([1])]))
      .digest().subarray(0, n);

  const prkDaChave = createHmac("sha256", authSecret).update(compartilhado).digest();
  const ikm = expandir(prkDaChave, "WebPush: info",
    Buffer.concat([minhaPublica, chaveDoServidor]), 32);
  const prk = createHmac("sha256", sal).update(ikm).digest();
  const cek = expandir(prk, "Content-Encoding: aes128gcm", Buffer.alloc(0), 16);
  const nonce = expandir(prk, "Content-Encoding: nonce", Buffer.alloc(0), 12);

  const tag = cifrado.subarray(cifrado.length - 16);
  const decifra = createDecipheriv("aes-128-gcm", cek, nonce);
  decifra.setAuthTag(tag);
  const aberto = Buffer.concat([
    decifra.update(cifrado.subarray(0, cifrado.length - 16)), decifra.final(),
  ]);

  // O 0x02 do fim marca onde o conteúdo acaba.
  let fim = aberto.length;
  while (fim > 0 && aberto[fim - 1] === 0) fim--;
  assert.equal(aberto[fim - 1], 2, "faltou o delimitador de fim de conteúdo");
  return { texto: aberto.subarray(0, fim - 1).toString("utf8"), tamanhoDoRegistro };
}

/** Uma inscrição igual à que o navegador entrega. */
function inscricaoDeMentira(endpoint = "https://fcm.googleapis.com/fcm/send/abc123") {
  const navegador = createECDH("prime256v1");
  navegador.generateKeys();
  const authSecret = randomBytes(16);
  return {
    navegador, authSecret,
    inscricao: {
      endpoint,
      p256dh: b64url(navegador.getPublicKey()),
      auth: b64url(authSecret),
    },
  };
}

describe("a cifra do conteúdo (RFC 8291)", () => {
  it("o navegador consegue ler o que o servidor escreveu", () => {
    // A prova de fogo do arquivo inteiro. Se a ordem das chaves no
    // `WebPush: info` estivesse trocada, ou o HKDF errado, esta linha quebra.
    const { navegador, authSecret, inscricao } = inscricaoDeMentira();
    const conteudo = JSON.stringify({ titulo: "Troca de plantão", corpo: "Dr. Igor ofereceu sexta 07h" });
    const { texto } = decifrarComoONavegador(cifrar(conteudo, inscricao), navegador, authSecret);
    assert.equal(texto, conteudo);
  });

  it("acento e cedilha atravessam inteiros", () => {
    // Vai ter "plantão", "avaliação" e "convênio" em quase toda notificação.
    const { navegador, authSecret, inscricao } = inscricaoDeMentira();
    const conteudo = "Escala de setembro publicada — confira seus plantões, Dr. João";
    const { texto } = decifrarComoONavegador(cifrar(conteudo, inscricao), navegador, authSecret);
    assert.equal(texto, conteudo);
  });

  it("cada envio usa uma chave efêmera NOVA", () => {
    // Repetir o par entre mensagens repete chave e nonce no AES-GCM, e isso
    // não quebra uma mensagem: quebra a cifra. É o erro mais caro daqui.
    const { inscricao } = inscricaoDeMentira();
    const a = cifrar("igual", inscricao);
    const b = cifrar("igual", inscricao);
    assert.notDeepEqual(a.subarray(21, 86), b.subarray(21, 86), "a chave pública se repetiu");
    assert.notDeepEqual(a.subarray(0, 16), b.subarray(0, 16), "o sal se repetiu");
    assert.notDeepEqual([...a], [...b], "duas cifras do mesmo texto saíram iguais");
  });

  it("o cabeçalho tem o formato que o serviço de push espera", () => {
    const { inscricao } = inscricaoDeMentira();
    const pacote = cifrar("oi", inscricao);
    assert.equal(pacote.readUInt32BE(16), 4096, "tamanho do registro");
    assert.equal(pacote.readUInt8(20), 65, "a chave pública tem 65 bytes");
    // 16 de sal + 4 + 1 + 65 de chave + conteúdo + 1 delimitador + 16 de tag.
    assert.equal(pacote.length, 21 + 65 + 2 + 1 + 16);
  });

  it("recusa inscrição com chave do tamanho errado", () => {
    // Vem do banco, e uma linha truncada produziria um pacote que o navegador
    // descarta calado. Melhor falhar aqui, onde dá para ver.
    assert.throws(() => cifrar("oi", { endpoint: "https://x/y", p256dh: b64url(Buffer.alloc(10)), auth: b64url(randomBytes(16)) }), /65 bytes/);
    assert.throws(() => cifrar("oi", { endpoint: "https://x/y", p256dh: b64url(randomBytes(65)), auth: b64url(Buffer.alloc(3)) }), /16 bytes/);
  });
});

// ── VAPID ───────────────────────────────────────────────────────────────────

function chavesDeMentira(): ChavesVapid {
  const par = createECDH("prime256v1");
  par.generateKeys();
  return {
    publica: b64url(par.getPublicKey()),
    privada: b64url(par.getPrivateKey()),
    contato: "mailto:contato@avanest.com.br",
  };
}

describe("o token VAPID (RFC 8292)", () => {
  const chaves = chavesDeMentira();
  const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
  const agora = Date.UTC(2026, 7, 29, 12, 0, 0);
  const token = tokenVapid(chaves, endpoint, agora);

  it("a assinatura confere com a chave pública", () => {
    // Verificada com a chave PÚBLICA, que é o que o serviço de push faz.
    const [cab, corpo, assinatura] = token.split(".");
    const publica = createPublicKey({
      format: "jwk",
      key: {
        kty: "EC", crv: "P-256",
        x: b64url(deB64url(chaves.publica).subarray(1, 33)),
        y: b64url(deB64url(chaves.publica).subarray(33, 65)),
      },
    });
    assert.equal(verify("sha256", Buffer.from(`${cab}.${corpo}`),
      { key: publica, dsaEncoding: "ieee-p1363" }, deB64url(assinatura)), true);
  });

  it("a assinatura tem 64 bytes crus, e não DER", () => {
    // DER é o padrão do OpenSSL, tem tamanho variável, e faz o serviço de push
    // recusar com 401 sem dizer por quê. Este número é o bug inteiro.
    assert.equal(deB64url(token.split(".")[2]).length, 64);
  });

  it("o público é a origem do endpoint, sem o caminho", () => {
    // Mandar o endpoint inteiro no `aud` é recusado. Só o esquema e o host.
    const corpo = JSON.parse(deB64url(token.split(".")[1]).toString());
    assert.equal(corpo.aud, "https://fcm.googleapis.com");
    assert.equal(corpo.sub, "mailto:contato@avanest.com.br");
  });

  it("vale doze horas — o serviço recusa acima de vinte e quatro", () => {
    const corpo = JSON.parse(deB64url(token.split(".")[1]).toString());
    assert.equal(corpo.exp - Math.floor(agora / 1000), 12 * 60 * 60);
  });

  it("o algoritmo declarado é ES256", () => {
    const cab = JSON.parse(deB64url(token.split(".")[0]).toString());
    assert.deepEqual(cab, { typ: "JWT", alg: "ES256" });
  });

  it("origemDo tira o caminho de qualquer serviço", () => {
    assert.equal(origemDo("https://updates.push.services.mozilla.com/wpush/v2/xyz"),
      "https://updates.push.services.mozilla.com");
    assert.equal(origemDo("https://web.push.apple.com/QF1t...long"), "https://web.push.apple.com");
  });

  it("recusa chave de tamanho errado em vez de assinar lixo", () => {
    assert.throws(() => tokenVapid({ ...chaves, privada: b64url(Buffer.alloc(5)) }, endpoint),
      /privada inválida/);
    assert.throws(() => tokenVapid({ ...chaves, publica: b64url(Buffer.alloc(65)) }, endpoint),
      /pública inválida/);
  });
});

describe("os cabeçalhos do POST", () => {
  const chaves = chavesDeMentira();
  const h = cabecalhos(chaves, "https://fcm.googleapis.com/fcm/send/abc", 123);

  it("declara a codificação, que é o que o navegador usa para decidir como abrir", () => {
    assert.equal(h["Content-Encoding"], "aes128gcm");
  });

  it("manda o token e a chave pública juntos, no formato do RFC", () => {
    assert.match(h.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    assert.ok(h.Authorization.endsWith(`k=${chaves.publica}`));
  });

  it("quatro horas de fila", () => {
    // Aviso de escala que chega três dias depois manda ao plantão errado.
    assert.equal(h.TTL, "14400");
  });
});

describe("base64url", () => {
  it("não deixa passar +, / nem =", () => {
    // São os três que quebram o cabeçalho e a URL. Um "=" no fim já basta
    // para o serviço de push recusar o token.
    for (let i = 0; i < 50; i++) {
      const texto = b64url(randomBytes(32));
      assert.equal(/[+/=]/.test(texto), false, `saiu "${texto}"`);
    }
  });

  it("ida e volta devolve os mesmos bytes", () => {
    const bytes = randomBytes(65);
    assert.deepEqual([...deB64url(b64url(bytes))], [...bytes]);
  });
});
