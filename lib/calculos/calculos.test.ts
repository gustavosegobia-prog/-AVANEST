/**
 * Testes das fórmulas. Rodam com o executor embutido do Node, sem dependência
 * nova no projeto:
 *
 *   npm test
 *
 * Os casos são de bancada, com valores conferíveis à mão. A ideia não é cobrir
 * toda combinação possível, e sim travar o comportamento das contas que
 * orientam conduta — se alguém mexer numa fórmula sem querer, isto acusa.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  anionGap,
  anionGapCorrigido,
  compensacaoAlcaloseMetabolica,
  deltaRatio,
  disturbioPrincipal,
  fracaoFio2,
  gradienteAlveoloArterial,
  hco3EsperadoRespiratorio,
  interpretar,
  lerCompensacaoMetabolica,
  relacaoPF,
  REFERENCIAS,
  winter,
} from "./gasometria.ts";

import {
  deficitBicarbonato,
  frequenciaParaAlvo,
  orientacoes,
  ventilacaoParaAlvo,
} from "./gasometria-orientacoes.ts";

import {
  calibreMaisProximo,
  idadeEmMeses,
  profundidadeOral,
  sugerirTubo,
} from "./via-aerea-pediatrica.ts";

describe("gasometria — distúrbio principal", () => {
  it("reconhece acidose metabólica", () => {
    assert.equal(disturbioPrincipal({ ph: 7.25, paco2: 30, hco3: 14 }), "acidose metabólica");
  });

  it("reconhece acidose respiratória", () => {
    assert.equal(disturbioPrincipal({ ph: 7.28, paco2: 60, hco3: 27 }), "acidose respiratória");
  });

  it("reconhece alcalose metabólica", () => {
    assert.equal(disturbioPrincipal({ ph: 7.52, paco2: 45, hco3: 34 }), "alcalose metabólica");
  });

  it("reconhece alcalose respiratória", () => {
    assert.equal(disturbioPrincipal({ ph: 7.52, paco2: 28, hco3: 22 }), "alcalose respiratória");
  });

  it("não inventa distúrbio quando está tudo normal", () => {
    assert.equal(
      disturbioPrincipal({ ph: 7.4, paco2: 40, hco3: 24 }),
      "sem distúrbio ácido-base significativo",
    );
  });

  it("pH normal com bicarbonato alterado fica indeterminado, não normal", () => {
    assert.equal(disturbioPrincipal({ ph: 7.4, paco2: 28, hco3: 17 }), "indeterminado");
  });
});

describe("gasometria — compensação metabólica", () => {
  it("Winter: HCO3 14 espera PaCO2 29 (27–31)", () => {
    const f = winter(14);
    assert.equal(f.esperada, 29);
    assert.equal(f.min, 27);
    assert.equal(f.max, 31);
  });

  it("PaCO2 dentro da faixa é compensação adequada", () => {
    const l = lerCompensacaoMetabolica("acidose metabólica", 30, 14);
    assert.equal(l.situacao, "adequada");
    assert.equal(l.texto, "Compensação respiratória adequada");
  });

  it("PaCO2 acima da faixa acusa acidose respiratória associada", () => {
    const l = lerCompensacaoMetabolica("acidose metabólica", 40, 14);
    assert.equal(l.situacao, "acima");
    assert.match(l.texto, /acidose respiratória associada/);
  });

  it("PaCO2 abaixo da faixa acusa alcalose respiratória associada", () => {
    const l = lerCompensacaoMetabolica("acidose metabólica", 22, 14);
    assert.equal(l.situacao, "abaixo");
    assert.match(l.texto, /alcalose respiratória associada/);
  });

  it("alcalose metabólica: HCO3 34 espera PaCO2 44,8", () => {
    assert.equal(compensacaoAlcaloseMetabolica(34).esperada, 44.8);
  });
});

describe("gasometria — distúrbio respiratório agudo e crônico", () => {
  it("acidose: PaCO2 60 dá HCO3 26 no agudo e 31,5 no crônico", () => {
    const h = hco3EsperadoRespiratorio("acidose respiratória", 60, 26);
    assert.equal(h.agudo, 26);
    assert.equal(h.cronico, 31.5);
    assert.equal(h.compativel, "agudo");
  });

  it("acidose: HCO3 31 com PaCO2 60 é mais compatível com crônico", () => {
    assert.equal(hco3EsperadoRespiratorio("acidose respiratória", 60, 31).compativel, "crônico");
  });

  it("alcalose: PaCO2 30 dá HCO3 22 no agudo e 19,5 no crônico", () => {
    const h = hco3EsperadoRespiratorio("alcalose respiratória", 30, 22);
    assert.equal(h.agudo, 22);
    assert.equal(h.cronico, 19.5);
  });
});

describe("gasometria — ânion gap e delta ratio", () => {
  it("AG = Na − (Cl + HCO3)", () => {
    assert.equal(anionGap(140, 104, 14), 22);
  });

  it("albumina baixa aumenta o AG corrigido", () => {
    assert.equal(anionGapCorrigido(22, 2), 27);
  });

  it("albumina normal não altera o AG", () => {
    assert.equal(anionGapCorrigido(22, 4), 22);
  });

  it("delta ratio de 1 fica na faixa de AG aumentado predominante", () => {
    const d = deltaRatio(22, 14);
    assert.equal(d?.valor, 1);
    assert.match(d!.texto, /ânion gap aumentado predominante/);
  });

  it("delta ratio baixo indica componente hiperclorêmico", () => {
    assert.match(deltaRatio(14, 14)!.texto, /hiperclorêmica/);
  });

  it("sem denominador não devolve delta ratio em vez de dividir por zero", () => {
    assert.equal(deltaRatio(22, 24), undefined);
  });
});

describe("gasometria — oxigenação", () => {
  it("FiO2 aceita porcentagem e fração", () => {
    assert.equal(fracaoFio2(40), 0.4);
    assert.equal(fracaoFio2(0.4), 0.4);
  });

  it("P/F de PaO2 80 com FiO2 40% é 200", () => {
    assert.equal(relacaoPF(80, 40), 200);
  });

  it("gradiente A-a em ar ambiente com gasometria normal fica baixo", () => {
    const g = gradienteAlveoloArterial(95, 40, 21);
    assert.ok(g);
    assert.ok(g!.gradiente < 15, `gradiente inesperado: ${g!.gradiente}`);
  });
});

describe("gasometria — interpretação completa", () => {
  it("monta o caso de acidose metabólica com AG aumentado e compensação adequada", () => {
    const r = interpretar({
      ph: 7.25, paco2: 30, pao2: 74, hco3: 14, na: 140, cl: 104,
      fio2: 40, lactato: 4.2, albumina: 4,
    });
    assert.equal(r.disturbio, "acidose metabólica");
    assert.equal(r.compensacao?.situacao, "adequada");
    assert.equal(r.misto, false);
    assert.equal(r.anionGap, 22);
    assert.equal(r.deltaRatio?.valor, 1);
    assert.equal(r.relacaoPF, 185);
    assert.equal(r.lactato?.acimaDoNormal, true);
  });

  it("marca como misto quando a compensação não fecha", () => {
    const r = interpretar({ ph: 7.2, paco2: 45, hco3: 14 });
    assert.equal(r.misto, true);
    assert.equal(r.compensacao?.situacao, "acima");
  });

  it("diz o que falta em vez de calcular pela metade em silêncio", () => {
    const r = interpretar({ ph: 7.25, paco2: 30, hco3: 14 });
    assert.ok(r.faltando.some((f) => f.includes("Na e Cl")));
    assert.equal(r.anionGap, undefined);
  });
});

describe("via aérea pediátrica — tamanho do tubo", () => {
  it("soma anos e meses", () => {
    assert.equal(idadeEmMeses({ idadeAnos: 2, idadeMeses: 6 }), 30);
  });

  it("4 anos: com cuff 4,5 e sem cuff 5,0", () => {
    const s = sugerirTubo({ idadeAnos: 4 });
    assert.equal(s?.origem, "fórmula da idade");
    assert.equal(s?.comCuff?.calculado, 4.5);
    assert.equal(s?.semCuff?.calculado, 5);
  });

  it("oferece a opção acima e a abaixo do calculado", () => {
    const s = sugerirTubo({ idadeAnos: 4 });
    assert.equal(s?.comCuff?.abaixo, 4);
    assert.equal(s?.comCuff?.acima, 5);
  });

  it("abaixo de 1 ano usa a tabela por peso, não a fórmula da idade", () => {
    const s = sugerirTubo({ idadeMeses: 1, pesoKg: 3.4 });
    assert.equal(s?.origem, "tabela por peso");
    assert.equal(s?.semCuff?.sugerido, 3.5);
  });

  it("prematuro de 900 g recebe 2,5 mm", () => {
    assert.equal(sugerirTubo({ idadeMeses: 0, pesoKg: 0.9 })?.semCuff?.sugerido, 2.5);
  });

  it("sem peso, abaixo de 1 ano avisa em vez de chutar", () => {
    const s = sugerirTubo({ idadeMeses: 2 });
    assert.match(s?.aviso ?? "", /peso/);
  });

  it("arredonda para calibre que existe", () => {
    assert.equal(calibreMaisProximo(4.3), 4.5);
    assert.equal(calibreMaisProximo(4.1), 4);
  });
});

describe("via aérea pediátrica — profundidade", () => {
  it("4 anos: 14 cm pela idade e 13,5 cm pelo tubo de 4,5", () => {
    const p = profundidadeOral({ idadeAnos: 4 }, 4.5);
    assert.equal(p?.pelaIdade, 14);
    assert.equal(p?.peloTubo, 13.5);
    assert.equal(p?.sugerida, "13.5–14 cm");
  });

  it("abaixo de 2 anos não aplica a fórmula da idade", () => {
    const p = profundidadeOral({ idadeMeses: 6 }, 3.5);
    assert.equal(p?.pelaIdade, undefined);
    assert.equal(p?.peloTubo, 10.5);
  });
});

describe("orientações da gasometria", () => {
  const caso = { ph: 7.25, paco2: 30, hco3: 14, na: 140, cl: 104, lactato: 5, pao2: 74, fio2: 40 };

  it("com AG aumentado, lista as causas de AG aumentado e não as hiperclorêmicas", () => {
    const r = interpretar(caso);
    const o = orientacoes(caso, r, REFERENCIAS);
    const causas = o.find((b) => b.titulo.includes("Causas"));
    assert.ok(causas!.itens.some((i) => /cetoacidose/i.test(i)));
    assert.ok(!causas!.itens.some((i) => /diarreia/i.test(i)));
  });

  it("com AG normal, troca a lista para as causas hiperclorêmicas", () => {
    const g = { ph: 7.3, paco2: 32, hco3: 17, na: 140, cl: 111 };
    const causas = orientacoes(g, interpretar(g), REFERENCIAS).find((b) => b.titulo.includes("Causas"));
    assert.ok(causas!.itens.some((i) => /diarreia/i.test(i)));
  });

  it("lactato alto entra em atenção imediata", () => {
    const o = orientacoes(caso, interpretar(caso), REFERENCIAS);
    assert.equal(o[0].tom, "critico");
    assert.ok(o[0].itens.some((i) => /Lactato/.test(i)));
  });

  it("classifica a P/F e lembra da exigência de PEEP", () => {
    const bloco = orientacoes(caso, interpretar(caso), REFERENCIAS).find((b) => b.titulo === "Oxigenação");
    assert.ok(bloco!.itens.some((i) => /moderada/.test(i)));
    assert.ok(bloco!.itens.some((i) => /PEEP/.test(i)));
  });

  it("gasometria normal não gera orientação nenhuma", () => {
    const g = { ph: 7.4, paco2: 40, hco3: 24 };
    assert.equal(orientacoes(g, interpretar(g), REFERENCIAS).length, 0);
  });
});

describe("correções com alvo definido por quem usa", () => {
  it("déficit de bicarbonato de 70 kg, de 14 para 20, é 126 mEq", () => {
    assert.equal(deficitBicarbonato(70, 14, 20), 126);
  });

  it("não devolve déficit quando o alvo é menor que o medido", () => {
    assert.equal(deficitBicarbonato(70, 20, 14), undefined);
  });

  it("ventilação para baixar PaCO2 de 60 para 40 sobe de 6 para 9 L/min", () => {
    assert.equal(ventilacaoParaAlvo(6, 60, 40), 9);
  });

  it("frequência acompanha a mesma relação", () => {
    assert.equal(frequenciaParaAlvo(12, 60, 40), 18);
  });

  it("alvo zerado não divide por zero", () => {
    assert.equal(ventilacaoParaAlvo(6, 60, 0), undefined);
  });
});
