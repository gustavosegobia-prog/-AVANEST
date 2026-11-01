import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acharProtocolo, itensDaCategoria, PROTOCOLOS, PROTOCOLOS_DA_PREVIA, rascunhoDe } from "./catalogo.ts";
import { APROVACOES, aprovado } from "./aprovacao.ts";
import {
  calcularDose, calcularVolume, doseServe, frascosDaDose, passosDe, pesoNaFaixa, populacaoDe, volumeServe, type PacienteDaConsulta,
} from "./calculo.ts";
import { acharReferencia } from "./referencias.ts";
import { agendaHipercalemia, lipidioAcumulado, sugestaoLipidio } from "./relogios.ts";
import { METABOLICAS_APOIO_V3 } from "./protocolos/metabolicas-apoio.ts";
import type { Protocolo } from "./tipos.ts";

// Revisão 4 (01/11/2026): LAST, hipercalemia, hipertermia maligna, os 10 Ts,
// o resultado da crise e o colega afetado. Rascunhos, "corrigido —
// aguardando validação médica"; quem usa continua com a versão 2.

const IDS = ["toxicidade-anestesico-local", "hipercalemia", "hipertermia-maligna", "evento-sem-diagnostico", "depois-da-crise", "colega-afetado"];
const r = (id: string) => rascunhoDe(id)!;
const doseDe = (p: Protocolo, id: string) => p.medicamentos.find((m) => m.id === id)!;
const volDe = (p: Protocolo, id: string) => p.volumes.find((v) => v.id === id)!;
// Pacientes fictícios: 14 e 20 kg são crianças; 40, 70 e 100 kg, adultos.
const PAC: Record<number, PacienteDaConsulta> = {
  14: { idadeAnos: 3, pesoKg: 14 }, 20: { idadeAnos: 6, pesoKg: 20 }, 40: { idadeAnos: 15, pesoKg: 40 },
  70: { idadeAnos: 40, pesoKg: 70 }, 100: { idadeAnos: 45, pesoKg: 100 },
};
const PESOS = [14, 20, 40, 70, 100] as const;
const conta = (p: Protocolo, id: string, pac: PacienteDaConsulta, i = 0) => {
  const c = calcularDose(doseDe(p, id), p, pac, i);
  return { bloqueio: c.bloqueio, alertas: c.alertas, bruto: c, contas: c.contas.map((x) => [x.doseTotal, x.unidadeDose, x.volume, x.unidadeVolume]) };
};
const titulos = (p: Protocolo) => passosDe(p, null).map((x) => x.texto);
const as = (hhmm: string, dia = 15) => { const [h, m] = hhmm.split(":").map(Number); return new Date(2026, 10, dia, h, m, 0, 0).getTime(); };

test("revisão 4: os seis em rascunho, versão 3, sem aprovação; a versão 2 aprovada continua com quem usa", () => {
  assert.deepEqual(METABOLICAS_APOIO_V3.map((p) => p.id), IDS);
  for (const id of IDS) {
    const publicado = acharProtocolo(id)!;
    assert.equal(publicado.versao, 2, id);
    assert.ok(aprovado(publicado), `${id}: a versão 2 deixou de ser aprovada`);
    assert.equal(r(id).versao, 3, id);
    assert.equal(r(id).atualizadoEm, "2026-11-01", id);
    assert.equal(aprovado(r(id)), false, `${id}: rascunho aprovado sem autorização`);
    assert.equal(PROTOCOLOS_DA_PREVIA.find((p) => p.id === id), r(id), id);
    assert.ok(!PROTOCOLOS.includes(r(id)), id);
  }
  assert.equal(APROVACOES.length, 2, "nenhuma aprovação nova");
  // As três emergências passam a "Outras emergências", como pede o texto; o título novo da LAST cobre o previsto antigo.
  for (const id of IDS.slice(0, 3)) assert.equal(r(id).categoria, "outras", id);
  const outras = itensDaCategoria("outras", PROTOCOLOS_DA_PREVIA);
  assert.ok(outras.prontos.includes(r("toxicidade-anestesico-local")));
  assert.deepEqual(itensDaCategoria("medicamentos", PROTOCOLOS_DA_PREVIA).previstos.filter((x) => /anestésico/i.test(x.titulo)), []);
});

test("Agir agora completo e numerado, na ordem do texto (8, 10, 12, 10, 14 e 10 etapas)", () => {
  assert.deepEqual(titulos(r("toxicidade-anestesico-local")), [
    "Interrompa imediatamente o anestésico local.", "Solicite ajuda e o kit de resgate LAST.", "Avalie pulso, ritmo cardíaco e circulação.",
    "Garanta oxigenação e ventilação adequadas.", "Trate as convulsões prontamente.",
    "Administre emulsão lipídica IV a 20% precocemente na LAST grave.",
    "Trate a instabilidade cardiovascular com as modificações específicas da LAST.", "Continue o suporte até a estabilização.",
  ]);
  assert.deepEqual(titulos(r("hipercalemia")), [
    "Solicite ajuda e estabeleça monitorização contínua.", "Confirme a suspeita laboratorial sem atrasar o tratamento crítico.",
    "Interrompa as fontes evitáveis de potássio.", "Avalie a gravidade e o ECG.", "Proteja o miocárdio quando indicado.",
    "Inicie as medidas de deslocamento intracelular do potássio.", "Considere bicarbonato apenas em situações apropriadas.",
    "Inicie a estratégia de remoção do potássio.", "Reavalie potássio e glicemia seriados.", "Trate a causa e organize a terapia definitiva.",
  ]);
  assert.deepEqual(titulos(r("hipertermia-maligna")), [
    "Solicite ajuda e ative o protocolo institucional de HM.", "Suspenda imediatamente os desencadeantes.",
    "Mantenha a anestesia com agentes não desencadeantes.", "Administre dantroleno IV imediatamente.", "Hiperventile com oxigênio a 100%.",
    "Reduza a exposição residual a anestésicos voláteis.", "Organize a monitorização invasiva conforme a gravidade.",
    "Inicie o resfriamento quando indicado.", "Trate hipercalemia, acidose e arritmias.", "Monitore as complicações metabólicas e musculares.",
    "Mantenha a perfusão renal e o controle de volume.", "Organize UTI e o tratamento pós-crise.",
  ]);
  assert.deepEqual(titulos(r("evento-sem-diagnostico")), [
    "Tubos e sistema ventilatório.", "Hemorragia torrencial.", "Triptase — lembrar anafilaxia.", "Ritmo terminal ou doença cardíaca primária.",
    "Tamponamento cardíaco.", "Pneumotórax hipertensivo.", "Trombo e embolias.", "Tóxicos e distúrbios metabólicos.", "Bloqueio neuraxial total.",
    "Tumor ou emergência intracraniana.",
  ]);
  assert.equal(titulos(r("depois-da-crise")).length, 14);
  assert.equal(r("depois-da-crise").titulo, "Resultado da crise — cuidados pós-evento");
  assert.ok(r("depois-da-crise").sinonimos.includes("depois da crise"));
  assert.equal(titulos(r("colega-afetado")).length, 10);
  for (const p of METABOLICAS_APOIO_V3) {
    assert.equal(new Set(p.agirAgora.map((x) => x.texto)).size, p.agirAgora.length, p.id);
    for (const x of p.agirAgora) {
      assert.match(x.texto, /\.$/, `${p.id}: "${x.texto}"`);
      assert.ok(x.detalhe && /\.$/.test(x.detalhe), `${p.id}: "${x.texto}" sem detalhe completo`);
    }
    for (const campo of ["reconhecer", "pensarEm", "depois", "referencias"] as const) assert.ok(p[campo].length > 0, `${p.id}: ${campo}`);
  }
});

test("integridade do texto: trechos essenciais e ações críticas em destaque", () => {
  const tudo = (id: string) => r(id).agirAgora.map((x) => `${x.texto} ${x.detalhe ?? ""}`).join(" ");
  const trechos: Record<string, string[]> = {
    "toxicidade-anestesico-local": [
      "incluindo bombas de cateteres periféricos e epidurais", "considere precocemente a equipe de circulação extracorpórea/ECMO",
      "A ressuscitação na LAST exige adaptações em relação ao ACLS habitual.", "Evite hipóxia, hipercapnia e acidemia",
      "Benzodiazepínicos são preferíveis.", "A terapia lipídica não substitui o suporte ventilatório nem a RCP.",
      "considere amiodarona em vez de lidocaína", "Monitore o risco de recorrência pela redistribuição do anestésico.",
    ],
    hipercalemia: [
      "inicie o tratamento sem aguardar nova coleta", "Não interrompa automaticamente transfusão salvadora",
      "não elimina potássio do organismo nem reduz diretamente sua concentração sérica",
      "Não utilizar bicarbonato de sódio rotineiramente em todo paciente hipercalêmico", "Solicite avaliação nefrológica precoce",
      "Considere hemodiálise urgente diante de hipercalemia refratária",
    ],
    "hipertermia-maligna": [
      "Desative ou remova o vaporizador.", "Dose inicial de referência: 2,5 mg/kg IV.",
      "Não aguarde obrigatoriamente 10 a 15 minutos entre doses se a crise continuar ativa.", "pelo menos 10 L/min",
      "Não atrase o dantroleno para trocar toda a máquina de anestesia.", "Não realizar expansão volêmica ou diurese forçada indiscriminadamente.",
      "vigilância da recorrência da crise por pelo menos 24 horas",
    ],
    "evento-sem-diagnostico": ["Triptase é exame de apoio diagnóstico, não medida que deve preceder a administração de adrenalina.",
      "São mecanismos distintos e exigem protocolos próprios."],
    "depois-da-crise": [
      "Não indicar encaminhamento automático ao Instituto Médico-Legal em toda morte hospitalar.", "Respeitar a cadeia de custódia",
      "Não obrigue os profissionais a compartilhar experiências emocionais pessoais em grupo.", "Não criar prontuário paralelo informal.",
      "Não instituir afastamento obrigatório de 24 horas para todo evento sem avaliação individual e política institucional.",
    ],
    "colega-afetado": ["Registre fatos observáveis", "Não presumir que conversa informal seja suficiente",
      "mantenha o processo formal distinto do cuidado clínico ao profissional"],
  };
  for (const [id, lista] of Object.entries(trechos)) for (const t of lista) assert.ok(tudo(id).includes(t), `${id}: falta "${t}"`);
  assert.ok(r("hipercalemia").reconhecer.some((x) => x.includes("leve, 5,5–5,9 mmol/L; moderada, 6,0–6,4 mmol/L; grave, ≥6,5 mmol/L")));
  assert.ok(r("hipertermia-maligna").reconhecer.includes("Não esperar hipertermia evidente para iniciar o tratamento."));
  assert.ok(r("evento-sem-diagnostico").reconhecer.some((x) => /extensão oficial dos 5Hs e 5Ts/.test(x)));
  // As ações críticas aparecem em destaque.
  for (const id of IDS.slice(0, 3)) assert.ok((r(id).alertas ?? []).length >= 3, id);
  assert.match(r("toxicidade-anestesico-local").alertas![0], /até 1 mcg\/kg.*Não programar o bolus de 1 mg/);
  assert.match(r("hipercalemia").alertas![0], /Nunca administrar cálcio e bicarbonato misturados/);
});

test("LAST: emulsão lipídica por peso (14, 20, 40, 70 e 100 kg), em mL/kg, criança pendente", () => {
  const last = r("toxicidade-anestesico-local");
  const servem = (kg: number) => last.volumes.filter((v) => {
    const pop = populacaoDe(PAC[kg])!;
    return volumeServe(v, pop, PAC[kg].pesoKg);
  }).map((v) => [v.id, calcularVolume(v, PAC[kg]).texto]);
  // Criança (14 e 20 kg): nenhum cálculo de lipídio — pendente de homologação.
  assert.deepEqual(servem(14), []);
  assert.deepEqual(servem(20), []);
  // 40 kg: regime por kg — bolus 60 mL; 10 mL/min = 600 mL/h; dobrada 1200 mL/h; limite 480 mL.
  assert.deepEqual(servem(40), [["lipidio-bolus", "60 mL"], ["lipidio-infusao-min", "10 mL/min"], ["lipidio-infusao", "600 mL/h"],
    ["lipidio-infusao-dobrada", "1200 mL/h"], ["lipidio-teto", "480 mL"]]);
  // 70 kg e 100 kg: esquema simplificado — 100 mL e 250 mL; limite 840 e 1200 mL.
  assert.deepEqual(servem(70), [["lipidio-bolus-70", "100 mL"], ["lipidio-infusao-70", "250 mL"], ["lipidio-teto", "840 mL"]]);
  assert.deepEqual(servem(100), [["lipidio-bolus-70", "100 mL"], ["lipidio-infusao-70", "250 mL"], ["lipidio-teto", "1200 mL"]]);
  // Sem peso, os dois regimes aparecem (para o profissional escolher pelo peso); a conta pede o peso.
  assert.ok(last.volumes.every((v) => pesoNaFaixa(v, null)));
  assert.equal(calcularVolume(volDe(last, "lipidio-bolus"), { idadeAnos: 40, pesoKg: null }).bloqueio, "Informe o peso para calcular.");
  // mL/min com uma casa: 14 × 0,25 = 3,5 (e não 4).
  assert.equal(calcularVolume(volDe(last, "lipidio-infusao-min"), { idadeAnos: 40, pesoKg: 14 }).texto, "3,5 mL/min");
  // Sempre em mL/kg, nunca em mg/kg.
  for (const v of last.volumes) {
    assert.doesNotMatch(`${v.indicacao.replace("nunca em mg/kg", "")} ${calcularVolume(v, PAC[40]).base}`, /mg\/kg/, v.id);
    assert.equal(v.populacao, "adulto", v.id);
  }
  assert.match(calcularVolume(volDe(last, "lipidio-teto"), PAC[40]).base, /^12 mL\/kg$/);
  assert.match(volDe(last, "lipidio-teto").indicacao, /nunca em mg\/kg/);
  // A divergência dos limites fica registrada, sem alternar automaticamente.
  const d = last.divergencias.find((x) => /emulsão lipídica/.test(x.tema))!;
  assert.deepEqual(d.posicoes.map((x) => x.referencia), ["manual-20", "asra-2020-last", "saesp-tratado"]);
  assert.match(d.escolha, /Criança: calculadora pendente de homologação/);
  assert.ok(!acharProtocolo("toxicidade-anestesico-local")!.volumes.every((v) => v.populacao === "adulto"), "a versão 2 publicada não mudou");
});

test("LAST: volume acumulado de lipídio contra 12 mL/kg, e adrenalina até 1 mcg/kg", () => {
  assert.equal(sugestaoLipidio(null), null);
  assert.deepEqual(sugestaoLipidio(40), { regime: "abaixo-de-70", bolusMl: 60, limiteMl: 480,
    taxas: [{ rotulo: "0,25 mL/kg/min", mlH: 600 }, { rotulo: "Dobrada: 0,5 mL/kg/min", mlH: 1200 }] });
  assert.equal(sugestaoLipidio(70)!.regime, "a-partir-de-70");
  assert.equal(sugestaoLipidio(70)!.bolusMl, 100);
  assert.equal(sugestaoLipidio(100)!.limiteMl, 1200);
  // 70 kg: 2 bolus (200 mL) + 15 min a 1000 mL/h (250 mL) = 450 de 840 mL.
  const t0 = as("10:00");
  const e = lipidioAcumulado({ bolusMl: 200, infundidoMl: 0, taxaMlH: 1000, inicioMs: t0, agoraMs: t0 + 15 * 60_000, limiteMl: 840 });
  assert.equal(Math.round(e.totalMl), 450);
  assert.equal(e.nivel, "info");
  assert.match(e.mensagem, /^Acumulado: 450 de 840 mL \(12 mL\/kg\); restam 390 mL, alcançados às 10:38 nesta taxa\.$/);
  // Perto do limite, atenção; acima, perigo.
  assert.equal(lipidioAcumulado({ bolusMl: 700, infundidoMl: 0, taxaMlH: 0, inicioMs: null, agoraMs: t0, limiteMl: 840 }).nivel, "atencao");
  const passou = lipidioAcumulado({ bolusMl: 300, infundidoMl: 600, taxaMlH: 0, inicioMs: null, agoraMs: t0, limiteMl: 840 });
  assert.equal(passou.nivel, "perigo");
  assert.match(passou.mensagem, /^Limite acumulado atingido: 900 de 840 mL/);
  // Adrenalina até 1 mcg/kg na solução de 10 mcg/mL.
  const last = r("toxicidade-anestesico-local");
  for (const kg of PESOS) assert.deepEqual(conta(last, "adrenalina-last", PAC[kg]).contas, [[kg, "mcg", kg / 10, "mL"]], `${kg} kg`);
  assert.ok(doseDe(last, "adrenalina-last").altoRisco);
  assert.equal(conta(last, "adrenalina-last", { idadeAnos: 40, pesoKg: null }).bloqueio, "Informe o peso para calcular.");
});

test("hipercalemia: sais de cálcio equivalentes, insulina com glicose, prevenção de hipoglicemia e criança sem cálculo", () => {
  const h = r("hipercalemia");
  for (const kg of [40, 70, 100]) {
    assert.deepEqual(conta(h, "cloreto-de-calcio-hipercalemia", PAC[kg]).contas, [[1, "g", 10, "mL"]], `cloreto ${kg} kg`);
    assert.deepEqual(conta(h, "gluconato-hipercalemia", PAC[kg]).contas, [[3, "g", 30, "mL"]], `gluconato ${kg} kg`);
    assert.deepEqual(conta(h, "insulina-hipercalemia", PAC[kg]).contas, [[10, "UI", 10, "mL"]]);
    assert.deepEqual(conta(h, "glicose-hipercalemia", PAC[kg]).contas, [[25, "g", 50, "mL"]]);
    assert.deepEqual(conta(h, "glicose-hipercalemia", PAC[kg], 1).contas, [[25, "g", 125, "mL"]]);
    assert.deepEqual(conta(h, "glicose-hipercalemia", PAC[kg], 2).contas, [[25, "g", 250, "mL"]]);
    assert.deepEqual(conta(h, "glicose-prevencao-hipoglicemia", PAC[kg]).contas, [[5, "g", 50, "mL/h"]]);
    assert.deepEqual(conta(h, "salbutamol-hipercalemia", PAC[kg]).contas, [[10, "mg", 2, "mL"], [20, "mg", 4, "mL"]]);
  }
  // Cálcio elementar: cloreto di-hidratado (147 g/mol) 1 g ≈ 6,8 mmol; gluconato mono-hidratado (448 g/mol) 3 g ≈ 6,7 mmol.
  const cloretoMmol = 1000 / 147.01, gluconatoMmol = 3000 / 448.39;
  assert.ok(Math.abs(cloretoMmol - gluconatoMmol) / cloretoMmol < 0.03, "equivalentes em cálcio elementar");
  assert.equal(cloretoMmol.toFixed(1), "6.8");
  assert.equal(gluconatoMmol.toFixed(1), "6.7");
  assert.ok(h.notasDeDose!.some((x) => /cerca de 6,8 mmol.*cerca de 6,7 mmol.*não converter mL/.test(x)));
  for (const id of ["cloreto-de-calcio-hipercalemia", "gluconato-hipercalemia"]) {
    const c = doseDe(h, id).cuidados!.join(" ");
    assert.match(c, /não elimina o potássio nem reduz diretamente sua concentração sérica/, id);
    assert.match(c, /não converter mL de uma formulação para a outra/, id);
  }
  assert.match(doseDe(h, "cloreto-de-calcio-hipercalemia").velocidade!, /5 minutos/);
  assert.match(doseDe(h, "gluconato-hipercalemia").velocidade!, /10 minutos/);
  assert.ok(doseDe(h, "insulina-hipercalemia").altoRisco);
  assert.match(doseDe(h, "insulina-hipercalemia").cuidados![0], /dose em unidades.*a 1 UI\/mL, 10 UI = 10 mL/);
  assert.match(doseDe(h, "glicose-prevencao-hipoglicemia").indicacao, /abaixo de 7 mmol\/L \(126 mg\/dL\)/);
  assert.match(doseDe(h, "glicose-prevencao-hipoglicemia").repeticao!, /5 horas/);
  assert.match(doseDe(h, "salbutamol-hipercalemia").indicacao, /nunca como único tratamento/);
  // Criança (14 e 20 kg): nenhuma dose — ramo separado, sem cálculo automático.
  for (const kg of [14, 20]) {
    const pop = populacaoDe(PAC[kg])!;
    assert.deepEqual(h.medicamentos.filter((d) => doseServe(d, pop, PAC[kg].idadeAnos, PAC[kg].pesoKg)).map((d) => d.id), [], `${kg} kg`);
  }
  assert.ok(h.quadros!.some((q) => /Criança — ramo separado/.test(q.titulo) && q.itens!.some((x) => /sem cálculo pediátrico automático/.test(x))));
  assert.ok(acharProtocolo("hipercalemia")!.medicamentos.some((d) => d.populacao === "pediatrico"), "a versão 2 publicada não mudou");
  assert.equal(h.ferramenta, "agenda-hipercalemia");
});

test("hipercalemia: agenda de glicemias (0 a 360 min) e de potássio (1, 2, 4, 6 e 24 h) a partir da insulina", () => {
  const t0 = as("10:00");
  const { itens, proximo } = agendaHipercalemia(t0, as("10:20"));
  assert.deepEqual(itens.filter((x) => x.tipo === "Glicemia").map((x) => x.minuto), [0, 30, 60, 90, 120, 180, 240, 300, 360]);
  assert.deepEqual(itens.filter((x) => x.tipo === "Potássio").map((x) => x.minuto / 60), [1, 2, 4, 6, 24]);
  assert.deepEqual([proximo!.tipo, proximo!.minuto], ["Glicemia", 30]);
  assert.equal(itens[0].passou, true);
  // Às 11:00, a glicemia e o potássio da primeira hora juntos, glicemia primeiro.
  const umaHora = agendaHipercalemia(t0, as("11:00")).itens.filter((x) => x.minuto === 60).map((x) => x.tipo);
  assert.deepEqual(umaHora, ["Glicemia", "Potássio"]);
  assert.equal(agendaHipercalemia(t0, as("10:00", 17)).proximo, null, "depois de 24 horas, nada pendente");
  assert.deepEqual(r("hipercalemia").quadros![0].itens, [
    "Glicemia após a insulina: 0, 30, 60, 90, 120, 180, 240, 300 e 360 minutos.",
    "Potássio após tratamento de hipercalemia moderada ou grave: pelo menos em 1, 2, 4, 6 e 24 horas, antecipando as coletas se houver instabilidade.",
    "Na sala, os controles que couberem nela; ao sair, entregar os horários seguintes à equipe da clínica cirúrgica (ou da UTI), que assume o acompanhamento.",
  ]);
});

test("hipertermia maligna: dantroleno por peso real, frascos de 20 mg e de 250 mg separados", () => {
  const hm = r("hipertermia-maligna");
  const ini = doseDe(hm, "dantroleno-inicial");
  assert.deepEqual(ini.apresentacoes.map((a) => a.frasco), [
    { quantidade: 20, unidade: "mg", diluenteMl: 60, volumeFinalMl: 60 },
    { quantidade: 250, unidade: "mg", diluenteMl: 5, volumeFinalMl: 5 },
  ]);
  const esperado20 = { 14: [35, 105, 2, 120], 20: [50, 150, 3, 180], 40: [100, 300, 5, 300], 70: [175, 525, 9, 540], 100: [250, 750, 13, 780] } as const;
  const esperado250 = { 14: [35, 0.7], 20: [50, 1], 40: [100, 2], 70: [175, 3.5], 100: [250, 5] } as const;
  for (const kg of PESOS) {
    const [mg, mL, frascos, diluente] = esperado20[kg];
    const c20 = conta(hm, "dantroleno-inicial", PAC[kg], 0);
    assert.deepEqual(c20.contas, [[mg, "mg", mL, "mL"]], `20 mg, ${kg} kg`);
    assert.deepEqual(frascosDaDose(c20.bruto, ini.apresentacoes[0]), { frascos, quantidade: frascos * 20, unidade: "mg", diluenteMl: diluente, volumeFinalMl: frascos * 60 });
    const c250 = conta(hm, "dantroleno-inicial", PAC[kg], 1);
    assert.deepEqual(c250.contas, [[esperado250[kg][0], "mg", esperado250[kg][1], "mL"]], `250 mg, ${kg} kg`);
    assert.deepEqual(frascosDaDose(c250.bruto, ini.apresentacoes[1]), { frascos: 1, quantidade: 250, unidade: "mg", diluenteMl: 5, volumeFinalMl: 5 });
    // Manutenção 1 mg/kg.
    assert.deepEqual(conta(hm, "dantroleno-manutencao", PAC[kg], 1).contas, [[kg, "mg", kg / 50, "mL"]], `manutenção ${kg} kg`);
  }
  // 7,5 mL/kg (20 mg) e 0,05 mL/kg (250 mg), como no texto.
  assert.equal(conta(hm, "dantroleno-inicial", PAC[70], 0).contas[0][2], 7.5 * 70);
  assert.equal(conta(hm, "dantroleno-inicial", PAC[70], 1).contas[0][2], 0.05 * 70);
  // Os preparos não se misturam.
  const [p20, p250] = ini.apresentacoes;
  assert.match(p20.preparo!, /60 mL.*frasco de 20 mg/);
  assert.doesNotMatch(p20.preparo!, /\b5 mL|250 mg/);
  assert.match(p250.preparo!, /5 mL.*frasco de 250 mg/);
  assert.doesNotMatch(p250.preparo!, /60 mL|20 mg/);
  for (const a of ini.apresentacoes) assert.equal(a.quantidade / a.mL, a.frasco!.quantidade / a.frasco!.volumeFinalMl, a.rotulo);
  // Sem teto absoluto de 10 mg/kg; alto risco e peso obrigatório.
  assert.equal(ini.tetoAbsoluto, undefined);
  assert.ok(ini.cuidados!.some((x) => /10 mg\/kg não é teto absoluto/.test(x)));
  assert.ok(ini.altoRisco && doseDe(hm, "dantroleno-manutencao").altoRisco);
  assert.equal(conta(hm, "dantroleno-inicial", { idadeAnos: 40, pesoKg: null }).bloqueio, "Informe o peso para calcular.");
  assert.equal(frascosDaDose(conta(hm, "dantroleno-inicial", { idadeAnos: 40, pesoKg: null }).bruto, p20), null);
  // O resfriamento: no passo só a diretriz escolhida (38 °C); a da EMHG (38,5 °C) fica nas diferenças entre as fontes.
  const resfriar = passosDe(hm, null).find((x) => x.texto.startsWith("Inicie o resfriamento"))!.detalhe!;
  assert.match(resfriar, /abaixo de 38 °C.*diretriz selecionada: MHAUS/);
  assert.doesNotMatch(resfriar, /38,5/);
  const d = hm.divergencias.find((x) => /resfriamento/.test(x.tema))!;
  assert.deepEqual(d.posicoes.map((x) => [x.referencia, x.texto]), [["mhaus-crise", "Abaixo de 38 °C."], ["emhg-2024-hm", "Abaixo de 38,5 °C."]]);
  assert.ok(acharProtocolo("hipertermia-maligna")!.medicamentos[0].apresentacoes.every((a) => !a.frasco), "a versão 2 publicada não mudou");
});

test("as doses que continuam são as da versão 2 — o que mudou é só o que o texto mandou", () => {
  const mudou: string[] = [];
  for (const id of IDS) {
    const antes = acharProtocolo(id)!;
    for (const d of r(id).medicamentos) {
      const v2 = antes.medicamentos.find((m) => m.id === d.id);
      if (!v2) continue;
      for (const campo of ["dose", "apresentacoes", "via", "tetoAbsoluto"] as const) {
        if (JSON.stringify(d[campo]) !== JSON.stringify(v2[campo])) mudou.push(`${d.id}.${campo}`);
      }
    }
  }
  assert.deepEqual(mudou, ["glicose-hipercalemia.apresentacoes", "dantroleno-inicial.apresentacoes", "dantroleno-manutencao.apresentacoes"]);
  const novas = METABOLICAS_APOIO_V3.flatMap((p) => p.medicamentos.filter((d) => !acharProtocolo(p.id)!.medicamentos.some((m) => m.id === d.id)).map((d) => d.id));
  assert.deepEqual(novas, ["glicose-prevencao-hipoglicemia"]);
  const saem = METABOLICAS_APOIO_V3.flatMap((p) => acharProtocolo(p.id)!.medicamentos.filter((m) => !p.medicamentos.some((d) => d.id === m.id)).map((m) => m.id));
  assert.deepEqual(saem, ["cloreto-de-calcio-hipercalemia-ped", "gluconato-hipercalemia-ped", "insulina-hipercalemia-ped", "glicose-hipercalemia-ped"]);
  // Os três cartões de apoio continuam sem calculadora.
  for (const id of IDS.slice(3)) assert.deepEqual([r(id).medicamentos.length, r(id).volumes.length], [0, 0], id);
});

test("vias: nenhuma dose com apresentação de outra via", () => {
  for (const p of METABOLICAS_APOIO_V3) {
    for (const d of p.medicamentos) {
      d.apresentacoes.forEach((_, i) => {
        const perigo = calcularDose(d, p, PAC[70], i).alertas.filter((a) => /Confira antes de aspirar/.test(a.texto));
        assert.deepEqual(perigo, [], `${p.id}/${d.id}`);
      });
    }
  }
});

test("navegação: os links pedidos existem e todo destino está no catálogo", () => {
  const destinos = (id: string) => [...(r(id).relacionados ?? []), ...r(id).agirAgora.flatMap((x) => (x.abre ? [x.abre] : []))].map((x) => x.protocolo);
  const pedidos: Array<[string, string]> = [
    ["toxicidade-anestesico-local", "pcr-fv-tv"], ["toxicidade-anestesico-local", "convulsao-perioperatoria"], ["toxicidade-anestesico-local", "sav-pediatrico"],
    ["hipercalemia", "pcr-aesp-assistolia"], ["hipercalemia", "hipertermia-maligna"],
    ["hipertermia-maligna", "hipercalemia"], ["hipertermia-maligna", "taquiarritmia"],
    ["evento-sem-diagnostico", "hemorragia-macica"], ["evento-sem-diagnostico", "anafilaxia"], ["evento-sem-diagnostico", "pneumotorax-hipertensivo"],
    ["evento-sem-diagnostico", "embolia-pulmonar"], ["evento-sem-diagnostico", "toxicidade-anestesico-local"], ["evento-sem-diagnostico", "bloqueio-neuroaxial-alto"],
    ["depois-da-crise", "colega-afetado"], ["colega-afetado", "depois-da-crise"],
  ];
  for (const [de, para] of pedidos) assert.ok(destinos(de).includes(para), `${de} → ${para}`);
  for (const p of METABOLICAS_APOIO_V3) for (const alvo of destinos(p.id)) assert.ok(acharProtocolo(alvo), `${p.id} → ${alvo}`);
  // Os 10 Ts: oito itens com o botão para o protocolo da causa (tamponamento e causa intracraniana não têm protocolo próprio).
  assert.equal(r("evento-sem-diagnostico").agirAgora.filter((x) => x.abre).length, 8);
});

test("tela: volumes pelo peso, frascos do dantroleno e ferramenta do lipídio com o ramo da criança", () => {
  const tela = readFileSync(new URL("../../components/intercorrencias/protocolo.tsx", import.meta.url), "utf8");
  assert.match(tela, /volumeServe\(v, populacao\)\) && pesoNaFaixa\(v, paciente\.pesoKg\)/);
  assert.match(tela, /const frascos = frascosDaDose\(conta, original\)/);
  assert.match(tela, /frascos && original\?\.frasco && !bloqueio/);
  assert.match(tela, /estilos\.frascos\} \$\{precisaConfirmar \? estilos\.soImpressao : ""\}/, "frascos só depois de conferir a concentração");
  const relogios = readFileSync(new URL("../../components/intercorrencias/relogios.tsx", import.meta.url), "utf8");
  for (const chave of ["lipidio:bolus", "lipidio:infundido", "lipidio:taxa", "lipidio:inicio", "cronometro:insulina"]) assert.ok(relogios.includes(`"${chave}"`), chave);
  assert.match(relogios, /populacao === "pediatrico" \|\| populacao === "neonatal"/);
  assert.match(relogios, /pendente de homologação/);
  assert.match(relogios, /window\.confirm\("Zerar o volume acumulado de emulsão lipídica\?"\)/);
  assert.equal(r("toxicidade-anestesico-local").ferramenta, "lipidio-acumulado");
});

test("referências: as quatro fontes conferidas pelo responsável e as novas cadastradas", () => {
  for (const id of ["asra-2020-last", "ukka-2026-hipercalemia", "mhaus-crise", "emhg-2024-hm"]) {
    const ref = acharReferencia(id)!;
    assert.equal(ref.conferida, true, id);
    assert.match(ref.observacao!, /Conferida pelo responsável médico em 01\/11\/2026/, id);
    assert.doesNotMatch(ref.link ?? "", /utm_source/, id);
  }
  assert.equal(acharReferencia("ukka-2026-hipercalemia")!.link, "https://www.ukkidney.org/health-professionals/guidelines/treatment-acute-hyperkalaemia-adults-0");
  for (const id of ["rcuk-2025-circunstancias", "saesp-hm"]) assert.equal(acharReferencia(id)!.conferida, false, id);
  for (const p of METABOLICAS_APOIO_V3) {
    const usados = [...p.referencias, ...p.medicamentos.flatMap((d) => d.referencias), ...p.volumes.flatMap((v) => v.referencias),
      ...p.divergencias.flatMap((d) => d.posicoes.map((x) => x.referencia))];
    for (const id of usados) assert.ok(acharReferencia(id), `${p.id}: ${id}`);
  }
});

test("acompanhamento: o anestesiologista na sala; depois, passagem de cuidado à clínica cirúrgica (ou à UTI)", () => {
  const depois = (id: string) => r(id).depois.join(" ");
  assert.match(depois("toxicidade-anestesico-local"), /^Na sala: manter a monitorização até a estabilidade\. Na passagem de cuidado à clínica cirúrgica \(ou à UTI\), que acompanha o paciente depois da sala, orientar a observação/);
  assert.match(depois("hipercalemia"), /Na passagem à clínica cirúrgica \(ou à UTI\): entregar os horários de glicemia \(até 360 minutos da insulina\) e de potássio \(1, 2, 4, 6 e 24 horas\)/);
  assert.match(depois("hipertermia-maligna"), /^Na passagem para a UTI: monitorização intensiva por pelo menos 24 horas/);
  assert.match(passosDe(r("hipertermia-maligna"), null)[11].detalhe!, /passagem estruturada para a UTI, que assume o acompanhamento/);
  const resultado = passosDe(r("depois-da-crise"), null);
  assert.match(resultado[1].detalhe!, /passagem estruturada à clínica cirúrgica \(ou à UTI\), que assume o acompanhamento depois da sala/);
  assert.match(resultado[6].detalhe!, /O anestesiologista acompanha o paciente na sala; depois dela, o acompanhamento é da clínica cirúrgica \(ou da UTI\)/);
  assert.ok(r("hipercalemia").quadros![0].itens!.some((x) => /ao sair, entregar os horários seguintes à equipe da clínica cirúrgica/.test(x)));
  // Nenhum "Depois" dos seis manda o anestesiologista acompanhar o pós-operatório.
  for (const p of METABOLICAS_APOIO_V3) assert.doesNotMatch(p.depois.join(" "), /^Acompanhar ECG|^Monitorização intensiva por/, p.id);
  const relogios = readFileSync(new URL("../../components/intercorrencias/relogios.tsx", import.meta.url), "utf8");
  assert.match(relogios, /Ao sair da sala, entregar os horários seguintes à equipe da clínica cirúrgica \(ou da UTI\), que assume o acompanhamento\./);
});
