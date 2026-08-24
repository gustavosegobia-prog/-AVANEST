import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { conferirWebhook, fimDoPeriodoGratis, lerEvento } from "./stripe.ts";

// O que estes testes protegem é dinheiro e acesso: uma conta errada aqui vira
// cliente pagando sem entrar, ou entrando sem pagar. Nenhum deles chama a API
// do Stripe — o que se testa é a aritmética das datas, a conferência da
// assinatura do webhook e a tradução dos eventos.

const SEGREDO = "whsec_teste_nao_e_real";

function assinar(corpo: string, t: number, segredo = SEGREDO) {
  const v1 = createHmac("sha256", segredo).update(`${t}.${corpo}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

// ---------------------------------------------------------------------------
describe("fimDoPeriodoGratis", () => {
  const emUTC = (segundos: number) => new Date(segundos * 1000).toISOString().slice(0, 10);

  it("sem campanha não manda trial nenhum", () => {
    // undefined, e não "agora": trial_end no passado faz o Stripe recusar a
    // sessão inteira, e o cliente veria erro no lugar do checkout.
    assert.equal(fimDoPeriodoGratis(0, new Date("2026-09-10T12:00:00Z")), undefined);
  });

  it("dois meses caem no mesmo dia do mês", () => {
    const fim = fimDoPeriodoGratis(2, new Date("2026-09-10T12:00:00Z"));
    assert.equal(emUTC(fim!), "2026-11-10");
  });

  it("um mês a partir do dia 31 não transborda para o mês seguinte", () => {
    // 31/08 + 1 mês daria 31/09, que não existe: o Date rolaria para 01/10 e o
    // cliente seria cobrado um dia depois do combinado.
    const fim = fimDoPeriodoGratis(1, new Date("2026-08-31T12:00:00Z"));
    assert.equal(emUTC(fim!), "2026-09-30");
  });

  it("atravessa a virada do ano", () => {
    const fim = fimDoPeriodoGratis(2, new Date("2026-12-15T12:00:00Z"));
    assert.equal(emUTC(fim!), "2027-02-15");
  });

  it("cai em fevereiro sem inventar dia 30", () => {
    const fim = fimDoPeriodoGratis(2, new Date("2026-12-31T12:00:00Z"));
    assert.equal(emUTC(fim!), "2027-02-28");
  });

  it("respeita ano bissexto", () => {
    const fim = fimDoPeriodoGratis(2, new Date("2027-12-29T12:00:00Z"));
    assert.equal(emUTC(fim!), "2028-02-29");
  });

  it("valor inválido vira nenhum mês grátis", () => {
    const agora = new Date("2026-09-10T12:00:00Z");
    assert.equal(fimDoPeriodoGratis(-3, agora), undefined);
    assert.equal(fimDoPeriodoGratis(Number.NaN, agora), undefined);
    // 1.9 mês não é 2: truncar para baixo dá o mês que foi prometido, não um a
    // mais de brinde.
    assert.equal(emUTC(fimDoPeriodoGratis(1.9, agora)!), "2026-10-10");
  });

  it("devolve segundos, não milissegundos", () => {
    // Mandar milissegundos ao Stripe daria um trial que acaba no ano 57.000 —
    // e ninguém seria cobrado nunca.
    const fim = fimDoPeriodoGratis(2, new Date("2026-09-10T12:00:00Z"))!;
    assert.ok(fim < 2_000_000_000, "o trial_end tem de estar em segundos");
  });
});

// ---------------------------------------------------------------------------
describe("conferirWebhook", () => {
  const anterior = process.env.STRIPE_WEBHOOK_SECRET;
  beforeEach(() => { process.env.STRIPE_WEBHOOK_SECRET = SEGREDO; });
  afterEach(() => {
    if (anterior === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = anterior;
  });

  const corpo = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
  const t = 1_800_000_000;

  it("aceita um aviso legítimo", () => {
    assert.equal(
      conferirWebhook({ cabecalhoAssinatura: assinar(corpo, t), corpoBruto: corpo, agora: t }),
      true,
    );
  });

  it("recusa corpo adulterado", () => {
    // O ataque óbvio: pegar um aviso real e trocar o valor. A assinatura cobre
    // os bytes, então qualquer troca derruba.
    const cabecalho = assinar(corpo, t);
    const outro = JSON.stringify({ id: "evt_1", type: "invoice.paid", extra: 1 });
    assert.equal(conferirWebhook({ cabecalhoAssinatura: cabecalho, corpoBruto: outro, agora: t }), false);
  });

  it("recusa assinatura de outro segredo", () => {
    const cabecalho = assinar(corpo, t, "whsec_de_outra_pessoa");
    assert.equal(conferirWebhook({ cabecalhoAssinatura: cabecalho, corpoBruto: corpo, agora: t }), false);
  });

  it("recusa aviso velho, mesmo com assinatura válida", () => {
    // É o que impede replay: sem a janela de tempo, um aviso capturado hoje
    // continua valendo para sempre e pode ser reenviado à vontade.
    const cabecalho = assinar(corpo, t);
    assert.equal(
      conferirWebhook({ cabecalhoAssinatura: cabecalho, corpoBruto: corpo, agora: t + 3600 }),
      false,
    );
  });

  it("recusa aviso do futuro", () => {
    const cabecalho = assinar(corpo, t);
    assert.equal(
      conferirWebhook({ cabecalhoAssinatura: cabecalho, corpoBruto: corpo, agora: t - 3600 }),
      false,
    );
  });

  it("aceita quando um dos v1 confere, na troca de segredo", () => {
    // O Stripe manda os dois durante a rotação. Se a gente só olhasse o
    // primeiro, metade dos avisos seria recusada no dia da troca.
    const bom = createHmac("sha256", SEGREDO).update(`${t}.${corpo}`, "utf8").digest("hex");
    const cabecalho = `t=${t},v1=deadbeef,v1=${bom}`;
    assert.equal(conferirWebhook({ cabecalhoAssinatura: cabecalho, corpoBruto: corpo, agora: t }), true);
  });

  it("recusa cabeçalho ausente ou sem partes", () => {
    assert.equal(conferirWebhook({ cabecalhoAssinatura: null, corpoBruto: corpo, agora: t }), false);
    assert.equal(conferirWebhook({ cabecalhoAssinatura: "v1=abc", corpoBruto: corpo, agora: t }), false);
    assert.equal(conferirWebhook({ cabecalhoAssinatura: `t=${t}`, corpoBruto: corpo, agora: t }), false);
    assert.equal(conferirWebhook({ cabecalhoAssinatura: `t=ontem,v1=abc`, corpoBruto: corpo, agora: t }), false);
  });

  it("recusa tudo quando o segredo não está configurado", () => {
    // Sem segredo não há como distinguir o Stripe de qualquer um: a rota
    // precisa fechar, e não abrir.
    delete process.env.STRIPE_WEBHOOK_SECRET;
    assert.equal(
      conferirWebhook({ cabecalhoAssinatura: assinar(corpo, t), corpoBruto: corpo, agora: t }),
      false,
    );
  });
});

// ---------------------------------------------------------------------------
describe("lerEvento", () => {
  const ORG = "7b1f0c2e-9a44-4d1e-8f30-6c5b2a9d1e77";

  it("checkout concluído libera os meses da campanha", () => {
    // É este evento que fecha o buraco dos dois meses grátis: sem ele o cliente
    // de campanha seria bloqueado quando o teste de 14 dias acabasse e ficaria
    // sem acesso até a primeira fatura, 46 dias depois.
    const evento = lerEvento({
      id: "evt_1", type: "checkout.session.completed",
      data: { object: {
        id: "cs_1", object: "checkout_session", client_reference_id: ORG,
        subscription: "sub_1", customer: "cus_1", amount_total: 0,
        metadata: { institution_id: ORG, meses_gratis: "2" },
      } },
    });
    assert.equal(evento?.status, "approved");
    assert.equal(evento?.meses, 2);
    assert.equal(evento?.institutionId, ORG);
    assert.equal(evento?.assinaturaId, "sub_1");
    assert.equal(evento?.clienteId, "cus_1");
  });

  it("checkout sem campanha não compra mês nenhum de graça", () => {
    const evento = lerEvento({
      id: "evt_2", type: "checkout.session.completed",
      data: { object: { id: "cs_2", client_reference_id: ORG, subscription: "sub_2",
                        metadata: { meses_gratis: "0" } } },
    });
    assert.equal(evento?.meses, 0);
  });

  it("fatura paga traz a data do Stripe e não soma mês", () => {
    const fim = 1_800_600_000;
    const evento = lerEvento({
      id: "evt_3", type: "invoice.paid",
      data: { object: { id: "in_1", subscription: "sub_1", customer: "cus_1",
                        amount_paid: 45900, current_period_end: fim,
                        subscription_details: { metadata: { institution_id: ORG } } } },
    });
    assert.equal(evento?.status, "approved");
    assert.equal(evento?.valor, 459);
    assert.equal(evento?.acessoAte, fim);
    assert.equal(evento?.institutionId, ORG);
  });

  it("cai para o período da linha da fatura quando não há current_period_end", () => {
    const fim = 1_800_700_000;
    const evento = lerEvento({
      id: "evt_4", type: "invoice.paid",
      data: { object: { id: "in_2", subscription: "sub_1", amount_paid: 12900,
                        lines: { data: [{ period: { end: fim } }] } } },
    });
    assert.equal(evento?.acessoAte, fim);
  });

  it("invoice.paid e invoice.payment_succeeded contam como um pagamento só", () => {
    // O Stripe dispara os dois para a MESMA fatura. Uma chave por tipo de
    // evento creditaria o mesmo dinheiro duas vezes.
    const corpo = (tipo: string) => ({
      id: "evt_x", type: tipo,
      data: { object: { id: "in_3", subscription: "sub_1", amount_paid: 12900 } },
    });
    assert.equal(
      lerEvento(corpo("invoice.paid"))?.idUnico,
      lerEvento(corpo("invoice.payment_succeeded"))?.idUnico,
    );
  });

  it("fatura não paga suspende, não cancela", () => {
    // O cliente ainda pode acertar o cartão, e o acesso que ele já comprou
    // continua valendo até a data dele.
    const evento = lerEvento({
      id: "evt_5", type: "invoice.payment_failed",
      data: { object: { id: "in_4", subscription: "sub_1" } },
    });
    assert.equal(evento?.status, "paused");
    assert.equal(evento?.meses, 0);
    assert.equal(evento?.acessoAte, null);
  });

  it("assinatura apagada cancela", () => {
    const evento = lerEvento({
      id: "evt_6", type: "customer.subscription.deleted",
      data: { object: { id: "sub_1", object: "subscription", customer: "cus_1" } },
    });
    assert.equal(evento?.status, "cancelled");
    // O próprio objeto é a assinatura: sem isto o cancelamento chegaria sem
    // saber qual assinatura encerrar.
    assert.equal(evento?.assinaturaId, "sub_1");
  });

  it("estorno e contestação cancelam", () => {
    for (const tipo of ["charge.refunded", "charge.dispute.created"]) {
      const evento = lerEvento({ id: "evt_7", type: tipo,
        data: { object: { id: "ch_1", customer: "cus_1" } } });
      assert.equal(evento?.status, "cancelled", tipo);
    }
  });

  it("evento desconhecido não move validade", () => {
    const evento = lerEvento({
      id: "evt_8", type: "customer.updated",
      data: { object: { id: "cus_1", customer: "cus_1" } },
    });
    assert.equal(evento?.status, "outro");
    assert.equal(evento?.meses, 0);
  });

  it("ignora referência que não é uuid", () => {
    // O client_reference_id volta como texto livre. Repassar sem conferir
    // mandaria lixo para uma consulta por id de organização.
    const evento = lerEvento({
      id: "evt_9", type: "checkout.session.completed",
      data: { object: { id: "cs_9", client_reference_id: "' or 1=1 --", subscription: "sub_9" } },
    });
    assert.equal(evento?.institutionId, null);
  });

  it("devolve null para corpo sem evento", () => {
    assert.equal(lerEvento(null), null);
    assert.equal(lerEvento({}), null);
    assert.equal(lerEvento({ type: "invoice.paid", data: { object: {} } }), null);
  });
});
