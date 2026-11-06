// ===========================================================================
// A assinatura CMS destacada (CAdES) que vai dentro do PDF
// ===========================================================================
// O PDF assinado no padrão PAdES leva, no /Contents da assinatura, um
// SignedData (RFC 5652) SEM o conteúdo: o resumo do PDF vai num atributo
// assinado, e o certificado assina o resumo desses atributos.
//
// QUEM ASSINA NÃO É ESTE CÓDIGO. A chave privada do médico fica no prestador
// de serviço de confiança (o VIDaaS, no caso dele), e nunca passa por aqui.
// Montamos os atributos, tiramos o SHA-256 deles e mandamos SÓ esse resumo; o
// PSC devolve a assinatura RSA, e ela entra no SignerInfo. É o modo RAW do
// IntegraICP: "O documento original não é enviado para a API".
// ===========================================================================

import { createHash } from "node:crypto";
import {
  conjuntoOrdenado, contexto, ia5, inteiroPequeno, nulo, octetos, oid, partesDoCertificado,
  sequencia, tlv,
} from "./der.ts";
import { OID, POLITICA_PADES_AD_RB } from "./politica.ts";

const sha256 = (dados: Uint8Array) => new Uint8Array(createHash("sha256").update(dados).digest());
const hexParaBytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));

/** AlgorithmIdentifier do SHA-256, sem parâmetros (RFC 5754, 2). */
const algSha256 = () => sequencia(oid(OID.sha256));
const atributo = (tipo: string, valor: Uint8Array) => sequencia(oid(tipo), conjuntoOrdenado(valor));

/**
 * signing-certificate-v2 (RFC 5035): o resumo do certificado do signatário e
 * quem o emitiu, para ninguém trocar o certificado depois de assinado. O
 * algoritmo do resumo é o padrão (SHA-256) e por isso NÃO é escrito: em DER,
 * valor igual ao DEFAULT fica de fora.
 */
function certificadoDoSignatario(certificado: Uint8Array): Uint8Array {
  const { emissor, serie } = partesDoCertificado(certificado);
  const emissorSerial = sequencia(
    sequencia(tlv(0xa4, emissor)), // GeneralNames { directoryName [4] }
    serie,
  );
  const essCertIdV2 = sequencia(octetos(sha256(certificado)), emissorSerial);
  return sequencia(sequencia(essCertIdV2));
}

/** signature-policy-identifier (RFC 5126, 5.8.1): a PA_PAdES_AD_RB do ITI. */
function politicaDeAssinatura(): Uint8Array {
  return sequencia(
    oid(POLITICA_PADES_AD_RB.oid),
    sequencia(algSha256(), octetos(hexParaBytes(POLITICA_PADES_AD_RB.resumoSha256))),
    sequencia(sequencia(oid(OID.qualificadorUri), ia5(POLITICA_PADES_AD_RB.uri))),
  );
}

export type AtributosAssinados = {
  /** O SET OF em DER: é o resumo disto que o certificado assina. */
  paraAssinar: Uint8Array;
  /** O mesmo conteúdo com a etiqueta [0] IMPLICIT, como vai no SignerInfo. */
  noSignerInfo: Uint8Array;
};

export function atributosAssinados(resumoDoPdf: Uint8Array, certificado: Uint8Array): AtributosAssinados {
  if (resumoDoPdf.length !== 32) throw new Error("O resumo do PDF precisa ser um SHA-256 (32 bytes).");
  const paraAssinar = conjuntoOrdenado(
    atributo(OID.tipoDeConteudo, oid(OID.dados)),
    atributo(OID.resumoDaMensagem, octetos(resumoDoPdf)),
    atributo(OID.certificadoDoSignatarioV2, certificadoDoSignatario(certificado)),
    atributo(OID.politicaDeAssinatura, politicaDeAssinatura()),
  );
  const noSignerInfo = paraAssinar.slice();
  noSignerInfo[0] = 0xa0;
  return { paraAssinar, noSignerInfo };
}

/** O resumo que vai ao PSC: SHA-256 dos atributos assinados. */
export const resumoDosAtributos = (a: AtributosAssinados) => sha256(a.paraAssinar);

/**
 * DigestInfo (RFC 8017, 9.2) de um SHA-256. A assinatura RSA PKCS#1 v1.5 é a
 * operação privada sobre isto. Serve ao assinador de teste e para conferir o
 * que o PSC devolve.
 */
export function digestInfoSha256(resumo: Uint8Array): Uint8Array {
  return sequencia(sequencia(oid(OID.sha256), nulo()), octetos(resumo));
}

export type PacoteDaAssinatura = {
  atributos: AtributosAssinados;
  /** A assinatura RSA PKCS#1 v1.5 dos atributos, como o PSC a devolveu. */
  assinatura: Uint8Array;
  /** O certificado do signatário, em DER. */
  certificado: Uint8Array;
  /** A cadeia até a raiz, em DER, sem o do signatário. Vai junto para o validador montar o caminho. */
  cadeia?: Uint8Array[];
};

/** O ContentInfo { SignedData } destacado, pronto para o /Contents do PDF. */
export function montarSignedData(p: PacoteDaAssinatura): Uint8Array {
  const { emissor, serie } = partesDoCertificado(p.certificado);
  const signerInfo = sequencia(
    inteiroPequeno(1),
    sequencia(emissor, serie), // IssuerAndSerialNumber
    algSha256(),
    p.atributos.noSignerInfo,
    sequencia(oid(OID.sha256ComRsa), nulo()),
    octetos(p.assinatura),
  );
  const signedData = sequencia(
    inteiroPequeno(1),
    conjuntoOrdenado(algSha256()),
    sequencia(oid(OID.dados)), // encapContentInfo sem eContent: destacada
    contexto(0, p.certificado, ...(p.cadeia ?? [])),
    conjuntoOrdenado(signerInfo),
  );
  return sequencia(oid(OID.dadosAssinados), contexto(0, signedData));
}
