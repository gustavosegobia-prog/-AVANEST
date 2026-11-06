// ===========================================================================
// Assinar um PDF com certificado ICP-Brasil em nuvem (PAdES AD-RB)
// ===========================================================================
// O caminho inteiro, numa função:
//   1. o PSC diz qual é o certificado do médico;
//   2. o PDF ganha o espaço da assinatura (pdf.ts);
//   3. o resumo dos bytes cobertos vira o message-digest dos atributos (cms.ts);
//   4. o PSC assina o resumo dos atributos — e só ele sai daqui;
//   5. a assinatura devolvida é CONFERIDA com a chave do certificado antes de
//      entrar no PDF. Um PSC que devolvesse outra coisa (outra chave, outro
//      formato) daria um PDF "assinado" que nenhum validador aceita, e o médico
//      só saberia no dia em que precisasse dele.
//
// O `Assinador` é a fronteira com o PSC. O do VIDaaS (IntegraICP) entra quando
// a Valid liberar o canal e a documentação; o de teste (no teste) usa uma
// autoridade certificadora fictícia.
// ===========================================================================

import { X509Certificate, createHash, verify } from "node:crypto";
import { atributosAssinados, montarSignedData, resumoDosAtributos } from "./cms.ts";
import { bytesAssinados, inserirAssinatura, prepararPdf } from "./pdf.ts";
import { POLITICA_PADES_AD_RB } from "./politica.ts";

export type Assinador = {
  /** O certificado do titular e a cadeia até a raiz, em DER. */
  certificado(): Promise<{ certificado: Uint8Array; cadeia: Uint8Array[] }>;
  /**
   * Assina o SHA-256 recebido: RSA PKCS#1 v1.5 sobre DigestInfo(SHA-256) — o
   * mesmo resultado de "SHA256withRSA" sobre os atributos.
   */
  assinarResumo(resumoSha256: Uint8Array): Promise<Uint8Array>;
};

export type PdfAssinado = {
  pdf: Uint8Array;
  /** SHA-256 do PDF assinado, em hexadecimal: o que se guarda para provar o arquivo depois. */
  resumo: string;
  titular: string;
  /** O CPF do titular, quando o certificado ICP-Brasil o traz no nome. */
  cpf: string | null;
  serie: string;
  emissor: string;
  quando: Date;
  politica: string;
};

export class AssinaturaRecusada extends Error {}

/** "NOME DO MÉDICO:12345678900" → nome e CPF, como a ICP-Brasil escreve o CN de pessoa física. */
export function titularDoCertificado(cert: X509Certificate): { nome: string; cpf: string | null } {
  const cn = /(?:^|\n)CN=([^\n]+)/.exec(cert.subject)?.[1]?.trim() ?? "";
  const m = /^(.*?):(\d{11})$/.exec(cn);
  return m ? { nome: m[1].trim(), cpf: m[2] } : { nome: cn, cpf: null };
}

export async function assinarPdf(
  original: Uint8Array,
  assinador: Assinador,
  o: { motivo: string; quando?: Date },
): Promise<PdfAssinado> {
  const quando = o.quando ?? new Date();
  const { certificado, cadeia } = await assinador.certificado();
  const cert = new X509Certificate(Buffer.from(certificado));
  if (quando < new Date(cert.validFrom) || quando > new Date(cert.validTo)) {
    throw new AssinaturaRecusada("O certificado do titular está fora da validade.");
  }
  if (cert.publicKey.asymmetricKeyType !== "rsa") {
    throw new AssinaturaRecusada("Só certificados RSA são aceitos por enquanto.");
  }
  const { nome, cpf } = titularDoCertificado(cert);

  const preparado = prepararPdf(original, { nome, motivo: o.motivo, quando });
  const resumoDoPdf = new Uint8Array(createHash("sha256").update(bytesAssinados(preparado)).digest());
  const atributos = atributosAssinados(resumoDoPdf, certificado);
  const assinatura = await assinador.assinarResumo(resumoDosAtributos(atributos));

  if (!verify("sha256", atributos.paraAssinar, cert.publicKey, assinatura)) {
    throw new AssinaturaRecusada("A assinatura devolvida não confere com o certificado do titular.");
  }

  const pdf = inserirAssinatura(preparado, montarSignedData({ atributos, assinatura, certificado, cadeia }));
  return {
    pdf,
    resumo: createHash("sha256").update(pdf).digest("hex"),
    titular: nome,
    cpf,
    serie: cert.serialNumber,
    emissor: cert.issuer.replace(/\n/g, ", "),
    quando,
    politica: POLITICA_PADES_AD_RB.nome,
  };
}
