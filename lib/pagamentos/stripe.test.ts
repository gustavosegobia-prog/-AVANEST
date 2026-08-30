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

  it("acha a assinatura na fatura da API nova, que aninha em parent", () => {
    // De 2025-03 em diante `invoice.subscription` e `invoice.subscription_details`
    // deixaram de existir e passaram a morar em `invoice.parent`. Ler só a forma
    // velha deixaria toda RENOVAÇÃO órfã — a primeira compra passa pelo
    // client_reference_id do checkout e esconderia o problema até o mês seguinte.
    const fim = 1_800_800_000;
    const evento = lerEvento({
      id: "evt_novo", type: "invoice.paid",
      data: { object: { id: "in_novo", customer: "cus_9", amount_paid: 45900,
                        lines: { data: [{ period: { end: fim } }] },
                        parent: { subscription_details: {
                          subscription: "sub_9",
                          metadata: { institution_id: ORG } } } } },
    });
    assert.equal(evento?.assinaturaId, "sub_9");
    assert.equal(evento?.institutionId, ORG);
    assert.equal(evento?.acessoAte, fim);
  });

  it("a forma nova manda quando as duas vêm juntas", () => {
    const evento = lerEvento({
      id: "evt_dois", type: "invoice.paid",
      data: { object: { id: "in_dois", amount_paid: 12900,
                        subscription_details: { subscription: "sub_velha" },
                        parent: { subscription_details: { subscription: "sub_nova" } } } },
    });
    assert.equal(evento?.assinaturaId, "sub_nova");
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

// ===========================================================================
// O defeito que custou quase um cliente pagante
// ===========================================================================
// A primeira assinante real pagou, viu "acesso liberado", entrou no sistema —
// e ficou com `plano = 'ativo'` e a data do teste de 14 dias em vez dos 60
// dias que ela comprou. Seria bloqueada treze dias depois, pagante.
//
// A causa: `meses_gratis` era gravado em `subscription_data[metadata]`, que
// vai para a ASSINATURA, e o evento `checkout.session.completed` entrega a
// SESSÃO. O webhook lia zero mês e somava zero à validade.
//
// O TESTE QUE EXISTIA PASSAVA. Ele montava a sessão à mão, com `meses_gratis`
// no metadata — um payload que a produção nunca gerou. Testar contra um
// payload inventado é testar a própria suposição.
//
// Os dois abaixo amarram as pontas: um confere o que o nosso código MANDA ao
// Stripe, o outro lê a sessão como ela chega de verdade.
// ===========================================================================

// Abre uma sessão de checkout de verdade contra um `fetch` de mentira, e
// devolve o corpo do formulário que teria ido para o Stripe. Fica no escopo
// do arquivo porque tanto as asserções de campanha quanto as de cupom leem o
// MESMO corpo — duas cópias divergiriam no dia em que uma fosse ajustada.
const ORG_CHECKOUT = "7b1f0c2e-9a44-4d1e-8f30-6c5b2a9d1e77";

async function corpoEnviado(cupom?: Parameters<typeof import("./stripe.ts").criarAssinatura>[0]["cupom"]) {
  const fetchOriginal = globalThis.fetch;
  const chaveOriginal = process.env.STRIPE_SECRET_KEY;
  let corpo = "";
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  globalThis.fetch = (async (_url: string, init: { body?: string }) => {
    corpo = String(init?.body ?? "");
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: "cs_x", url: "https://x" }) };
  }) as unknown as typeof fetch;
  try {
    const { criarAssinatura } = await import("./stripe.ts");
    await criarAssinatura({
      institutionId: ORG_CHECKOUT, organizacao: "Teste", plano: "Solo",
      valorMensal: 129, mesesGratis: 2, emailPagador: "a@b.c", cupom,
      retornoSucesso: "https://x/ok", retornoCancelado: "https://x/no",
    } as Parameters<typeof criarAssinatura>[0]);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (chaveOriginal === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = chaveOriginal;
  }
  return decodeURIComponent(corpo);
}

describe("o que o checkout manda ao Stripe", () => {


  it("os meses grátis vão no metadata DA SESSÃO, que é o que o webhook lê", async () => {
    // A linha que faltava. Sem ela o cliente da campanha fica com a validade
    // do teste de 14 dias, "ativo", e é bloqueado antes de a campanha acabar.
    const corpo = await corpoEnviado();
    assert.match(corpo, /(^|&)metadata\[meses_gratis\]=2/,
      "meses_gratis precisa estar no metadata da sessão");
  });

  it("e também no da assinatura, que é o que as renovações leem", async () => {
    const corpo = await corpoEnviado();
    assert.match(corpo, /subscription_data\[metadata\]\[meses_gratis\]=2/);
  });

  it("a organização viaja nos três lugares que o webhook consulta", async () => {
    const corpo = await corpoEnviado();
    assert.match(corpo, /client_reference_id=7b1f0c2e/);
    assert.match(corpo, /(^|&)metadata\[institution_id\]=7b1f0c2e/);
    assert.match(corpo, /subscription_data\[metadata\]\[institution_id\]=7b1f0c2e/);
  });
});

describe("a sessão como ela chega de verdade", () => {
  const ORG3 = "7b1f0c2e-9a44-4d1e-8f30-6c5b2a9d1e77";

  it("a data do Stripe manda, e é a mesma que o cliente leu na tela", () => {
    // 29/10/2026 — a data que apareceu no checkout da primeira assinante.
    const trial = Math.floor(Date.UTC(2026, 9, 29) / 1000);
    const evento = lerEvento({
      id: "evt_trial", type: "checkout.session.completed",
      data: { object: {
        id: "cs_real", object: "checkout_session", client_reference_id: ORG3,
        subscription: "sub_real", customer: "cus_real", amount_total: 0,
        trial_end: trial,
        metadata: { institution_id: ORG3, meses_gratis: "2" },
      } },
    });
    assert.equal(evento?.acessoAte, trial,
      "a validade tem de sair do Stripe, e não de uma conta nossa");
  });

  it("sessão SEM meses_gratis não fica sem validade nenhuma", () => {
    // O caso exato do defeito: metadata só com institution_id. Antes isto
    // devolvia zero mês e nenhuma data — e o banco somava zero.
    const trial = Math.floor(Date.UTC(2026, 9, 29) / 1000);
    const evento = lerEvento({
      id: "evt_sem", type: "checkout.session.completed",
      data: { object: {
        id: "cs_sem", client_reference_id: ORG3, subscription: "sub_sem",
        trial_end: trial, metadata: { institution_id: ORG3 },
      } },
    });
    assert.equal(evento?.status, "approved");
    assert.equal(evento?.acessoAte, trial, "a data do Stripe salva o caso");
  });

  it("a assinatura criada acerta a validade, como rede", () => {
    const trial = Math.floor(Date.UTC(2026, 9, 29) / 1000);
    const evento = lerEvento({
      id: "evt_sub", type: "customer.subscription.created",
      data: { object: { id: "sub_1", object: "subscription", trial_end: trial,
                        metadata: { institution_id: ORG3 } } },
    });
    assert.equal(evento?.status, "approved");
    assert.equal(evento?.acessoAte, trial);
    assert.equal(evento?.institutionId, ORG3);
  });

  it("a chave do evento de assinatura é por DATA, não por disparo", () => {
    // O Stripe manda `subscription.updated` várias vezes com o mesmo período.
    // Uma chave nova a cada disparo faria o unique do banco parar de proteger,
    // e a validade seria estendida de novo a cada aviso repetido.
    const trial = 1_800_600_000;
    const um = lerEvento({ id: "a", type: "customer.subscription.updated",
      data: { object: { id: "sub_1", trial_end: trial, metadata: { institution_id: ORG3 } } } });
    const dois = lerEvento({ id: "b", type: "customer.subscription.updated",
      data: { object: { id: "sub_1", trial_end: trial, metadata: { institution_id: ORG3 } } } });
    assert.equal(um?.idUnico, dois?.idUnico);
  });
});

// ===========================================================================
// Cupom de desconto
// ===========================================================================

/** A resposta do Stripe para `GET /v1/promotion_codes`, como ela chega. */
function respostaDeCupom(promo: Record<string, unknown> | null) {
  return { data: promo ? [promo] : [] };
}

const HACK = {
  id: "promo_1abc",
  code: "HACKANESTESIA",
  active: true,
  expires_at: null,
  max_redemptions: null,
  times_redeemed: 0,
  coupon: {
    percent_off: 20,
    amount_off: null,
    currency: null,
    duration: "forever",
    duration_in_months: null,
    valid: true,
  },
};

async function procurar(promo: Record<string, unknown> | null, codigo = "HACKANESTESIA") {
  const fetchOriginal = globalThis.fetch;
  const chaveOriginal = process.env.STRIPE_SECRET_KEY;
  const urls: string[] = [];
  process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url));
    return { ok: true, status: 200, text: async () => JSON.stringify(respostaDeCupom(promo)) };
  }) as unknown as typeof fetch;
  try {
    const { buscarCupom } = await import("./stripe.ts");
    return { cupom: await buscarCupom(codigo), urls };
  } finally {
    globalThis.fetch = fetchOriginal;
    if (chaveOriginal === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = chaveOriginal;
  }
}

describe("procurar o cupom no Stripe", () => {
  it("traduz um promotion_code de verdade", async () => {
    const { cupom } = await procurar(HACK);
    assert.equal(cupom?.id, "promo_1abc");
    assert.equal(cupom?.codigo, "HACKANESTESIA");
    assert.equal(cupom?.percentual, 20);
    assert.equal(cupom?.duracao, "forever");
  });

  it("NÃO pede expand do coupon", async () => {
    // No promotion_code o `coupon` já vem inteiro, e não é expansível. Pedir
    // expand faria o Stripe recusar a chamada com 400 — e todo cupom válido
    // apareceria como inválido na tela.
    const { urls } = await procurar(HACK);
    assert.equal(urls.some((u) => u.includes("expand")), false, `pediu expand: ${urls[0]}`);
    assert.match(urls[0], /code=HACKANESTESIA/);
    assert.match(urls[0], /active=true/);
  });

  it("recusa o que não presta, sem lançar", async () => {
    const casos: Array<[string, Record<string, unknown>]> = [
      ["código desligado", { ...HACK, active: false }],
      ["cupom inválido", { ...HACK, coupon: { ...HACK.coupon, valid: false } }],
      ["vencido", { ...HACK, expires_at: 1 }],
      ["esgotado", { ...HACK, max_redemptions: 50, times_redeemed: 50 }],
      ["sem desconto nenhum", { ...HACK, coupon: { ...HACK.coupon, percent_off: null } }],
    ];
    for (const [nome, promo] of casos) {
      const { cupom } = await procurar(promo);
      assert.equal(cupom, null, `devia recusar: ${nome}`);
    }
    const { cupom: nenhum } = await procurar(null);
    assert.equal(nenhum, null, "lista vazia é cupom inexistente");
  });

  it("desconto em dólar não vira desconto em real", async () => {
    // O Stripe recusaria no checkout de qualquer jeito; recusar aqui dá nome
    // ao problema em vez de derrubar o pagamento lá na frente.
    const dolar = { ...HACK, coupon: { ...HACK.coupon, percent_off: null, amount_off: 2000, currency: "usd" } };
    assert.equal((await procurar(dolar)).cupom, null);
    const real = { ...HACK, coupon: { ...HACK.coupon, percent_off: null, amount_off: 2500, currency: "brl" } };
    assert.equal((await procurar(real)).cupom?.valorFixo, 25, "amount_off vem em centavos");
  });

  it("esgotado é conferido no CÓDIGO, não só no cupom", async () => {
    // O `valid` do cupom não olha o limite de resgates do promotion_code. Sem
    // esta conferência, a 51ª pessoa de uma campanha de 50 veria "cupom
    // aplicado" na tela e só seria recusada dentro do Stripe.
    const esgotado = { ...HACK, max_redemptions: 50, times_redeemed: 50, coupon: { ...HACK.coupon, valid: true } };
    assert.equal((await procurar(esgotado)).cupom, null);
  });
});

describe("o cupom dentro do checkout", () => {
  const CUPOM = {
    id: "promo_1abc", codigo: "HACKANESTESIA", percentual: 20,
    valorFixo: null, duracao: "forever" as const, meses: null,
  };

  it("vai como desconto do Stripe, e o preço de tabela não muda", async () => {
    // Baixar o `unit_amount` daria 20% PARA SEMPRE num cupom que pode valer
    // três meses, e sem nada registrando que aquilo era promoção.
    const corpo = await corpoEnviado(CUPOM);
    assert.match(corpo, /discounts\[0\]\[promotion_code\]=promo_1abc/);
    assert.match(corpo, /price_data\]\[unit_amount\]=12900/,
      "o preço da linha continua sendo o cheio");
  });

  it("discounts e allow_promotion_codes NUNCA vão juntos", async () => {
    // São excludentes no Stripe: mandar os dois derruba a sessão inteira, e o
    // cliente vê um erro no lugar do pagamento.
    const comCupom = await corpoEnviado(CUPOM);
    assert.equal(/allow_promotion_codes/.test(comCupom), false,
      "com cupom aplicado, o campo aberto do Stripe não pode ir junto");

    const semCupom = await corpoEnviado();
    assert.match(semCupom, /allow_promotion_codes=true/,
      "sem cupom, quem recebeu o código depois ainda digita no Stripe");
    assert.equal(/discounts/.test(semCupom), false);
  });

  it("o valor JÁ DESCONTADO viaja para o e-mail de boas-vindas", async () => {
    // O webhook só conhece o preço de tabela do banco. Sem isto, quem assinou
    // com 20% de desconto receberia por escrito R$ 129,00 — e o e-mail que
    // existe para evitar contestação de cartão viraria o motivo dela.
    const corpo = await corpoEnviado(CUPOM);
    assert.match(corpo, /(^|&)metadata\[valor_mensal\]=103\.20/);
    assert.match(corpo, /(^|&)metadata\[cupom\]=HACKANESTESIA/);
  });

  it("sem cupom, o valor gravado é o cheio", async () => {
    assert.match(await corpoEnviado(), /(^|&)metadata\[valor_mensal\]=129\.00/);
  });
});

describe("o cupom voltando pelo webhook", () => {
  const ORG4 = "7b1f0c2e-9a44-4d1e-8f30-6c5b2a9d1e77";

  it("o e-mail lê o valor com desconto, e não o amount_total", () => {
    // Com período grátis o `amount_total` é ZERO: verdade do momento, mentira
    // do mês que vem. Quem escreve o e-mail precisa da mensalidade.
    const evento = lerEvento({
      id: "evt_cupom", type: "checkout.session.completed",
      data: { object: {
        id: "cs_cupom", client_reference_id: ORG4, subscription: "sub_c",
        amount_total: 0, trial_end: 1_800_000_000,
        metadata: { institution_id: ORG4, meses_gratis: "2", cupom: "HACKANESTESIA", valor_mensal: "103.20" },
      } },
    });
    assert.equal(evento?.valor, 0, "amount_total continua sendo o que foi cobrado agora");
    assert.equal(evento?.valorMensal, 103.2, "e a mensalidade é a que vai no e-mail");
    assert.equal(evento?.cupom, "HACKANESTESIA");
  });

  it("sessão antiga, sem os campos novos, não inventa valor", () => {
    // As sessões abertas antes desta mudança continuam chegando por meses.
    const evento = lerEvento({
      id: "evt_velho", type: "checkout.session.completed",
      data: { object: { id: "cs_velho", client_reference_id: ORG4, trial_end: 1_800_000_000,
                        metadata: { institution_id: ORG4, meses_gratis: "2" } } },
    });
    assert.equal(evento?.valorMensal, null, "sem valor, o webhook cai no preço do banco");
    assert.equal(evento?.cupom, null);
  });
});
