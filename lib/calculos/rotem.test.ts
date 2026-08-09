import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  achados,
  acharCenario,
  acharEnsaio,
  BARREIRA,
  CENARIOS,
  chave,
  COMPARACOES,
  CONDUTAS,
  condutasAplicaveis,
  ENSAIOS,
  NAO_DEFINIDO,
  PARAMETROS,
  PASSO_ZERO,
  quantosClassificados,
  SEM_CONSENSO,
  SEQUENCIA,
  tudoNormal,
  acharPlataforma,
  CARTUCHOS_DIFERENTES,
  classificar,
  ensaiosDa,
  escreverFaixa,
  faixaDe,
  fonteDaPlataforma,
  PLATAFORMAS,
  REFERENCIA_NAO_E_GATILHO,
  REFERENCIAS,
  SEM_PLATAFORMA,
  type Leitura,
} from "./rotem.ts";

/* Duas coisas em teste: que a leitura cruzada faz o que a fonte diz, e que a
   camada de conduta nunca escapa das duas travas — só com sangramento, e
   nunca com dose. */

test("os seis ensaios existem, com ativação e uso", () => {
  assert.equal(ENSAIOS.length, 6);
  for (const e of ENSAIOS) {
    assert.ok(e.ativacao.length > 10, `${e.sigla} sem ativação`);
    assert.ok(e.uso.length > 10, `${e.sigla} sem uso`);
    for (const p of e.parametros) assert.ok(PARAMETROS[p], `${e.sigla}: parâmetro ${p} desconhecido`);
  }
  assert.ok(acharEnsaio("natem"), "NATEM ausente");
  assert.deepEqual(acharEnsaio("heptem")!.parametros, ["ct"]);
  assert.equal(acharEnsaio("fibtem")!.parametros.includes("ct"), false);
});

test("cada parâmetro carrega fase e pergunta clínica", () => {
  for (const p of Object.values(PARAMETROS)) {
    assert.ok(p.fase.length > 3, `${p.sigla} sem fase`);
    assert.match(p.pergunta, /\?/, `${p.sigla} sem pergunta`);
  }
});

test("o passo zero pergunta contexto antes do traçado", () => {
  assert.equal(PASSO_ZERO.length, 3);
  assert.ok(PASSO_ZERO.some((p) => /sangramento clinicamente relevante/i.test(p.pergunta)));
  assert.ok(PASSO_ZERO.some((p) => /fonte do sangramento está controlada/i.test(p.pergunta)));
  assert.ok(PASSO_ZERO.some((p) => /cálcio iônico/i.test(p.pergunta)));
  for (const p of PASSO_ZERO) assert.ok(p.seNao.length > 20, `${p.chave} sem consequência`);
});

test("tela em branco não interpreta nada", () => {
  assert.equal(achados({}).length, 0);
  assert.equal(quantosClassificados({}), 0);
  assert.equal(tudoNormal({}), false);
});

test("INTEM prolongado com HEPTEM normal aponta heparina, e lembra da protamina já dada", () => {
  const l: Leitura = { [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "normal" };
  const r = achados(l);
  assert.equal(r.length, 1);
  assert.match(r[0].hipotese, /heparina/i);
  assert.equal(r[0].fenotipo, "heparina");
  assert.match(r[0].aSeguir!, /protamina já administrada/);
});

test("INTEM e HEPTEM prolongados tiram a heparina da explicação", () => {
  const l: Leitura = { [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "acima" };
  const r = achados(l);
  assert.match(r[0].hipotese, /sem explicação pela heparina/i);
  assert.equal(r[0].fenotipo, "iniciacao");
});

test("faltando o canal que confirma, o achado é indefinido e não tem fenótipo", () => {
  const semHeptem = achados({ [chave("intem", "ct")]: "acima" });
  assert.match(semHeptem[0].hipotese, /Indefinido/);
  assert.equal(semHeptem[0].fenotipo, undefined);
  assert.match(semHeptem[0].aSeguir!, /HEPTEM/);

  const semAptem = achados({ [chave("extem", "ml")]: "acima" });
  assert.match(semAptem[0].hipotese, /Indefinido/);
  assert.equal(semAptem[0].fenotipo, undefined);
});

test("EXTEM e FIBTEM baixos apontam fibrina e pedem o Clauss", () => {
  const l: Leitura = { [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "abaixo" };
  const r = achados(l);
  assert.equal(r.length, 1);
  assert.match(r[0].hipotese, /fibrínica|hipofibrinogenemia/i);
  assert.equal(r[0].fenotipo, "fibrina");
  assert.match(r[0].aSeguir!, /Clauss/);
});

test("EXTEM baixo com FIBTEM preservado aponta plaqueta, e diz o que o exame não enxerga", () => {
  const l: Leitura = { [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "normal" };
  const r = achados(l);
  assert.equal(r[0].fenotipo, "plaquetas");
  assert.match(r[0].aSeguir!, /von Willebrand/);
});

test("qualquer um dos três parâmetros de firmeza baixo já conta", () => {
  const porA5: Leitura = { [chave("extem", "a5")]: "abaixo", [chave("fibtem", "mcf")]: "abaixo" };
  assert.equal(achados(porA5)[0].fenotipo, "fibrina");
});

test("lise que o APTEM corrige é hiperfibrinólise, e o módulo avisa para não atrasar", () => {
  const corrige: Leitura = { [chave("extem", "ml")]: "acima", [chave("aptem", "ml")]: "normal" };
  const r = achados(corrige);
  assert.equal(r[0].fenotipo, "fibrinolise");
  assert.match(r[0].aSeguir!, /Não atrasar/);

  const naoCorrige: Leitura = { [chave("extem", "ml")]: "acima", [chave("aptem", "ml")]: "acima" };
  assert.match(achados(naoCorrige)[0].hipotese, /não explicada por fibrinólise/i);
  assert.equal(achados(naoCorrige)[0].fenotipo, undefined);
});

test("padrões independentes aparecem juntos", () => {
  const l: Leitura = {
    [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "abaixo",
    [chave("extem", "ml")]: "acima", [chave("aptem", "ml")]: "normal",
  };
  assert.equal(achados(l).length, 2);
  assert.equal(quantosClassificados(l), 4);
});

test("traçado normal com sangramento vira achado próprio: procurar a fonte", () => {
  const l: Leitura = {
    [chave("extem", "ct")]: "normal", [chave("extem", "a10")]: "normal",
    [chave("fibtem", "a10")]: "normal", [chave("extem", "ml")]: "normal",
  };
  assert.equal(achados(l).length, 0, "sem sangramento declarado, não conclui nada");

  const r = achados(l, { sangramentoAtivo: true });
  assert.equal(r.length, 1);
  assert.equal(r[0].fenotipo, "semCoagulopatia");
  assert.match(r[0].base, /não exclui causa anatômica/);
});

test("as classes de conduta só existem com sangramento ativo", () => {
  const l: Leitura = { [chave("extem", "a10")]: "abaixo", [chave("fibtem", "a10")]: "abaixo" };
  const lista = achados(l);

  assert.deepEqual(condutasAplicaveis(lista, {}), []);
  assert.deepEqual(condutasAplicaveis(lista, { sangramentoAtivo: false }), []);

  const com = condutasAplicaveis(lista, { sangramentoAtivo: true });
  assert.equal(com.length, 1);
  assert.equal(com[0].fenotipo, "fibrina");
  assert.match(com[0].verificar, /Clauss/);
});

test("achado indefinido não gera classe de conduta, nem com sangramento", () => {
  const lista = achados({ [chave("intem", "ct")]: "acima" });
  assert.deepEqual(condutasAplicaveis(lista, { sangramentoAtivo: true }), []);
});

test("cada fenótipo aparece uma vez só, mesmo com dois achados apontando para ele", () => {
  const l: Leitura = {
    [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "acima",
    [chave("extem", "ct")]: "acima", [chave("fibtem", "a10")]: "normal",
  };
  const lista = achados(l);
  assert.equal(lista.filter((a) => a.fenotipo === "iniciacao").length, 2);
  assert.equal(condutasAplicaveis(lista, { sangramentoAtivo: true }).length, 1);
});

test("toda classe de conduta vem grudada nas verificações obrigatórias", () => {
  for (const c of Object.values(CONDUTAS)) {
    assert.ok(c.considerar.length > 15, `${c.fenotipo} sem intervenção`);
    assert.ok(c.verificar.length > 15, `${c.fenotipo} sem verificação`);
  }
});

test("nenhuma classe de conduta traz dose, limiar ou número", () => {
  const numero = /\d/;
  for (const c of Object.values(CONDUTAS)) {
    assert.doesNotMatch(c.considerar, numero, `${c.fenotipo}: número na intervenção`);
    assert.doesNotMatch(c.considerar, /\b(g|mg|mL|UI|U)\b/, `${c.fenotipo}: unidade na intervenção`);
  }
});

test("nenhum achado indica produto ou manda administrar", () => {
  const tudo: Leitura = {
    [chave("extem", "ct")]: "acima", [chave("extem", "a10")]: "abaixo", [chave("extem", "ml")]: "acima",
    [chave("intem", "ct")]: "acima", [chave("heptem", "ct")]: "acima",
    [chave("fibtem", "a10")]: "abaixo", [chave("aptem", "ml")]: "normal",
  };
  const proibido = /crioprecipitado|plasma fresco|complexo protrombínico|concentrado de plaquetas|administrar|infundir|repor|\d+\s*(g|mg|UI|mL)\b/i;
  for (const a of achados(tudo, { sangramentoAtivo: true })) {
    assert.doesNotMatch(a.titulo, proibido, a.titulo);
    assert.doesNotMatch(a.hipotese, proibido, a.titulo);
    assert.doesNotMatch(a.base, proibido, a.titulo);
    if (a.aSeguir) assert.doesNotMatch(a.aSeguir, proibido, a.titulo);
  }
});

test("as três comparações trazem inferência e cuidado", () => {
  assert.equal(COMPARACOES.length, 3);
  for (const c of COMPARACOES) assert.ok(c.cuidado.length > 20, `${c.par} sem cuidado`);
  assert.ok(COMPARACOES.some((c) => /Não atrasar o antifibrinolítico/.test(c.cuidado)));
});

test("a sequência de interpretação tem os seis passos, na ordem", () => {
  assert.equal(SEQUENCIA.length, 6);
  assert.match(SEQUENCIA[0].etapa, /Qualidade/);
  assert.match(SEQUENCIA[5].etapa, /Resposta/);
  assert.match(SEQUENCIA[5].decisao, /cumulativo cego/);
});

test("os seis cenários trazem utilidade e limite de generalização", () => {
  assert.equal(CENARIOS.length, 6);
  for (const c of CENARIOS) assert.ok(c.limite.length > 20, `${c.nome} sem limite`);
  assert.match(acharCenario("hepatico")!.limite, /rebalanceada/);
});

test("os sete campos não definidos pela fonte continuam listados", () => {
  assert.equal(NAO_DEFINIDO.length, 7);
  assert.ok(NAO_DEFINIDO.some((x) => /Faixas normais universais/.test(x.campo)));
  assert.ok(NAO_DEFINIDO.some((x) => /não converter valor em dose automática/i.test(x.conduta)));
});

test("a barreira e a falta de consenso ficam ditas, com as três fontes", () => {
  assert.match(BARREIRA, /apenas porque um campo está fora da referência/);
  assert.match(SEM_CONSENSO.texto, /ainda não há consenso/);
  assert.equal(SEM_CONSENSO.fontes.length, 3);
  for (const f of SEM_CONSENSO.fontes) assert.ok(f.obra && f.local, "fonte incompleta");
});

/* Plataforma e intervalos de referência. Os números abaixo são os do guia:
   se um deles mudar, ou o manual mudou ou alguém digitou errado. */

test("as duas plataformas existem, com fonte própria", () => {
  assert.equal(PLATAFORMAS.length, 2);
  assert.ok(acharPlataforma("delta"));
  assert.ok(acharPlataforma("sigma"));
  assert.match(fonteDaPlataforma("delta").local, /2005;16\(4\):301-310/);
  assert.match(fonteDaPlataforma("sigma").local, /pp\. 119 e 127/);
});

test("os intervalos do delta são os de Lang et al.", () => {
  assert.deepEqual(faixaDe("delta", "extem", "ct"), { min: 42, max: 74 });
  assert.deepEqual(faixaDe("delta", "extem", "cft"), { min: 46, max: 148 });
  assert.deepEqual(faixaDe("delta", "extem", "mcf"), { min: 49, max: 71 });
  assert.deepEqual(faixaDe("delta", "intem", "ct"), { min: 137, max: 246 });
  assert.deepEqual(faixaDe("delta", "intem", "cft"), { min: 40, max: 100 });
  assert.deepEqual(faixaDe("delta", "intem", "mcf"), { min: 52, max: 72 });
  assert.deepEqual(faixaDe("delta", "fibtem", "mcf"), { min: 9, max: 25 });
  assert.equal(faixaDe("delta", "aptem", "mcf"), "local");
  assert.equal(faixaDe("delta", "heptem", "ct"), "local");
});

test("no delta o A10 não tem intervalo publicado, e isso não vira chute", () => {
  assert.equal(faixaDe("delta", "extem", "a10"), undefined);
  assert.equal(classificar("delta", "extem", "a10", 40), undefined);
});

test("os valores esperados do sigma são os do manual", () => {
  assert.deepEqual(faixaDe("sigma", "intem", "ct"), { min: 139, max: 202 });
  assert.deepEqual(faixaDe("sigma", "extem", "ct"), { min: 48, max: 72 });
  assert.deepEqual(faixaDe("sigma", "heptem", "ct"), { min: 141, max: 215 });
  assert.deepEqual(faixaDe("sigma", "aptem", "ct"), { min: 50, max: 73 });
  assert.deepEqual(faixaDe("sigma", "fibtem", "a5"), { min: 5, max: 14 });
  assert.deepEqual(faixaDe("sigma", "fibtem", "mcf"), { min: 5, max: 17 });
  assert.deepEqual(faixaDe("sigma", "extem", "a20"), { min: 53, max: 68 });
  assert.deepEqual(faixaDe("sigma", "extem", "li60"), { min: 94, max: 100 });
  assert.deepEqual(faixaDe("sigma", "extem", "ml"), { min: 0, max: 6 });
  assert.equal(faixaDe("sigma", "fibtem", "ct"), undefined, "FIBTEM C não tem CT");
});

test("os intervalos das duas plataformas não se misturam", () => {
  const delta = REFERENCIAS.delta.extem!.ct as { min: number };
  const sigma = REFERENCIAS.sigma.extem!.ct as { min: number };
  assert.notEqual(delta.min, sigma.min);
  assert.equal(REFERENCIAS.delta.extem!.a20, undefined, "A20 é do sigma");
  assert.equal(REFERENCIAS.sigma.extem!.cft, undefined, "CFT publicado é do delta");
});

test("sem plataforma escolhida, nada é classificado", () => {
  assert.equal(classificar(undefined, "extem", "ct", 200), undefined);
  assert.match(SEM_PLATAFORMA, /não classifica valor nenhum/);
});

test("classificar compara o número com o intervalo da plataforma certa", () => {
  assert.equal(classificar("delta", "extem", "ct", 60), "normal");
  assert.equal(classificar("delta", "extem", "ct", 30), "abaixo");
  assert.equal(classificar("delta", "extem", "ct", 90), "acima");
  // 60 s é normal no EXTEM do delta e baixo no INTEM: por isso não se troca de tabela.
  assert.equal(classificar("delta", "intem", "ct", 60), "abaixo");
  assert.equal(classificar("sigma", "extem", "ct", 60), "normal");
});

test("faixa do laboratório não classifica sozinha", () => {
  assert.equal(classificar("delta", "aptem", "mcf", 55), undefined);
  assert.equal(escreverFaixa("local", "mm"), "faixa do laboratório");
});

test("os limites contam como normais", () => {
  assert.equal(classificar("delta", "extem", "ct", 42), "normal");
  assert.equal(classificar("delta", "extem", "ct", 74), "normal");
  assert.equal(classificar("sigma", "fibtem", "ml", 0), "normal");
});

test("a lista de ensaios muda com a plataforma", () => {
  const delta = ensaiosDa("delta");
  const sigma = ensaiosDa("sigma");
  assert.ok(delta.some((e) => e.sigla === "NATEM"), "delta tem NATEM");
  assert.ok(!sigma.some((e) => e.id === "natem"), "sigma não tem NATEM");
  assert.ok(sigma.every((e) => e.sigla.endsWith(" C")), "no sigma as siglas levam C");
  assert.equal(sigma.find((e) => e.id === "fibtem")!.parametros.includes("ct"), false);
  assert.ok(sigma.find((e) => e.id === "extem")!.parametros.includes("a20"));
  assert.ok(!delta.find((e) => e.id === "extem")!.parametros.includes("a20"));
  assert.equal(delta.find((e) => e.id === "heptem")!.parametros.length, 1);
});

test("a escrita da faixa leva a unidade junto", () => {
  assert.equal(escreverFaixa({ min: 42, max: 74 }, "s"), "42–74 s");
  assert.equal(escreverFaixa({ min: 100, max: 100 }, "%"), "100 %");
  assert.equal(escreverFaixa(undefined, "mm"), undefined);
});

test("referência não é gatilho, e os cartuchos do sigma são diferentes", () => {
  assert.match(REFERENCIA_NAO_E_GATILHO, /não é sinônimo de gatilho transfusional/);
  assert.match(REFERENCIA_NAO_E_GATILHO, /nunca vira dose/);
  assert.match(CARTUCHOS_DIFERENTES, /complete \+ hep/);
});
