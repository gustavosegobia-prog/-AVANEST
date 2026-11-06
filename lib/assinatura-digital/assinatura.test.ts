import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { constants, createPrivateKey, privateEncrypt, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AssinaturaRecusada, assinarPdf, type Assinador } from "./assinar.ts";
import { digestInfoSha256 } from "./cms.ts";
import { ler, oid } from "./der.ts";
import { PdfNaoSuportado, prepararPdf } from "./pdf.ts";
import { POLITICA_PADES_AD_RB } from "./politica.ts";

// A conferência é feita por programas que não são nossos: o OpenSSL confere o
// CMS, e o pdfsig (poppler) confere o PDF como um leitor de PDF faria. Sem
// eles na máquina, os testes que dependem deles são pulados — e dizem isso.
const temOpenssl = spawnSync("openssl", ["version"]).status === 0;
const temPdfsig = spawnSync("pdfsig", ["-v"]).status === 0;

/** Uma autoridade certificadora FICTÍCIA e um médico fictício, só para o teste. */
function autoridadeDeTeste() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avanest-icp-teste-"));
  const openssl = (...args: string[]) => execFileSync("openssl", args, { cwd: dir, stdio: "pipe" });
  openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "raiz.key", "-out", "raiz.pem", "-days", "3650",
    "-subj", "/C=BR/O=ICP-Brasil TESTE/CN=AC Raiz Ficticia de Teste",
    "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign");
  openssl("req", "-newkey", "rsa:2048", "-nodes", "-keyout", "titular.key", "-out", "titular.csr",
    "-subj", "/C=BR/O=ICP-Brasil TESTE/OU=Certificado PF A3/CN=MEDICO FICTICIO DE TESTE:00000000191");
  fs.writeFileSync(path.join(dir, "ext.cnf"), "basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,nonRepudiation\n");
  openssl("x509", "-req", "-in", "titular.csr", "-CA", "raiz.pem", "-CAkey", "raiz.key", "-CAcreateserial",
    "-out", "titular.pem", "-days", "365", "-extfile", "ext.cnf");
  const der = (pem: string) => new Uint8Array(execFileSync("openssl", ["x509", "-in", pem, "-outform", "DER"], { cwd: dir }));
  const chave = createPrivateKey(fs.readFileSync(path.join(dir, "titular.key")));
  const assinador: Assinador = {
    certificado: async () => ({ certificado: der("titular.pem"), cadeia: [der("raiz.pem")] }),
    // O que um PSC faz no modo RAW: a operação privada sobre o DigestInfo.
    assinarResumo: async (resumo) =>
      new Uint8Array(privateEncrypt({ key: chave, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(digestInfoSha256(resumo)))),
  };
  return { dir, assinador };
}

/** Um PDF como o da tela de documentos: jsPDF, A4, duas páginas, dados fictícios. */
async function pdfDeTeste(): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.text("Avaliação pré-anestésica — PACIENTE FICTÍCIO", 15, 20);
  pdf.addPage("a4", "portrait");
  pdf.text("Página 2", 15, 20);
  return new Uint8Array(pdf.output("arraybuffer"));
}

/** O CMS e os bytes cobertos, lidos do PDF assinado como um validador os leria. */
function partesDoAssinado(pdf: Uint8Array) {
  const texto = Buffer.from(pdf).toString("latin1");
  const [a, b, c, d] = (/\/ByteRange \[([^\]]+)\]/.exec(texto)?.[1] ?? "").trim().split(/\s+/).map(Number);
  const hex = texto.slice(b + 1, c - 1);
  const cheio = Uint8Array.from(Buffer.from(hex, "hex"));
  const cms = cheio.subarray(0, ler(cheio).fim);
  const dados = Buffer.concat([Buffer.from(pdf.subarray(a, a + b)), Buffer.from(pdf.subarray(c, c + d))]);
  return { cms, dados, byteRange: [a, b, c, d] };
}

test("DER: OID e política ICP-Brasil escritos como a norma pede", () => {
  // 1.2.840.113549 → 06 06 2A 86 48 86 F7 0D (exemplo clássico do X.690).
  assert.equal(Buffer.from(oid("1.2.840.113549")).toString("hex"), "06062a864886f70d");
  assert.match(POLITICA_PADES_AD_RB.oid, /^2\.16\.76\.1\.7\.1\.11\.1\.\d+$/, "a política é uma PA_PAdES_AD_RB");
  assert.match(POLITICA_PADES_AD_RB.resumoSha256, /^[0-9a-f]{64}$/);
  assert.ok(POLITICA_PADES_AD_RB.uri.endsWith(`${POLITICA_PADES_AD_RB.nome}.der`));
  assert.ok(new Date(POLITICA_PADES_AD_RB.valeAte) > new Date("2030-01-01"));
});

test("assinatura PAdES: o OpenSSL confere o CMS e o pdfsig confere o PDF", { skip: !temOpenssl && "sem openssl" }, async () => {
  const { dir, assinador } = autoridadeDeTeste();
  const original = await pdfDeTeste();
  const r = await assinarPdf(original, assinador, { motivo: "Avaliação pré-anestésica" });

  // Atualização incremental: o documento original continua byte a byte no começo.
  assert.equal(Buffer.compare(Buffer.from(r.pdf.subarray(0, original.length)), Buffer.from(original)), 0);
  assert.equal(r.titular, "MEDICO FICTICIO DE TESTE");
  assert.equal(r.cpf, "00000000191");
  assert.equal(r.politica, "PA_PAdES_AD_RB_v1_3");
  assert.match(r.resumo, /^[0-9a-f]{64}$/);

  const { cms, dados, byteRange } = partesDoAssinado(r.pdf);
  assert.equal(byteRange[0], 0);
  assert.equal(byteRange[2] + byteRange[3], r.pdf.length, "a assinatura cobre o arquivo até o último byte");
  fs.writeFileSync(path.join(dir, "cms.der"), cms);
  fs.writeFileSync(path.join(dir, "dados.bin"), dados);

  const conferencia = spawnSync("openssl", ["cms", "-verify", "-inform", "DER", "-in", "cms.der", "-content", "dados.bin",
    "-binary", "-CAfile", "raiz.pem", "-purpose", "any", "-out", os.devNull], { cwd: dir, encoding: "utf8" });
  assert.equal(conferencia.status, 0, conferencia.stderr);
  assert.match(conferencia.stderr, /Verification successful/);

  const estrutura = execFileSync("openssl", ["cms", "-cmsout", "-print", "-inform", "DER", "-in", "cms.der"], { cwd: dir, encoding: "utf8" });
  assert.match(estrutura, new RegExp(POLITICA_PADES_AD_RB.oid.replace(/\./g, "\\.")), "a política ICP-Brasil está nos atributos");
  assert.match(estrutura, /id-smime-aa-signingCertificateV2/);
  assert.match(estrutura, /id-smime-aa-ets-sigPolicyId/);
  assert.doesNotMatch(estrutura, /signingTime/, "no PAdES o horário vai no /M, e não num atributo");

  if (temPdfsig) {
    fs.writeFileSync(path.join(dir, "assinado.pdf"), r.pdf);
    const saida = execFileSync("pdfsig", ["assinado.pdf"], { cwd: dir, encoding: "utf8" });
    assert.match(saida, /Signature Validation: Signature is Valid\./);
    assert.match(saida, /ETSI\.CAdES\.detached/);
    assert.match(saida, /MEDICO FICTICIO DE TESTE/);
  }
});

test("um byte mudado depois de assinado e a assinatura deixa de valer", { skip: !temOpenssl && "sem openssl" }, async () => {
  const { dir, assinador } = autoridadeDeTeste();
  const r = await assinarPdf(await pdfDeTeste(), assinador, { motivo: "Folha de anestesia" });
  const adulterado = r.pdf.slice();
  const pos = Buffer.from(adulterado).indexOf("jsPDF");
  adulterado[pos] = "J".charCodeAt(0);

  const { cms, dados } = partesDoAssinado(adulterado);
  fs.writeFileSync(path.join(dir, "cms.der"), cms);
  fs.writeFileSync(path.join(dir, "dados.bin"), dados);
  const conferencia = spawnSync("openssl", ["cms", "-verify", "-inform", "DER", "-in", "cms.der", "-content", "dados.bin",
    "-binary", "-CAfile", "raiz.pem", "-purpose", "any", "-out", os.devNull], { cwd: dir, encoding: "utf8" });
  assert.notEqual(conferencia.status, 0, "o OpenSSL não pode aceitar o PDF mexido");

  if (temPdfsig) {
    fs.writeFileSync(path.join(dir, "adulterado.pdf"), adulterado);
    const saida = spawnSync("pdfsig", ["adulterado.pdf"], { cwd: dir, encoding: "utf8" }).stdout;
    assert.doesNotMatch(saida, /Signature is Valid/);
  }
});

test("PSC que devolve outra coisa: a assinatura é recusada antes de entrar no PDF", { skip: !temOpenssl && "sem openssl" }, async () => {
  const { assinador } = autoridadeDeTeste();
  const errado: Assinador = { ...assinador, assinarResumo: async () => new Uint8Array(randomBytes(256)) };
  await assert.rejects(assinarPdf(await pdfDeTeste(), errado, { motivo: "Teste" }), AssinaturaRecusada);
});

test("certificado fora da validade é recusado", { skip: !temOpenssl && "sem openssl" }, async () => {
  const { assinador } = autoridadeDeTeste();
  await assert.rejects(
    assinarPdf(await pdfDeTeste(), assinador, { motivo: "Teste", quando: new Date("2040-01-01") }),
    AssinaturaRecusada,
  );
});

test("PDF que o código não entende é recusado com frase clara, e não assinado no escuro", () => {
  const xrefComprimida = new TextEncoder().encode("%PDF-1.5\n1 0 obj\n<< /Type /XRef >>\nendobj\nstartxref\n9\n%%EOF\n");
  assert.throws(() => prepararPdf(xrefComprimida, { nome: "X", motivo: "Y", quando: new Date() }), PdfNaoSuportado);
  assert.throws(() => prepararPdf(new TextEncoder().encode("não é pdf"), { nome: "X", motivo: "Y", quando: new Date() }), PdfNaoSuportado);
});
