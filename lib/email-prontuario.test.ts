import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  JANELA_AUTOMATICA_MS, PDF_MAXIMO, destinoDoProntuario, envioAutomatico, mascararEmail,
  mensagemDoProntuario, nomeDoArquivo, pdfAceito,
} from "./email-prontuario.ts";

describe("o destino do prontuário", () => {
  it("só aceita endereço válido, e limpo", () => {
    assert.equal(destinoDoProntuario("  Prontuario@Hospital.com.br "), "prontuario@hospital.com.br");
    assert.equal(destinoDoProntuario(""), null);
    assert.equal(destinoDoProntuario(null), null);
    assert.equal(destinoDoProntuario("prontuario"), null);
  });

  it("a tela vê o domínio, não o endereço inteiro", () => {
    assert.equal(mascararEmail("prontuario@hospital.com.br"), "pr•••@hospital.com.br");
    assert.equal(mascararEmail("sem-arroba"), "");
  });
});

describe("quando a tela manda sozinha", () => {
  const agora = Date.parse("2026-10-23T15:00:00Z");
  const base = { configurado: true, enviadaEm: null, agora };

  it("avaliação recém-concluída, ainda não enviada: manda", () => {
    assert.equal(envioAutomatico({ ...base, concluidaEm: "2026-10-23T14:00:00Z" }), true);
  });

  it("já enviada: não manda de novo", () => {
    assert.equal(envioAutomatico({ ...base, concluidaEm: "2026-10-23T14:00:00Z", enviadaEm: "2026-10-23T14:01:00Z" }), false);
  });

  it("local sem e-mail de prontuário: não manda", () => {
    assert.equal(envioAutomatico({ ...base, configurado: false, concluidaEm: "2026-10-23T14:00:00Z" }), false);
  });

  it("avaliação antiga reaberta para reimprimir: não manda sozinha", () => {
    // Um local que ganhou e-mail hoje não pode despachar a ficha de março
    // só porque alguém abriu para reimprimir.
    const antiga = new Date(agora - JANELA_AUTOMATICA_MS - 60_000).toISOString();
    assert.equal(envioAutomatico({ ...base, concluidaEm: antiga }), false);
  });

  it("rascunho não manda", () => {
    assert.equal(envioAutomatico({ ...base, concluidaEm: null }), false);
  });
});

describe("o arquivo", () => {
  const pdf = (tamanho: number) => {
    const bytes = new Uint8Array(tamanho);
    bytes.set([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    return bytes;
  };

  it("PDF de verdade passa", () => {
    assert.equal(pdfAceito(pdf(2048)), "ok");
  });

  it("qualquer outra coisa com nome de PDF não passa", () => {
    assert.equal(pdfAceito(new TextEncoder().encode("<html>não sou pdf</html>")), "formato");
  });

  it("vazio e grande demais são recusados", () => {
    assert.equal(pdfAceito(new Uint8Array()), "vazio");
    assert.equal(pdfAceito(pdf(PDF_MAXIMO + 1)), "grande");
  });

  it("o nome identifica paciente e data, sem acento", () => {
    assert.equal(
      nomeDoArquivo("Maria José da Conceição", "2026-10-23T14:00:00Z"),
      "avaliacao-pre-anestesica-maria-jose-da-conceicao-23-10-2026.pdf",
    );
  });
});

describe("a mensagem", () => {
  const msg = mensagemDoProntuario({
    paciente: "Maria <b>Souza</b>",
    anestesiologista: "Dr. Gustavo Segobia",
    crm: "CRM-PR 12345",
    local: "Santa Casa",
    concluidaEm: "2026-10-23T14:00:00Z",
    referencia: "AVA-1a2b3c4d · v1",
  });

  it("o assunto diz de quem é e de quando", () => {
    assert.equal(msg.assunto, "Avaliação pré-anestésica — Maria <b>Souza</b> — 23/10/2026");
  });

  it("texto do banco não vira HTML", () => {
    assert.ok(msg.html.includes("Maria &lt;b&gt;Souza&lt;/b&gt;"));
    assert.ok(!msg.html.includes("<b>Souza</b>"));
  });

  it("o texto puro diz o mesmo que o HTML", () => {
    for (const trecho of ["Santa Casa", "CRM-PR 12345", "AVA-1a2b3c4d · v1", "LGPD"]) {
      assert.ok(msg.texto.includes(trecho), trecho);
      assert.ok(msg.html.includes(trecho), trecho);
    }
  });

  it("campo vazio não vira linha com rótulo e nada", () => {
    const curta = mensagemDoProntuario({ paciente: "Ana" });
    assert.ok(!curta.texto.includes("Local:"));
    assert.ok(!curta.texto.includes("Anestesiologista:"));
  });
});
