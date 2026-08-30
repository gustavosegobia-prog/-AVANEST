import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { enderecoValido, provedorDeEmail, separarRemetente } from "./email.ts";

const CHAVES = ["RESEND_API_KEY", "SENDGRID_API_KEY", "EMAIL_PROVEDOR", "EMAIL_REMETENTE"];
const guardadas = Object.fromEntries(CHAVES.map((c) => [c, process.env[c]]));

afterEach(() => {
  for (const c of CHAVES) {
    if (guardadas[c] === undefined) delete process.env[c];
    else process.env[c] = guardadas[c];
  }
});

function ambiente(vars: Record<string, string | undefined>) {
  for (const c of CHAVES) delete process.env[c];
  for (const [k, v] of Object.entries(vars)) if (v !== undefined) process.env[k] = v;
}

describe("quem manda o e-mail", () => {
  it("sem chave nenhuma, ninguém manda", () => {
    ambiente({});
    assert.equal(provedorDeEmail(), null);
  });

  it("quem tem chave, manda", () => {
    ambiente({ RESEND_API_KEY: "re_x" });
    assert.equal(provedorDeEmail(), "resend");
    ambiente({ SENDGRID_API_KEY: "SG.x" });
    assert.equal(provedorDeEmail(), "sendgrid");
  });

  it("EMAIL_PROVEDOR decide quando os dois estão configurados", () => {
    // O dia da migração é o único em que as duas chaves convivem, e é
    // justamente quando não pode haver dúvida sobre qual está mandando.
    ambiente({ RESEND_API_KEY: "re_x", SENDGRID_API_KEY: "SG.x" });
    assert.equal(provedorDeEmail(), "resend", "sem escolha, vale a ordem declarada");
    ambiente({ RESEND_API_KEY: "re_x", SENDGRID_API_KEY: "SG.x", EMAIL_PROVEDOR: "sendgrid" });
    assert.equal(provedorDeEmail(), "sendgrid");
  });

  it("provedor escolhido SEM a chave dele não cai no outro escondido", () => {
    // Cair no outro faria a mensagem sair por um remetente que o cliente não
    // espera, e ninguém perceberia que a variável estava escrita errada.
    ambiente({ RESEND_API_KEY: "re_x", EMAIL_PROVEDOR: "sendgrid" });
    assert.equal(provedorDeEmail(), null);
  });
});

describe("o remetente", () => {
  it("separa nome e endereço", () => {
    // O Resend engole a linha inteira; o SendGrid recusa o JSON se vier junto.
    assert.deepEqual(separarRemetente("AVANEST <contato@avanest.com.br>"),
      { nome: "AVANEST", email: "contato@avanest.com.br" });
  });

  it("endereço solto continua sendo endereço", () => {
    assert.deepEqual(separarRemetente("contato@avanest.com.br"),
      { nome: "", email: "contato@avanest.com.br" });
  });

  it("as aspas não fazem parte do nome", () => {
    assert.deepEqual(separarRemetente('"AVANEST, Anestesia" <c@a.br>'),
      { nome: "AVANEST, Anestesia", email: "c@a.br" });
  });

  it("espaço sobrando não vira endereço inválido", () => {
    assert.equal(separarRemetente("  AVANEST  <  c@a.br  >  ").email, "c@a.br");
  });
});

describe("o endereço do destinatário", () => {
  it("aceita o que parece e-mail e recusa o resto", () => {
    for (const bom of ["a@b.co", "dr.gustavo@avanest.com.br"]) {
      assert.ok(enderecoValido(bom), bom);
    }
    for (const ruim of ["", "sem-arroba", "a@b", "a b@c.co", "@b.co"]) {
      assert.equal(enderecoValido(ruim), false, `devia recusar: ${JSON.stringify(ruim)}`);
    }
  });
});

describe("o que vai para cada serviço", () => {
  async function corpoEnviado(vars: Record<string, string>) {
    const fetchOriginal = globalThis.fetch;
    let url = "", corpo = "";
    ambiente(vars);
    globalThis.fetch = (async (u: string, init: { body?: string }) => {
      url = String(u);
      corpo = String(init?.body ?? "");
      return { ok: true, status: 202, headers: { get: () => "id-123" },
               text: async () => "", json: async () => ({ id: "re_1" }) };
    }) as unknown as typeof fetch;
    try {
      const { enviarEmail } = await import("./email.ts");
      const r = await enviarEmail({
        para: "cliente@exemplo.com", assunto: "Assinatura ativa",
        html: "<p>oi</p>", texto: "oi",
      });
      return { url, corpo: JSON.parse(corpo || "{}"), r };
    } finally {
      globalThis.fetch = fetchOriginal;
    }
  }

  it("o SendGrid recebe nome e endereço separados", async () => {
    const { url, corpo, r } = await corpoEnviado({
      SENDGRID_API_KEY: "SG.x", EMAIL_REMETENTE: "AVANEST <contato@avanest.com.br>",
    });
    assert.match(url, /api\.sendgrid\.com/);
    assert.deepEqual(corpo.from, { email: "contato@avanest.com.br", name: "AVANEST" });
    assert.deepEqual(corpo.personalizations, [{ to: [{ email: "cliente@exemplo.com" }] }]);
    assert.equal(r.ok, true);
  });

  it("no SendGrid o HTML vem DEPOIS do texto puro", async () => {
    // O SendGrid trata a última parte como a preferida. Invertido, o cliente
    // veria a versão sem formatação — que existe só para o filtro de spam.
    const { corpo } = await corpoEnviado({ SENDGRID_API_KEY: "SG.x" });
    assert.deepEqual(corpo.content.map((c: { type: string }) => c.type),
      ["text/plain", "text/html"]);
  });

  it("o Resend recebe a linha inteira do remetente", async () => {
    const { url, corpo } = await corpoEnviado({
      RESEND_API_KEY: "re_x", EMAIL_REMETENTE: "AVANEST <contato@avanest.com.br>",
    });
    assert.match(url, /api\.resend\.com/);
    assert.equal(corpo.from, "AVANEST <contato@avanest.com.br>");
    assert.deepEqual(corpo.to, ["cliente@exemplo.com"]);
  });

  it("os dois mandam as DUAS versões do corpo", async () => {
    // Mensagem só-HTML pontua alto em filtro de spam, e um aviso de assinatura
    // na caixa de lixo não tem segunda chance.
    const sg = await corpoEnviado({ SENDGRID_API_KEY: "SG.x" });
    assert.ok(sg.corpo.content.some((c: { value: string }) => c.value === "<p>oi</p>"));
    assert.ok(sg.corpo.content.some((c: { value: string }) => c.value === "oi"));
    const re = await corpoEnviado({ RESEND_API_KEY: "re_x" });
    assert.equal(re.corpo.html, "<p>oi</p>");
    assert.equal(re.corpo.text, "oi");
  });
});
