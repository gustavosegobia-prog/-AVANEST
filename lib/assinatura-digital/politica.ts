// ===========================================================================
// A política de assinatura ICP-Brasil que o AVANEST usa nos PDFs
// ===========================================================================
// PA_PAdES_AD_RB v1.3 — "Referência Básica" para PDF (DOC-ICP-15.03). É a
// versão vigente na Lista de Políticas de Assinatura do ITI
// (http://politicas.icpbrasil.gov.br/LPA_PAdES.der), com período de uso de
// 23/07/2025 a 22/10/2037. A v1.2 foi revogada em 23/07/2025.
//
// Conferido em 06/11/2026: o resumo SHA-256 do arquivo da política, baixado do
// endereço abaixo, é o mesmo que a LPA publica para ela. O validador do ITI
// recalcula esse resumo; um dígito errado aqui e a assinatura sai "fora da
// política", ainda que o certificado seja bom.
//
// A política exige quatro atributos assinados: content-type, message-digest,
// signing-certificate-v2 e signature-policy-identifier. O horário da
// assinatura vai no dicionário da assinatura do PDF (/M), como manda o PAdES,
// e não num atributo signing-time.
// ===========================================================================

export const POLITICA_PADES_AD_RB = {
  nome: "PA_PAdES_AD_RB_v1_3",
  oid: "2.16.76.1.7.1.11.1.3",
  uri: "http://politicas.icpbrasil.gov.br/PA_PAdES_AD_RB_v1_3.der",
  /** SHA-256 do arquivo da política, como a LPA publica. */
  resumoSha256: "23da544aef71f7a75dc85fa6e17a83875741e4baef41ec178258a5c86ace54dd",
  valeAte: "2037-10-22",
} as const;

/** Os identificadores que a assinatura usa (RFC 5652, 5035, 5126, 8017). */
export const OID = {
  dados: "1.2.840.113549.1.7.1",
  dadosAssinados: "1.2.840.113549.1.7.2",
  sha256: "2.16.840.1.101.3.4.2.1",
  sha256ComRsa: "1.2.840.113549.1.1.11",
  rsa: "1.2.840.113549.1.1.1",
  tipoDeConteudo: "1.2.840.113549.1.9.3",
  resumoDaMensagem: "1.2.840.113549.1.9.4",
  certificadoDoSignatarioV2: "1.2.840.113549.1.9.16.2.47",
  politicaDeAssinatura: "1.2.840.113549.1.9.16.2.15",
  qualificadorUri: "1.2.840.113549.1.9.16.5.1",
} as const;
