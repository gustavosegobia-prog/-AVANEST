import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acharProtocolo, PROTOCOLOS_DA_PREVIA, PROTOCOLOS_LIBERADOS, rascunhoDe } from "./catalogo.ts";
import { APROVACOES, aprovacaoDe, aprovado } from "./aprovacao.ts";
import { bloqueioDoRamo, calcularDose, calcularVolume, passosDe, ramoDe, type PacienteDaConsulta } from "./calculo.ts";
import { acharReferencia } from "./referencias.ts";
import { ALVOS_SPO2, alvoSpO2, formatarTempo, horaParaMs, pcrMaterna, tranexamico } from "./relogios.ts";
import { OBSTETRICIA_NEONATAL_V3 } from "./protocolos/obstetricia-neonatal.ts";
import type { Protocolo } from "./tipos.ts";

// Revisão obstétrica e neonatal (01/11/2026), protocolos 16 a 19: rascunhos,
// "corrigido — aguardando validação médica". Quem usa continua com a versão 2.

const IDS = ["bloqueio-neuroaxial-alto", "hemorragia-pos-parto", "colapso-materno", "reanimacao-neonatal"];
// A versão 3 dos quatro cartões (a do Colapso materno tem uma 4 em validação depois dela).
const r = (id: string) => OBSTETRICIA_NEONATAL_V3.find((p) => p.id === id) ?? rascunhoDe(id)!;
const GESTANTE = { idadeAnos: 30, pesoKg: 70, gestante: true } as PacienteDaConsulta;
const ADULTO: PacienteDaConsulta = { idadeAnos: 40, pesoKg: 70 };
const RN = (pesoKg: number | null): PacienteDaConsulta => ({ idadeAnos: 0, pesoKg });
const doseDe = (p: Protocolo, id: string) => p.medicamentos.find((m) => m.id === id)!;
const conta = (p: Protocolo, id: string, pac: PacienteDaConsulta, i = 0) => {
  const c = calcularDose(doseDe(p, id), p, pac, i);
  return { bloqueio: c.bloqueio, alertas: c.alertas, contas: c.contas.map((x) => [x.doseTotal, x.unidadeDose, x.volume, x.unidadeVolume]) };
};
const titulos = (p: Protocolo, ramo: string | null = null) => passosDe(p, null, ramo).map((x) => x.texto);
const tudo = (p: Protocolo) => p.agirAgora.map((x) => `${x.texto} ${x.detalhe ?? ""}`).join(" ");
// Um dia fixo, no horário local do teste.
const as = (hhmm: string, dia = 15) => { const [h, m] = hhmm.split(":").map(Number); return new Date(2026, 10, dia, h, m, 0, 0).getTime(); };

test("obstetrícia e neonatal: os quatro na versão 3, aprovada em 05/11/2026, que é a que vai para quem usa", () => {
  assert.deepEqual(OBSTETRICIA_NEONATAL_V3.map((p) => p.id), IDS);
  for (const id of IDS) {
    const publicado = acharProtocolo(id)!;
    assert.equal(publicado.versao, 2, id);
    assert.ok(aprovado(publicado), `${id}: a versão 2 deixou de ser aprovada`);
    const rascunho = r(id);
    assert.equal(rascunho.versao, 3, id);
    assert.equal(rascunho.atualizadoEm, "2026-11-01", id);
    assert.ok(aprovado(rascunho), `${id}: a versão 3 sem a aprovação de 05/11/2026`);
    assert.equal(PROTOCOLOS_DA_PREVIA.find((p) => p.id === id), rascunhoDe(id), id);
    assert.equal(PROTOCOLOS_LIBERADOS.find((p) => p.id === id), rascunho, `${id}: quem usa recebe a versão aprovada`);
  }
  assert.equal(APROVACOES.length, 4, "a terceira (os 40 rascunhos) e a quarta (Eclâmpsia 4) são de 05/11/2026");
  // O rascunho anterior do colapso (magnésio igual ao da Eclâmpsia) saiu: vale o texto novo.
  assert.deepEqual(doseDe(r("colapso-materno"), "magnesio-ataque").dose, { min: 4, max: 6, unidade: "g", por: "fixa" });
});

test("Agir agora completo e numerado, na ordem do texto clínico", () => {
  assert.deepEqual(titulos(r("bloqueio-neuroaxial-alto")), [
    "Solicite ajuda imediatamente.", "Mantenha comunicação com o paciente.", "Administre oxigênio e avalie a ventilação.",
    "Trate precocemente a hipotensão.", "Na gestante, alivie a compressão aortocava.", "Trate a bradicardia com repercussão.",
    "Prepare via aérea avançada quando necessário.", "Se houver perda de pulso, inicie RCP.", "Mantenha o suporte cardiorrespiratório.",
    "Defina a monitorização após a estabilização.",
  ]);
  assert.deepEqual(titulos(r("hemorragia-pos-parto")), [
    "Solicite ajuda imediatamente.", "Quantifique a perda sanguínea.", "Estabeleça acessos e monitorização.",
    "Inicie as medidas de primeira resposta simultaneamente.", "Identifique a causa — os quatro Ts.",
    "Administre ocitocina como uterotônico de primeira linha.", "Administre ácido tranexâmico precocemente.",
    "Inicie a ressuscitação circulatória.", "Ative o protocolo de transfusão maciça quando indicado.",
    "Escalone o controle da hemorragia.", "Corrija os distúrbios associados.", "Reavalie continuamente e planeje a recuperação.",
  ]);
  assert.deepEqual(titulos(r("colapso-materno")), [
    "Solicite ajuda e ative a equipe de emergência materna.", "Avalie consciência, respiração e circulação.",
    "Na ausência de pulso, inicie RCP imediatamente.", "Identifique o ritmo e siga o algoritmo correspondente.",
    "Priorize a oxigenação e a via aérea adequada.", "Garanta acesso vascular apropriado.",
    "Prepare imediatamente o parto ressuscitativo quando indicado.", "Identifique e trate causas reversíveis.",
    "Após o parto ou o retorno da circulação, continue o suporte avançado.", "Registre os tempos e organize os cuidados posteriores.",
  ]);
  const rn = r("reanimacao-neonatal");
  const doze = [
    "Inicie o cronômetro e avalie rapidamente o nascimento.", "Execute os cuidados iniciais de termorregulação.",
    "Avalie respiração, tônus e frequência cardíaca.", "Inicie ventilação com pressão positiva nos primeiros 60 segundos quando indicada.",
    "Monitore frequência cardíaca e SpO2.", "Se não houver melhora, corrija a ventilação.",
    "Se a ventilação permanecer inadequada, considere via aérea alternativa.", "Reavalie após ventilação efetiva.",
    "Inicie compressões coordenadas à ventilação.",
    "Se a FC permanecer <60 bpm após pelo menos 60 segundos de compressões e ventilação adequadas, administre adrenalina.",
    "Considere hipovolemia quando houver suspeita de perda sanguínea.", "Após a estabilização, inicie os cuidados pós-reanimação.",
  ];
  assert.deepEqual(titulos(rn, "34-ou-mais"), doze);
  assert.deepEqual(titulos(rn, "menos-de-34"), doze);
  assert.equal(titulos(rn).length, 24, "sem a escolha, os dois algoritmos");
  for (const p of OBSTETRICIA_NEONATAL_V3) {
    for (const x of p.agirAgora) {
      assert.match(x.texto, /\.$/, `${p.id}: "${x.texto}"`);
      assert.ok(x.detalhe && /\.$/.test(x.detalhe), `${p.id}: "${x.texto}" sem detalhe completo`);
    }
    for (const campo of ["reconhecer", "pensarEm", "depois", "referencias"] as const) assert.ok(p[campo].length > 0, `${p.id}: ${campo}`);
  }
});

test("integridade do texto: os trechos essenciais de cada cartão estão inteiros", () => {
  const trechos: Record<string, string[]> = {
    "bloqueio-neuroaxial-alto": [
      "interrompa qualquer administração adicional de anestésico pela via neuraxial",
      "Se houver hipoventilação ou apneia, inicie ventilação assistida sem demora.",
      "Não utilizar Trendelenburg como tratamento automático da hipotensão",
      "Não presumir inconsciência pelo bloqueio motor.",
      "Na gestante, aplicar o algoritmo de PCR materna e preparar parto ressuscitativo quando indicado.",
    ],
    "hemorragia-pos-parto": [
      "Não aguarde a conclusão de uma etapa para iniciar as demais.",
      "Tônus: atonia uterina. Trauma: lacerações, hematomas ou rotura. Tecido: retenção placentária e alterações de implantação. Trombina: coagulopatia.",
      "Não confundir com a profilaxia rotineira após o nascimento.",
      "e não apenas depois da falha de uterotônicos",
      "Não estabelecer volume fixo de cristaloide que obrigatoriamente precise ser administrado antes do sangue.",
      "concentração de pelo menos 2 g/L",
    ],
    "colapso-materno": [
      "Delegue compressões, via aérea, deslocamento uterino, acesso vascular, medicamentos e registro de tempos.",
      "faça deslocamento uterino manual contínuo para a esquerda",
      "não devem ser reduzidas exclusivamente pela gestação",
      "Preferir acesso IV ou IO acima do diafragma",
      "O objetivo é concluir o nascimento em até cinco minutos, se não houver retorno da circulação.",
      "Não aguarde completar quatro minutos para só então começar a preparação.",
      "Se ocorrer PCR durante infusão de sulfato de magnésio, interrompa a infusão e administre cálcio conforme o algoritmo materno.",
    ],
    "reanimacao-neonatal": [
      "Utilize frequência de 30–60 ventilações por minuto, conforme a SBP 2026.",
      "iniciar com FiO2 de referência de 60%",
      "Posicione o sensor pré-ductal no membro superior direito.",
      "Aspirar somente quando houver obstrução ou indicação específica.",
      "Se a frequência permanecer <60 bpm após 30 segundos de ventilação adequada com expansão pulmonar, inicie compressões torácicas.",
      "Utilize relação 3:1. Objetivo: 90 compressões e 30 ventilações por minuto, totalizando 120 eventos por minuto.",
      "preferencialmente cateter venoso umbilical",
    ],
  };
  for (const [id, lista] of Object.entries(trechos)) for (const t of lista) assert.ok(tudo(r(id)).includes(t), `${id}: falta "${t}"`);
  assert.ok(r("hemorragia-pos-parto").reconhecer.some((x) => x.includes("≥500 mL") && x.includes("≥300 mL")
    && /FC >100\/min, índice de choque >1, PAS <100 mmHg ou PAD <60 mmHg/.test(x)));
  assert.ok(r("bloqueio-neuroaxial-alto").reconhecer.some((x) => /pode permanecer consciente/.test(x)));
  assert.ok(r("reanimacao-neonatal").depois.some((x) => /≥36 semanas.*moderada ou grave.*seis horas/.test(x)));
  assert.ok(r("reanimacao-neonatal").depois.includes("Não iniciar hipotermia terapêutica indiscriminadamente em qualquer recém-nascido submetido a reanimação."));
});

test("bloqueio raquidiano total: ramos com pulso e em PCR separados, com doses que não se confundem", () => {
  const raqui = r("bloqueio-neuroaxial-alto");
  // Com pulso (70 kg, dose fixa): atropina 1 mg = 2 mL a 0,5 mg/mL; fenilefrina 50–100 mcg = 0,5–1 mL; efedrina 3–6 mg = 0,6–1,2 mL; adrenalina 10–20 mcg = 1–2 mL a 10 mcg/mL.
  assert.deepEqual(conta(raqui, "atropina-raqui", ADULTO).contas, [[1, "mg", 2, "mL"]]);
  assert.match(doseDe(raqui, "atropina-raqui").repeticao!, /3 a 5 minutos; máximo total de 3 mg/);
  assert.ok(doseDe(raqui, "atropina-raqui").cuidados!.includes("Não somar diferentes regimes de atropina provenientes de protocolos distintos."));
  assert.deepEqual(conta(raqui, "fenilefrina-raqui", ADULTO).contas, [[50, "mcg", 0.5, "mL"], [100, "mcg", 1, "mL"]]);
  assert.deepEqual(conta(raqui, "efedrina-raqui", ADULTO).contas, [[3, "mg", 0.6, "mL"], [6, "mg", 1.2, "mL"]]);
  assert.deepEqual(conta(raqui, "adrenalina-raqui", ADULTO).contas, [[10, "mcg", 1, "mL"], [20, "mcg", 2, "mL"]]);
  // Em PCR: 1 mg = 10 mL a 0,1 mg/mL, ou 1 mL da ampola pura.
  assert.deepEqual(conta(raqui, "adrenalina-pcr-raqui", ADULTO).contas, [[1, "mg", 10, "mL"]]);
  assert.deepEqual(conta(raqui, "adrenalina-pcr-raqui", ADULTO, 1).contas, [[1, "mg", 1, "mL"]]);
  for (const id of ["adrenalina-raqui", "adrenalina-pcr-raqui"]) assert.ok(doseDe(raqui, id).altoRisco, id);
  assert.match(doseDe(raqui, "adrenalina-raqui").indicacao, /^Com pulso/);
  assert.match(doseDe(raqui, "adrenalina-pcr-raqui").indicacao, /^PCR/);
  assert.match(raqui.alertas![0], /^Com pulso:.*Sem pulso:.*Não confundir/);
  assert.ok(raqui.agirAgora.find((x) => x.texto.startsWith("Se houver perda de pulso"))!.abre);
});

test("hemorragia pós-parto: ácido tranexâmico de dose fixa, ocitocina sem bolus rápido e uterotônicos com contraindicação", () => {
  const hpp = r("hemorragia-pos-parto");
  // 1 g a 50 mg/mL = 20 mL; alto risco (conferir a apresentação antes do volume); 10 minutos; repetição e total.
  assert.deepEqual(conta(hpp, "tranexamico-hpp", GESTANTE).contas, [[1, "g", 20, "mL"]]);
  assert.deepEqual(conta(hpp, "tranexamico-hpp", { idadeAnos: 30, pesoKg: null, gestante: true } as PacienteDaConsulta).contas, [[1, "g", 20, "mL"]], "dose fixa: não precisa do peso");
  const txa = doseDe(hpp, "tranexamico-hpp");
  assert.equal(txa.altoRisco, true);
  assert.equal(txa.velocidade, "Em 10 minutos.");
  assert.match(txa.repeticao!, /persistir depois de 30 minutos ou recomeçar em até 24 horas.*até 2 g/);
  assert.match(txa.indicacao, /até 3 horas do nascimento/);
  // Ocitocina em UI, sem apresentação presumida.
  assert.deepEqual(conta(hpp, "ocitocina-hpp-tratamento", GESTANTE).contas, [[10, "UI", undefined, undefined]]);
  assert.match(doseDe(hpp, "ocitocina-hpp-tratamento").velocidade!, /1 a 2 minutos.*5 a 10 minutos/);
  assert.ok(doseDe(hpp, "ocitocina-hpp-tratamento").cuidados!.some((x) => /Evitar injeção IV rápida/.test(x)));
  assert.deepEqual(conta(hpp, "ocitocina-hpp-manutencao", GESTANTE).contas, [[10, "UI", undefined, undefined], [20, "UI", undefined, undefined]]);
  // Metilergometrina só IM; misoprostol sublingual; carboprosta IM com alerta de asma.
  const metil = doseDe(hpp, "metilergometrina-hpp");
  assert.deepEqual(metil.apresentacoes.map((a) => a.vias), [["IM"]]);
  assert.deepEqual(conta(hpp, "metilergometrina-hpp", GESTANTE).contas, [[0.2, "mg", 1, "mL"]]);
  assert.match(metil.cuidados!.join(" "), /hipertensão, na pré-eclâmpsia e em determinadas cardiopatias.*via IV não está habilitada/);
  assert.match(metil.repeticao!, /protocolo obstétrico validado/);
  const miso = doseDe(hpp, "misoprostol-hpp");
  assert.equal(miso.via, "Sublingual");
  assert.deepEqual(miso.dose, { usual: 800, unidade: "mcg", por: "fixa" });
  assert.ok(miso.cuidados!.includes("Vias retal e sublingual não são farmacologicamente idênticas."));
  const carbo = doseDe(hpp, "carboprosta-hpp");
  assert.deepEqual([carbo.via, carbo.dose], ["IM", { usual: 250, unidade: "mcg", por: "fixa" }]);
  assert.match(carbo.cuidados![0], /broncoespasmo.*asma/);
  assert.equal(carbo.apresentacoes.length, 0);
  assert.equal(hpp.ferramenta, "tranexamico-hpp");
});

test("relógio do ácido tranexâmico: janela de 3 horas desde o nascimento e as condições da segunda dose", () => {
  const nasc = as("10:00");
  const dentro = tranexamico(nasc, null, as("11:30"));
  assert.equal(dentro.janela!.dentro, true);
  assert.equal(dentro.janela!.minutosRestantes, 90);
  assert.match(dentro.janela!.mensagem, /até 13:00 \(faltam 90 min\)/);
  assert.equal(dentro.segunda, null);
  const fora = tranexamico(nasc, null, as("13:30"));
  assert.equal(fora.janela!.dentro, false);
  assert.match(fora.janela!.mensagem, /fora da janela/);
  // Primeira dose às 10:20: segunda só a partir de 10:50, até 24 horas depois.
  assert.equal(tranexamico(nasc, as("10:20"), as("10:40")).segunda!.liberada, false);
  assert.match(tranexamico(nasc, as("10:20"), as("10:40")).segunda!.mensagem, /a partir de 10:50/);
  assert.equal(tranexamico(nasc, as("10:20"), as("11:00")).segunda!.liberada, true);
  assert.equal(tranexamico(nasc, as("10:20"), as("10:30", 16)).segunda!.liberada, false, "passou de 24 horas");
  assert.deepEqual(tranexamico(null, null, as("11:00")).falta, ["Informe a hora do nascimento."]);
  // O horário do relógio vira o instante mais recente: 23:50 lido às 00:10 é de ontem.
  assert.equal(horaParaMs("23:50", as("00:10", 16)), as("23:50", 15));
  assert.equal(horaParaMs("10:00", as("11:00")), as("10:00"));
  assert.equal(horaParaMs("25:00", as("11:00")), null);
  assert.equal(horaParaMs("", as("11:00")), null);
});

test("colapso materno: PCR com doses do adulto, magnésio em ramo separado e diluições conferidas", () => {
  const col = r("colapso-materno");
  assert.deepEqual(conta(col, "adrenalina-pcr-materna", GESTANTE).contas, [[1, "mg", 10, "mL"]]);
  // Ataque 4–6 g: 50–75 mL a 80 mg/mL; 8–12 mL a 50%.
  assert.deepEqual(conta(col, "magnesio-ataque", GESTANTE).contas, [[4, "g", 50, "mL"], [6, "g", 75, "mL"]]);
  assert.deepEqual(conta(col, "magnesio-ataque", GESTANTE, 1).contas, [[4, "g", 8, "mL"], [6, "g", 12, "mL"]]);
  assert.match(doseDe(col, "magnesio-ataque").velocidade!, /20 minutos.*4 g = 50 mL a 150 mL\/h; 6 g = 75 mL a 225 mL\/h/);
  // Manutenção 1–2 g/h: 12,5–25 mL/h a 80 mg/mL; 50–100 mL/h a 20 mg/mL.
  assert.deepEqual(conta(col, "magnesio-manutencao", GESTANTE).contas, [[1, "g", 12.5, "mL/h"], [2, "g", 25, "mL/h"]]);
  assert.deepEqual(conta(col, "magnesio-manutencao", GESTANTE, 1).contas, [[1, "g", 50, "mL/h"], [2, "g", 100, "mL/h"]]);
  // Nova convulsão 2 g: 25 mL a 80 mg/mL; 4 mL a 50%. Gluconato de cálcio 1 g = 10 mL.
  assert.deepEqual(conta(col, "magnesio-recorrencia", GESTANTE).contas, [[2, "g", 25, "mL"]]);
  assert.deepEqual(conta(col, "magnesio-recorrencia", GESTANTE, 1).contas, [[2, "g", 4, "mL"]]);
  assert.deepEqual(conta(col, "gluconato-intoxicacao-magnesio", GESTANTE).contas, [[1, "g", 10, "mL"]]);
  for (const id of ["magnesio-ataque", "magnesio-manutencao", "magnesio-recorrencia", "adrenalina-pcr-materna"]) assert.ok(doseDe(col, id).altoRisco, id);
  assert.match(doseDe(col, "magnesio-manutencao").cuidados![0], /disfunção renal.*reflexos, frequência respiratória, diurese/);
  // Alertas, ferramenta e o ramo da eclâmpsia.
  assert.equal(col.ferramenta, "cronometro-pcr-materna");
  assert.match(col.alertas![0], /deslocamento uterino manual contínuo para a esquerda/);
  assert.match(col.alertas![1], /preparar desde o reconhecimento.*até 5 minutos.*não esperar 4 minutos/);
  const eclampsia = col.quadros!.find((q) => /Eclâmpsia com pulso/.test(q.titulo))!;
  assert.ok(eclampsia.itens!.some((x) => /PAS ≥160 mmHg e\/ou PAD ≥110 mmHg/.test(x)));
  assert.ok(eclampsia.itens!.some((x) => /gluconato de cálcio 10%, 1 g IV lentamente \(10 mL\)/.test(x)));
  assert.ok(col.divergencias.some((d) => /magnésio/.test(d.tema) && /cartão Eclâmpsia usa 4 g em 15 minutos e 1 g\/h/.test(d.escolha)));
});

test("cronômetro da PCR materna: meta de nascimento em até 5 minutos desde o reconhecimento", () => {
  const t0 = as("08:00");
  assert.equal(pcrMaterna(t0, t0).nivel, "atencao");
  assert.match(pcrMaterna(t0, t0).mensagem, /faltam 5:00\. O preparo começa já\./);
  assert.equal(pcrMaterna(t0, t0 + 250_000).nivel, "perigo");
  assert.match(pcrMaterna(t0, t0 + 250_000).mensagem, /faltam 0:50/);
  assert.match(pcrMaterna(t0, t0 + 301_000).mensagem, /^5 minutos sem retorno da circulação: nascimento imediato/);
  assert.equal(formatarTempo(65), "1:05");
  assert.equal(formatarTempo(3725), "1:02:05");
});

test("reanimação neonatal: idade gestacional e peso antes das doses; 1 a 4 kg, IV/IO e traqueal em separado", () => {
  const rn = r("reanimacao-neonatal");
  // Sem a idade gestacional, nada é calculado; com ela, o ramo certo.
  assert.equal(bloqueioDoRamo(rn, {}), "Selecione a idade gestacional para calcular.");
  assert.equal(bloqueioDoRamo(rn, { idadeGestacional: "qualquer" }), "Selecione a idade gestacional para calcular.");
  assert.equal(bloqueioDoRamo(rn, { idadeGestacional: "34-ou-mais" }), undefined);
  assert.equal(ramoDe(rn, { idadeGestacional: "menos-de-34" }), "menos-de-34");
  assert.equal(bloqueioDoRamo(acharProtocolo("reanimacao-neonatal")!, {}), undefined, "a versão publicada não pede a escolha");
  // Sem peso, bloqueado.
  assert.equal(conta(rn, "adrenalina-rn-iv", RN(null)).bloqueio, "Informe o peso para calcular.");
  assert.equal(conta(rn, "adrenalina-rn-traqueal", RN(null)).bloqueio, "Informe o peso para calcular.");
  assert.equal(calcularVolume(rn.volumes[0], RN(null)).bloqueio, "Informe o peso para calcular.");
  // IV/IO 0,02 mg/kg = 0,2 mL/kg; traqueal 0,1 mg/kg = 1 mL/kg (solução de 0,1 mg/mL); SF 10 mL/kg.
  for (const kg of [1, 2, 3, 4]) {
    assert.deepEqual(conta(rn, "adrenalina-rn-iv", RN(kg)).contas, [[20 * kg, "mcg", Math.round(2 * kg) / 10, "mL"]], `IV ${kg} kg`);
    assert.deepEqual(conta(rn, "adrenalina-rn-traqueal", RN(kg)).contas, [[100 * kg, "mcg", kg, "mL"]], `traqueal ${kg} kg`);
    assert.equal(calcularVolume(rn.volumes[0], RN(kg)).texto, `${10 * kg} mL`);
  }
  // As vias não se misturam.
  const iv = doseDe(rn, "adrenalina-rn-iv"), et = doseDe(rn, "adrenalina-rn-traqueal");
  assert.doesNotMatch(iv.via, /traq/i);
  assert.equal(et.via, "Traqueal");
  assert.ok(et.cuidados!.includes("Não aplicar a dose traqueal pela via IV/IO."));
  assert.ok(et.cuidados!.includes("Não atrasar o acesso intravascular."));
  assert.equal(ADRENALINA_PREPARO(iv), "1 ampola (1 mg) completada para 10 mL de SF 0,9%");
  for (const d of rn.medicamentos) assert.ok(d.altoRisco, d.id);
  // Os dois algoritmos diferem onde o texto manda: oxigênio inicial e proteção térmica.
  const passo4 = (ramo: string) => passosDe(rn, null, ramo)[3].detalhe!;
  assert.match(passo4("34-ou-mais"), /ar ambiente/);
  assert.match(passo4("menos-de-34"), /FiO2 de referência de 60%.*peça T/);
  assert.match(passosDe(rn, null, "menos-de-34")[1].detalhe!, /prematuros muito imaturos/);
  assert.doesNotMatch(passosDe(rn, null, "34-ou-mais")[1].detalhe!, /prematuros/);
  // Quadros: ventilação por ramo e a tabela de SpO2.
  assert.deepEqual(rn.quadros!.filter((q) => q.ramo).map((q) => q.ramo), ["34-ou-mais", "menos-de-34"]);
  const spo2 = rn.quadros!.find((q) => q.tabela)!;
  assert.deepEqual(spo2.tabela!.linhas, [["2 minutos", "65–70%"], ["3 minutos", "70–75%"], ["4 minutos", "75–80%"], ["5 minutos", "80–85%"], ["10 minutos", "85–95%"]]);
  assert.ok(rn.quadros!.some((q) => q.itens?.some((x) => /PEEP inicial de 5 cmH2O/.test(x))));
  assert.equal(rn.ferramenta, "cronometro-nascimento");
});

// A preparação da solução de 0,1 mg/mL vem da apresentação cadastrada.
const ADRENALINA_PREPARO = (d: ReturnType<typeof doseDe>) => d.apresentacoes[0].preparo;

test("meta de SpO2 pelo cronômetro do nascimento", () => {
  assert.equal(alvoSpO2(90), null);
  assert.equal(alvoSpO2(120)!.faixa, "65–70%");
  assert.equal(alvoSpO2(299)!.faixa, "75–80%");
  assert.equal(alvoSpO2(300)!.faixa, "80–85%");
  assert.equal(alvoSpO2(599)!.faixa, "80–85%");
  assert.equal(alvoSpO2(600)!.faixa, "85–95%");
  assert.equal(alvoSpO2(3600)!.faixa, "85–95%");
  assert.equal(ALVOS_SPO2.length, 5);
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
  assert.deepEqual(mudou, [
    "efedrina-raqui.dose", "misoprostol-hpp.via", "magnesio-ataque.dose", "magnesio-ataque.apresentacoes",
    "magnesio-manutencao.apresentacoes", "magnesio-recorrencia.apresentacoes",
  ]);
  const novas = OBSTETRICIA_NEONATAL_V3.flatMap((p) => p.medicamentos.filter((d) => !acharProtocolo(p.id)!.medicamentos.some((m) => m.id === d.id)).map((d) => d.id));
  assert.deepEqual(novas, ["adrenalina-pcr-raqui", "ocitocina-hpp-tratamento", "ocitocina-hpp-manutencao", "carboprosta-hpp", "adrenalina-pcr-materna"]);
  const saem = OBSTETRICIA_NEONATAL_V3.flatMap((p) => acharProtocolo(p.id)!.medicamentos.filter((m) => !p.medicamentos.some((d) => d.id === m.id)).map((m) => m.id));
  assert.deepEqual(saem, []);
});

test("navegação: todo destino existe; a tela guarda a escolha e os cronômetros nos dados do paciente", () => {
  for (const p of OBSTETRICIA_NEONATAL_V3) {
    for (const alvo of [...(p.relacionados ?? []), ...p.agirAgora.flatMap((x) => (x.abre ? [x.abre] : []))].map((x) => x.protocolo)) {
      assert.ok(acharProtocolo(alvo), `${p.id} → ${alvo}`);
    }
  }
  assert.equal(r("colapso-materno").relacionados![0].protocolo, "pcr-aesp-assistolia");
  const tela = readFileSync(new URL("../../components/intercorrencias/protocolo.tsx", import.meta.url), "utf8");
  assert.match(tela, /onClick=\{\(\) => set\(p\.ramos!\.campo, ramo === o\.id \? "" : o\.id\)\}/);
  assert.match(tela, /passosDe\(p, populacao, ramo\)/);
  assert.match(tela, /semFaixa=\{populacao === null\} semRamo=\{semRamo\}/);
  assert.match(tela, /semRamo \|\| c\.bloqueio/);
  const relogios = readFileSync(new URL("../../components/intercorrencias/relogios.tsx", import.meta.url), "utf8");
  for (const chave of ["cronometro:pcr-materna", "cronometro:nascimento", "txa:nascimento", "txa:primeira"]) assert.ok(relogios.includes(`"${chave}"`), chave);
  assert.match(relogios, /window\.confirm\("Zerar o cronômetro\?"\)/);
});

test("impressão: etapas, quadros e alertas saem no papel; seletor e cronômetros, que são de toque, não", () => {
  const tela = readFileSync(new URL("../../components/intercorrencias/protocolo.tsx", import.meta.url), "utf8");
  const agir = tela.slice(tela.indexOf('<section id="agir"'), tela.indexOf("{temDoses && <section"));
  assert.match(agir, /estilos\.ramos\} \$\{estilos\.naoImprimir\}/);
  const quadros = agir.slice(agir.indexOf("{quadros.map"), agir.indexOf("{p.material"));
  assert.doesNotMatch(quadros, /naoImprimir/);
  const relogios = readFileSync(new URL("../../components/intercorrencias/relogios.tsx", import.meta.url), "utf8");
  assert.match(relogios, /estilos\.ferramenta\} \$\{estilos\.naoImprimir\}/);
  assert.equal(passosDe(r("reanimacao-neonatal"), "neonatal").length, 24, "sem a escolha, o papel leva os dois algoritmos");
});

test("referências: as novas cadastradas e marcadas como não conferidas; toda referência usada existe", () => {
  for (const id of ["oms-figo-icm-2025-hpp", "febrasgo-eclampsia", "aha-aap-2025-neonatal", "aap-2026-hipotermia-neonatal"]) {
    const ref = acharReferencia(id)!;
    assert.ok(ref, id);
    assert.equal(ref.conferida, false, id);
  }
  assert.equal(acharReferencia("oms-figo-icm-2025-hpp")!.link, "https://www.who.int/publications/i/item/9789240115637");
  for (const p of OBSTETRICIA_NEONATAL_V3) {
    for (const id of [...p.referencias, ...p.medicamentos.flatMap((d) => d.referencias), ...p.divergencias.flatMap((d) => d.posicoes.map((x) => x.referencia))]) {
      assert.ok(acharReferencia(id), `${p.id}: ${id}`);
    }
  }
});

test("vias: nenhuma dose com apresentação de outra via; a ergometrina não vai para IV", () => {
  for (const p of OBSTETRICIA_NEONATAL_V3) {
    const pac = p.id === "reanimacao-neonatal" ? RN(3) : GESTANTE;
    for (const d of p.medicamentos) {
      d.apresentacoes.forEach((_, i) => {
        const perigo = calcularDose(d, p, pac, i).alertas.filter((a) => /Confira antes de aspirar/.test(a.texto));
        assert.deepEqual(perigo, [], `${p.id}/${d.id}: apresentação de outra via`);
      });
    }
  }
  assert.ok(!doseDe(r("hemorragia-pos-parto"), "metilergometrina-hpp").apresentacoes.some((a) => a.vias?.includes("IV")));
});

test("eclâmpsia v4 (05/11/2026): o magnésio pelo Ministério da Saúde e pela RBEHG/FEBRASGO, aprovado e com quem usa", () => {
  const ecl = rascunhoDe("eclampsia")!;
  assert.equal(ecl.versao, 4);
  assert.equal(aprovacaoDe(ecl), APROVACOES[3], "a versão 4 tem a aprovação própria de 05/11/2026");
  assert.equal(PROTOCOLOS_LIBERADOS.find((p) => p.id === "eclampsia"), ecl, "quem usa recebe a versão 4");
  const gestante = { idadeAnos: 28, pesoKg: 70, gestante: true };
  const contas = (id: string, i = 0) => {
    const d = ecl.medicamentos.find((m) => m.id === id)!;
    return calcularDose({ ...d, apresentacoes: [d.apresentacoes[i]] }, ecl, gestante).contas
      .map((c) => [c.doseTotal, c.unidadeDose, c.volume, c.unidadeVolume]);
  };
  // Ataque: 4 g = 20 mL do preparo do MS (8 mL a 50% + 12 mL de água destilada), ou 8 mL da ampola de 50%.
  assert.deepEqual(contas("magnesio-eclampsia-ataque", 0), [[4, "g", 20, "mL"]]);
  assert.deepEqual(contas("magnesio-eclampsia-ataque", 1), [[4, "g", 8, "mL"]]);
  // Manutenção no preparo do MS (5 g em 250 mL): 1 g/h = 50 mL/h; 2 g/h = 100 mL/h.
  assert.deepEqual(contas("magnesio-eclampsia-manutencao"), [[1, "g", 50, "mL/h"]]);
  assert.deepEqual(contas("magnesio-eclampsia-manutencao-2g"), [[2, "g", 100, "mL/h"]]);
  // Nova convulsão: 2 g = 4 mL a 50%. Gluconato de cálcio 10%: 1 g = 10 mL, em 3 minutos.
  assert.deepEqual(contas("magnesio-eclampsia-recorrencia"), [[2, "g", 4, "mL"]]);
  assert.deepEqual(contas("gluconato-eclampsia"), [[1, "g", 10, "mL"]]);
  assert.match(ecl.medicamentos.find((m) => m.id === "gluconato-eclampsia")!.velocidade ?? "", /3 minutos/);
  for (const d of ecl.medicamentos.filter((x) => x.farmaco === "Sulfato de magnésio")) assert.ok(d.altoRisco, d.id);
  // Saem o preparo de 124 mL, o de 8 g em 100 mL e o labetalol; entram os limites, o Pritchard e a miastenia.
  const texto = JSON.stringify(ecl);
  assert.doesNotMatch(texto, /124 mL|8 g em 100 mL|80 mg\/mL|labetalol IV,|ou labetalol/i);
  assert.match(texto, /labetalol IV não está disponível no Brasil/);
  assert.match(texto, /frequência respiratória ≥16 irpm e diurese ≥25 mL\/h/);
  assert.match(texto, /Creatinina ≥1,0 mg\/dL: manutenção pela metade/);
  assert.match(texto, /Pritchard/);
  assert.match(texto, /miastenia grave/);
  assert.match(ecl.depois[0], /^Na passagem à obstetrícia/);
  // As duas fontes brasileiras, lidas no texto.
  for (const id of ["ms-2022-alto-risco", "rbehg-2023-pe"]) assert.ok(acharReferencia(id)?.conferida, id);
  assert.ok(ecl.medicamentos.filter((d) => d.farmaco === "Sulfato de magnésio").every((d) => d.referencias.includes("rbehg-2023-pe")));
});

test("colapso materno v4 (05/11/2026): o ramo da eclâmpsia com o mesmo magnésio da Eclâmpsia 4, à espera de aprovação", () => {
  const v4 = rascunhoDe("colapso-materno")!, v3 = r("colapso-materno"), ecl = rascunhoDe("eclampsia")!;
  assert.equal(v4.versao, 4);
  assert.equal(aprovado(v4), false, "a versão 4 só vai para quem usa depois da aprovação");
  assert.equal(PROTOCOLOS_LIBERADOS.find((p) => p.id === "colapso-materno"), v3, "quem usa continua com a 3");
  // As doses de magnésio e do gluconato são as da Eclâmpsia 4, com os ids deste cartão.
  const par: Record<string, string> = {
    "magnesio-ataque": "magnesio-eclampsia-ataque", "magnesio-manutencao": "magnesio-eclampsia-manutencao",
    "magnesio-recorrencia": "magnesio-eclampsia-recorrencia", "magnesio-manutencao-2g": "magnesio-eclampsia-manutencao-2g",
    "gluconato-intoxicacao-magnesio": "gluconato-eclampsia",
  };
  for (const [aqui, la] of Object.entries(par)) {
    const a = doseDe(v4, aqui), b = doseDe(ecl, la);
    assert.deepEqual([a.dose, a.apresentacoes, a.velocidade, a.cuidados, a.via], [b.dose, b.apresentacoes, b.velocidade, b.cuidados, b.via], aqui);
    assert.equal(conta(v4, aqui, GESTANTE).contas.length > 0, true, aqui);
  }
  assert.deepEqual(conta(v4, "magnesio-ataque", GESTANTE).contas, [[4, "g", 20, "mL"]]);
  assert.deepEqual(conta(v4, "magnesio-manutencao", GESTANTE).contas, [[1, "g", 50, "mL/h"]]);
  assert.deepEqual(conta(v4, "magnesio-recorrencia", GESTANTE).contas, [[2, "g", 4, "mL"]]);
  assert.doesNotMatch(JSON.stringify(v4.medicamentos), /80 mg\/mL|4 a 6 g/);
  // O ramo da eclâmpsia diz o mesmo esquema; o resto do cartão é a versão 3.
  const ramo = v4.quadros!.find((q) => /Eclâmpsia com pulso/.test(q.titulo))!;
  assert.match(ramo.itens!.join(" "), /4 g IV lento, em 15 a 20 minutos.*1 g\/h \(5 g em 250 mL = 50 mL\/h\)/);
  assert.match(ramo.itens!.join(" "), /frequência respiratória ≥16 irpm e diurese ≥25 mL\/h/);
  assert.deepEqual(v4.agirAgora, v3.agirAgora);
  assert.deepEqual(v4.alertas, v3.alertas);
  assert.deepEqual(v4.depois, v3.depois);
  assert.deepEqual(doseDe(v4, "adrenalina-pcr-materna"), doseDe(v3, "adrenalina-pcr-materna"));
  assert.ok(v4.divergencias.some((d) => /magnésio/.test(d.tema) && /um esquema só no app/.test(d.escolha)));
  assert.ok(v4.referencias.includes("rbehg-2023-pe"));
});
