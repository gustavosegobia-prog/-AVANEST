// ===========================================================================
// DER — o mínimo para montar uma assinatura CMS e ler um certificado X.509
// ===========================================================================
// POR QUE À MÃO, E NÃO UMA BIBLIOTECA. A assinatura usa meia dúzia de
// estruturas fixas (RFC 5652, RFC 5035, RFC 5126), e o que importa nelas é
// byte a byte: uma ordem errada num SET OF muda o resumo que o certificado
// assina, e a assinatura deixa de conferir. Escrever as poucas regras do DER
// aqui deixa cada byte à vista e no teste — que confere o resultado com o
// OpenSSL e o pdfsig, programas que não são nossos.
//
// O que NÃO está aqui: um leitor de ASN.1 genérico. `ler` anda só pelo que a
// assinatura precisa do certificado (emissor, número de série, chave).
// ===========================================================================

export const TAG = {
  inteiro: 0x02,
  octetos: 0x04,
  nulo: 0x05,
  oid: 0x06,
  ia5: 0x16,
  sequencia: 0x30,
  conjunto: 0x31,
} as const;

function comprimento(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  const bytes: number[] = [];
  for (let resto = n; resto > 0; resto = Math.floor(resto / 256)) bytes.unshift(resto & 0xff);
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

export function juntar(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.length; }
  return saida;
}

/** Um elemento: etiqueta, comprimento e conteúdo. */
export function tlv(tag: number, ...conteudo: Uint8Array[]): Uint8Array {
  const corpo = juntar(...conteudo);
  return juntar(Uint8Array.of(tag), comprimento(corpo.length), corpo);
}

export const sequencia = (...p: Uint8Array[]) => tlv(TAG.sequencia, ...p);
export const octetos = (b: Uint8Array) => tlv(TAG.octetos, b);
export const nulo = () => Uint8Array.of(TAG.nulo, 0);
export const ia5 = (texto: string) => tlv(TAG.ia5, new TextEncoder().encode(texto));
export const inteiroPequeno = (n: number) => tlv(TAG.inteiro, Uint8Array.of(n));

/** [n] construído: EXPLICIT, ou o IMPLICIT de um SET/SEQUENCE. */
export const contexto = (n: number, ...p: Uint8Array[]) => tlv(0xa0 | n, ...p);

/**
 * SET OF em DER: os elementos em ordem crescente de codificação (X.690,
 * 11.6). Os atributos assinados são um SET OF, e o resumo que o certificado
 * assina é o deles REcodificados em DER por quem confere — fora de ordem, o
 * resumo de quem confere sai outro.
 */
export function conjuntoOrdenado(...elementos: Uint8Array[]): Uint8Array {
  const ordem = [...elementos].sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
    return a.length - b.length;
  });
  return tlv(TAG.conjunto, ...ordem);
}

export function oid(texto: string): Uint8Array {
  const arcos = texto.split(".").map((x) => {
    if (!/^\d+$/.test(x)) throw new Error(`OID inválido: ${texto}`);
    return BigInt(x);
  });
  if (arcos.length < 2) throw new Error(`OID inválido: ${texto}`);
  const bytes: number[] = [];
  // BigInt(), e não literais 7n: o alvo do TypeScript do projeto é anterior ao ES2020.
  const [zero, sete, mascara, quarenta] = [BigInt(0), BigInt(7), BigInt(0x7f), BigInt(40)];
  const base128 = (v: bigint) => {
    const grupo: number[] = [Number(v & mascara)];
    for (let r = v >> sete; r > zero; r >>= sete) grupo.unshift(Number(r & mascara) | 0x80);
    bytes.push(...grupo);
  };
  base128(arcos[0] * quarenta + arcos[1]);
  for (const a of arcos.slice(2)) base128(a);
  return tlv(TAG.oid, Uint8Array.from(bytes));
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export type No = {
  tag: number;
  /** Onde o elemento começa (a etiqueta) e onde termina, no buffer lido. */
  inicio: number;
  fim: number;
  /** Onde começa o conteúdo, depois da etiqueta e do comprimento. */
  corpo: number;
};

export function ler(buf: Uint8Array, pos = 0): No {
  if (pos + 2 > buf.length) throw new Error("DER truncado");
  const tag = buf[pos];
  let n = buf[pos + 1];
  let corpo = pos + 2;
  if (n & 0x80) {
    const quantos = n & 0x7f;
    if (quantos === 0 || quantos > 4) throw new Error("DER com comprimento indefinido ou grande demais");
    n = 0;
    for (let i = 0; i < quantos; i++) n = n * 256 + buf[corpo + i];
    corpo += quantos;
  }
  const fim = corpo + n;
  if (fim > buf.length) throw new Error("DER truncado");
  return { tag, inicio: pos, fim, corpo };
}

/** Os filhos de um elemento construído. */
export function filhos(buf: Uint8Array, pai: No): No[] {
  const lista: No[] = [];
  for (let pos = pai.corpo; pos < pai.fim;) {
    const f = ler(buf, pos);
    lista.push(f);
    pos = f.fim;
  }
  return lista;
}

export const bruto = (buf: Uint8Array, no: No) => buf.subarray(no.inicio, no.fim);
export const conteudo = (buf: Uint8Array, no: No) => buf.subarray(no.corpo, no.fim);

export type PartesDoCertificado = {
  /** O certificado inteiro, em DER. */
  der: Uint8Array;
  /** O Name do emissor, em DER, como está no certificado. */
  emissor: Uint8Array;
  /** O número de série como o INTEGER inteiro (etiqueta incluída). */
  serie: Uint8Array;
};

/**
 * Tira do certificado o que a assinatura cita: o emissor e o número de série
 * (IssuerAndSerialNumber), copiados byte a byte — recodificar o nome do
 * emissor arriscaria mudar uma letra de tipo de string e o validador não
 * acharia o certificado.
 */
export function partesDoCertificado(der: Uint8Array): PartesDoCertificado {
  const cert = ler(der);
  if (cert.tag !== TAG.sequencia || cert.fim !== der.length) throw new Error("Certificado mal formado");
  const [tbs] = filhos(der, cert);
  const campos = filhos(der, tbs);
  // [0] version é opcional: quando está, o número de série é o segundo campo.
  const i = campos[0]?.tag === 0xa0 ? 1 : 0;
  const serie = campos[i];
  const emissor = campos[i + 2];
  if (serie?.tag !== TAG.inteiro || emissor?.tag !== TAG.sequencia) throw new Error("Certificado mal formado");
  return { der, emissor: bruto(der, emissor), serie: bruto(der, serie) };
}
