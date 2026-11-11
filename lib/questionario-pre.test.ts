import test from "node:test";
import assert from "node:assert/strict";
import {
  alertasDoQuestionario, BLOCOS, faltandoNoBloco, partesQueFaltam, lerMedida, limparRespostas, mensagemDoQuestionario, nomeCurtoDaOrganizacao,
  respostasParaAvaliacao, resumoDasRespostas, whatsappDoPaciente, type Respostas,
} from "./questionario-pre.ts";

// Respostas fictícias de uma paciente que respondeu tudo.
const completa: Respostas = {
  quem: "familiar", "quem.texto": "Maria Fictícia, filha",
  peso: "72,5", altura: "1,63", cirurgia: "Vesícula", cirurgiao: "Dr. Fictício",
  cirurgias: "sim", "cirurgias.texto": "Cesárea em 1998", "anestesias.marcas": ["raqui"],
  problema: "sim", "problema.marcas": ["enjoo", "febre"], "problema.texto": "vomitei o dia todo",
  familia: "nao", viagem: "sim",
  coracao: "sim", "coracao.marcas": ["pressao", "arritmia"], "coracao.texto": "toma losartana",
  esforco: "sim",
  pulmao: "sim", "pulmao.marcas": ["asma"], crise: "há 2 meses",
  diabetes: "sim", "diabetes.marcas": ["comprimido", "hipo"],
  neuro: "nao", outras: "sim", "outras.marcas": ["tireoide", "dialise"],
  aguda: "nao", glaucoma: "naosei", gravidez: "nao",
  escada: "cansa", ronco: "sim", sono: "nao", parada: "sim",
  habitos: "sim", "habitos.marcas": ["fumo"], "habitos.texto": "10 cigarros por dia",
  dentes: "sim", "dentes.marcas": ["dentadura"],
  alergia: "sim", "alergia.marcas": ["remedio"], "alergia.texto": "Dipirona, inchou o rosto",
  remedios: "sim", "remedios.texto": "Losartana 50 mg, Metformina 850",
  sangue: "sim", "sangue.marcas": ["rivaroxabana"],
  caneta: "sim", "caneta.texto": "Ozempic", caneta_dia: "2026-11-02",
  mais: "Tenho medo de agulha",
};
const ctx = { sexo: "Feminino" };

test("questionário: cada resposta vai para o campo da avaliação, na língua da ficha", () => {
  const { campos } = respostasParaAvaliacao(completa, {});
  assert.equal(campos.peso, "72.5");
  assert.equal(campos.altura, "163", "1,63 m vira 163 cm");
  assert.equal(campos.cirurgia, "Vesícula");
  assert.equal(campos.cirurgias_anteriores, "Sim");
  assert.equal(campos.cirurgias_anteriores_cirurgia, "Cesárea em 1998");
  assert.equal(campos.cirurgias_anteriores_anestesia, "raqui/peridural");
  assert.equal(campos.reacao_anestesica, "Sim");
  // O botão da ficha quando existe ("Náuseas/vômitos intensos"); o texto do paciente quando não.
  assert.equal(campos.reacao_anestesica_detalhes, "Náuseas/vômitos intensos, febre muito alta, vomitei o dia todo");
  assert.equal(campos.cardiovascular_detalhes, "Hipertensão, Arritmia, dor no peito ou falta de ar ao esforço, toma losartana");
  assert.equal(campos.respiratoria_detalhes, "Asma");
  assert.equal(campos.respiratoria_ultima_crise, "há 2 meses");
  assert.equal(campos.diabetes_detalhes, "comprimido, Hipoglicemia recente");
  assert.equal(campos.neurologica, "Não");
  assert.equal(campos.outras_doencas_detalhes, "tireoide (não sei qual), Em diálise");
  assert.equal(campos.glaucoma, "Não sabe", "\"Não sei\" do paciente é o \"Não sabe\" da ficha");
  assert.equal(campos.gestacao, "Não");
  assert.equal(campos.capacidade_funcional, "< 4 METs");
  assert.equal(campos.habitos_detalhes, "Tabagismo, 10 cigarros por dia");
  assert.equal(campos.dentaria_detalhes, "Prótese removível");
  assert.equal(campos.alergias_detalhes, "Medicamentos, Dipirona, inchou o rosto");
  assert.equal(campos.stop_ronco, true);
  assert.equal(campos.stop_apneia, true);
  assert.equal(campos.stop_cansaco, undefined, "o \"não\" não desmarca nada");
  assert.equal(campos.stop_has, true);
  assert.equal(campos.apfel_historia, true);
});

test("questionário: o remédio vem só como resposta; nome, dose e foto ficam para o médico", () => {
  const { campos } = respostasParaAvaliacao(completa, {});
  assert.equal(campos.medicacao_continua, "Sim");
  assert.equal(campos.anticoagulante, "Sim");
  assert.equal(campos.glp1, "Sim");
  assert.equal(campos.glp1_ultima_dose, "2026-11-02");
  // Esses três campos viram cartão de remédio sozinhos na avaliação.
  for (const c of ["medicacao_continua_detalhes", "anticoagulante_detalhes", "glp1_detalhes", "medicamentos_json"])
    assert.equal(campos[c], undefined, c);
});

test("questionário: só preenche o vazio, e respeita o critério que o médico desmarcou", () => {
  const atuais = { peso: "80", cardiovascular: "Não", stop_ronco: false, escores_recusados: "apfel_historia", cirurgia: "" };
  const { campos, trazidos } = respostasParaAvaliacao(completa, atuais);
  assert.equal(campos.peso, undefined);
  assert.equal(campos.cardiovascular, undefined);
  assert.equal(campos.cardiovascular_detalhes, undefined, "com o Não do médico, o detalhe não entra escondido");
  const comSim = respostasParaAvaliacao(completa, { cardiovascular: "Sim" }).campos;
  assert.equal(comSim.cardiovascular_detalhes, "Hipertensão, Arritmia, dor no peito ou falta de ar ao esforço, toma losartana",
    "com o Sim do médico e o detalhe vazio, o detalhe do paciente entra");
  assert.equal(campos.stop_ronco, undefined, "desmarcado pelo médico");
  assert.equal(campos.apfel_historia, undefined, "recusado pelo médico");
  assert.equal(campos.cirurgia, "Vesícula", "texto em branco conta como vazio");
  assert.ok(trazidos.includes("altura") && !trazidos.includes("peso"));
});

test("questionário: a família entra na pergunta da reação anestésica", () => {
  const { campos } = respostasParaAvaliacao({ problema: "nao", familia: "sim", "familia.texto": "tio teve febre alta" }, {});
  assert.equal(campos.reacao_anestesica, "Sim");
  assert.equal(campos.reacao_anestesica_detalhes, "família: tio teve febre alta");
  assert.equal(respostasParaAvaliacao({ problema: "nao", familia: "nao" }, {}).campos.reacao_anestesica, "Não");
  assert.equal(respostasParaAvaliacao({ problema: "nao", familia: "naosei" }, {}).campos.reacao_anestesica, "Não sabe");
});

test("questionário: medida digitada do jeito do paciente", () => {
  assert.equal(lerMedida("1,65", "cm"), "165");
  assert.equal(lerMedida("165 cm", "cm"), "165");
  assert.equal(lerMedida("72 kg", "kg"), "72");
  assert.equal(lerMedida("0", "kg"), "");
  assert.equal(lerMedida("900", "kg"), "", "fora da faixa: o médico pergunta");
  assert.equal(lerMedida("", "cm"), "");
});

test("questionário: os alertas que o médico vê primeiro", () => {
  const textos = alertasDoQuestionario(completa).map((a) => a.texto);
  assert.ok(textos.includes("Febre muito alta em anestesia anterior: investigar hipertermia maligna."));
  assert.ok(textos.includes("Alergia: Remédio, Dipirona, inchou o rosto"));
  assert.ok(textos.includes("Anticoagulante ou antiagregante: Rivaroxabana (Xarelto). Confirmar a última dose."));
  assert.ok(textos.includes("Remédio para emagrecer (GLP-1): Ozempic. Última dose em 02/11/2026."));
  assert.ok(textos.includes("Dor no peito ou falta de ar ao esforço."));
  assert.ok(textos.includes("Faz diálise: perguntar o dia da última sessão."));
  assert.deepEqual(alertasDoQuestionario({ alergia: "nao", sangue: "nao" }), []);
});

test("questionário: o que falta responder em cada bloco", () => {
  const [voce, anest, , outras, , remedios] = BLOCOS;
  assert.deepEqual(faltandoNoBloco(voce, {}, ctx), ["quem"], "peso, altura e cirurgia podem ficar em branco");
  assert.deepEqual(faltandoNoBloco(voce, { quem: "familiar" }, ctx), ["quem"], "familiar diz quem é");
  assert.deepEqual(faltandoNoBloco(anest, { cirurgias: "nao", problema: "nao", familia: "nao", viagem: "nao" }, ctx), []);
  assert.deepEqual(faltandoNoBloco(remedios, { alergia: "sim", remedios: "nao", sangue: "nao", caneta: "nao" }, ctx), ["alergia"],
    "alergia com Sim pede o nome");
  assert.ok(faltandoNoBloco(outras, {}, ctx).includes("gravidez"));
  assert.ok(!faltandoNoBloco(outras, {}, { sexo: "Masculino" }).includes("gravidez"), "homem não vê a pergunta");
});

test("questionário incompleto: as partes que faltaram", () => {
  assert.deepEqual(partesQueFaltam(2), ["Coração, pulmão e diabetes", "Outras doenças", "Seu dia a dia", "Alergias e remédios"],
    "\"Para terminar\" só tem campo opcional e não conta");
  assert.deepEqual(partesQueFaltam(6), []);
  assert.equal(partesQueFaltam(null).length, 6);
  // Perguntas curtas, no estilo da ficha (11/11/2026).
  assert.ok(BLOCOS.flatMap((b) => b.perguntas).every((p) => p.texto.length <= 50), "nenhuma pergunta longa");
});

test("questionário: o que não faz sentido sai antes de gravar", () => {
  const limpo = limparRespostas({
    cirurgias: "nao", "cirurgias.texto": "sobrou de antes", "anestesias.marcas": ["geral"],
    coracao: "talvez", glaucoma: "sim", "glaucoma.marcas": ["inventada"], gravidez: "sim",
    "problema.marcas": ["enjoo"], intrusa: "x",
  }, { sexo: "Masculino" });
  assert.deepEqual(limpo, { cirurgias: "nao", glaucoma: "sim" });
});

test("questionário: o resumo mostra as respostas como o paciente deu", () => {
  const resumo = resumoDasRespostas(completa, ctx);
  const voce = resumo.find((b) => b.titulo === "Sobre você")!;
  assert.deepEqual(voce.itens[0], { pergunta: "Quem está respondendo?", resposta: "Familiar ou responsável — Maria Fictícia, filha" });
  assert.deepEqual(voce.itens[1], { pergunta: "Peso", resposta: "72,5 kg" });
  assert.deepEqual(voce.itens[2], { pergunta: "Altura", resposta: "163 cm (escreveu 1,63)" });
  assert.equal(resumoDasRespostas({ peso: "900" }, ctx)[0].itens[0].resposta, "900 (fora da faixa: confirmar)");
  const remedios = resumo.find((b) => b.titulo === "Alergias e remédios")!;
  assert.ok(remedios.itens.some((i) => i.resposta === "Sim — Losartana 50 mg, Metformina 850"));
  assert.ok(remedios.itens.some((i) => i.resposta === "02/11/2026"));
});

test("questionário: a mensagem do WhatsApp e o número do paciente", () => {
  const texto = mensagemDoQuestionario({
    paciente: "MARIA DAS DORES FICTÍCIA", organizacao: "Grupo Fictício — Serviço de Anestesia", link: "https://x.test/q/abc", validade: "2026-11-17T15:00:00Z",
  });
  assert.equal(texto, [
    "Olá, Maria! 👋",
    "",
    "Somos da *Grupo Fictício — Serviço de Anestesia*.",
    "",
    "Antes da sua consulta pré-anestésica, pedimos que responda a um breve questionário sobre sua saúde. Isso ajudará a tornar sua avaliação mais ágil e segura.",
    "",
    "⏱️ *Tempo estimado: menos de 10 minutos.*",
    "",
    "📱 Você pode interromper e continuar depois no mesmo celular.",
    "",
    "*Acesse seu questionário:*",
    "https://x.test/q/abc",
    "",
    "🔒 Link pessoal e exclusivo, válido até 17/11/2026.",
    "",
    "*Grupo Fictício | Sua segurança é nossa prioridade.*",
  ].join("\n"));
  assert.doesNotMatch(texto, /\*\*/, "negrito do WhatsApp é com um asterisco só");
  const semGrupo = mensagemDoQuestionario({ paciente: "", organizacao: null, link: "L", validade: "2026-11-17T15:00:00Z" });
  assert.match(semGrupo, /^Olá! 👋\n\nSomos da equipe de anestesia\./);
  assert.match(semGrupo, /\*Sua segurança é nossa prioridade\.\*$/);
  assert.equal(nomeCurtoDaOrganizacao("INOVANEST — Serviço de Anestesiologia de Campo Mourão"), "INOVANEST");
  assert.equal(nomeCurtoDaOrganizacao("FUNDHOSPAR — Centro Cirúrgico"), "FUNDHOSPAR");
  assert.match(whatsappDoPaciente("(45) 99999-0000", "oi"), /^https:\/\/wa\.me\/5545999990000\?text=oi$/);
  assert.match(whatsappDoPaciente("5545999990000", "oi"), /^https:\/\/wa\.me\/5545999990000\?/);
  assert.match(whatsappDoPaciente(null, "oi"), /^https:\/\/wa\.me\/\?text=oi$/, "sem número, o WhatsApp pede o contato");
});
