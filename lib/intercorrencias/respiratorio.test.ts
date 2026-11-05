import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { acharProtocolo, itensDaCategoria, PROTOCOLOS_DA_PREVIA, PROTOCOLOS_LIBERADOS, rascunhoDe } from "./catalogo.ts";
import { APROVACOES, aprovado } from "./aprovacao.ts";
import { calcularDose, doseServe, passosDe, populacaoDe, type PacienteDaConsulta } from "./calculo.ts";
import { acharReferencia } from "./referencias.ts";
import { RESPIRATORIO_V3 } from "./protocolos/respiratorio.ts";
import type { Populacao, Protocolo } from "./tipos.ts";

// Revisão respiratória e via aérea (01/11/2026), protocolos 09 a 15: entram
// como rascunho, "corrigido — aguardando validação médica". Quem usa continua
// com a versão 2 aprovada em 15/10/2026.

const IDS = ["ventilacao-mascara-dificil", "intubacao-dificil", "nao-ventilo-nao-intubo", "laringoespasmo",
  "pressao-vias-aereas", "broncoespasmo-grave", "broncoaspiracao"];
const r = (id: string) => rascunhoDe(id)!;
const pac = (idadeAnos: number | null, pesoKg: number | null, gestante = false): PacienteDaConsulta =>
  ({ idadeAnos, pesoKg, ...(gestante ? { gestante } : {}) }) as PacienteDaConsulta;
const ADULTO = pac(40, 70);
const conta = (p: Protocolo, id: string, paciente: PacienteDaConsulta, apresentacao = 0) => {
  const c = calcularDose(p.medicamentos.find((m) => m.id === id)!, p, paciente, apresentacao);
  return { bloqueio: c.bloqueio, alertas: c.alertas, contas: c.contas.map((x) => [x.doseTotal, x.unidadeDose, x.volume, x.unidadeVolume]) };
};
const titulos = (p: Protocolo, populacao: Populacao | null) => passosDe(p, populacao).map((x) => x.texto);
const doseDe = (p: Protocolo, id: string) => p.medicamentos.find((m) => m.id === id)!;

test("respiratório: os sete na versão 3, aprovada em 05/11/2026, que é a que vai para quem usa", () => {
  assert.deepEqual(RESPIRATORIO_V3.map((p) => p.id), IDS);
  for (const id of IDS) {
    const publicado = acharProtocolo(id)!;
    assert.equal(publicado.versao, 2, id);
    assert.ok(aprovado(publicado), `${id}: a versão 2 deixou de ser aprovada`);
    const rascunho = r(id);
    assert.equal(rascunho.versao, 3, id);
    assert.equal(rascunho.atualizadoEm, "2026-11-01", id);
    assert.equal(rascunho.revisadoEm, "2026-11-01", id);
    assert.ok(aprovado(rascunho), `${id}: a versão 3 sem a aprovação de 05/11/2026`);
    assert.equal(PROTOCOLOS_DA_PREVIA.find((p) => p.id === id), rascunho, `${id}: a prévia abre o rascunho`);
    assert.equal(PROTOCOLOS_LIBERADOS.find((p) => p.id === id), rascunho, `${id}: quem usa recebe a versão aprovada`);
    assert.equal(rascunho.categoria, "respiratorio", id);
  }
  assert.equal(APROVACOES.length, 5, "a terceira (os 40 rascunhos), a quarta (Eclâmpsia 4) e a quinta (Colapso 4) são de 05/11/2026");
});

test("respiratório: Agir agora completo e numerado, na ordem do texto clínico", () => {
  assert.deepEqual(titulos(r("ventilacao-mascara-dificil"), "adulto"), [
    "Solicite ajuda e comunique a dificuldade.",
    "Administre oxigênio a 100%.",
    "Verifique rapidamente o sistema ventilatório.",
    "Otimize o posicionamento do paciente.",
    "Melhore a vedação da máscara.",
    "Utilize dispositivos auxiliares.",
    "Avalie a profundidade anestésica e o bloqueio neuromuscular.",
    "Se a ventilação permanecer ineficaz, utilize dispositivo supraglótico de resgate.",
    "Se a oxigenação for restabelecida, interrompa as tentativas e reavalie o plano.",
    "Se não for possível oxigenar, declare CICO.",
  ]);
  assert.deepEqual(titulos(r("intubacao-dificil"), "adulto"), [
    "Declare a dificuldade e peça ajuda.",
    "Restabeleça ou mantenha a oxigenação.",
    "Otimize as condições para a intubação.",
    "Utilize a melhor técnica disponível — Plano A.",
    "Limite as tentativas de intubação.",
    "Se houver falha da intubação, declare a falha e avance ao Plano B.",
    "Se a ventilação com supraglótico funcionar, pare, pense e comunique.",
    "Se o supraglótico falhar, avance ao Plano C.",
    "Se não for possível oxigenar, declare CICO.",
    "Após estabelecer a via aérea, confirme a ventilação e planeje o restante do atendimento.",
  ]);
  assert.deepEqual(titulos(r("nao-ventilo-nao-intubo"), "adulto"), [
    "Declare imediatamente CICO.",
    "Inicie o preparo para o acesso frontal de emergência.",
    "Continue oferecendo oxigênio pela via superior quando possível.",
    "Garanta bloqueio neuromuscular adequado.",
    "Posicione o pescoço e identifique a anatomia.",
    "Execute o acesso frontal de emergência — Plano D.",
    "Estabeleça a passagem traqueal e insira o tubo.",
    "Confirme a ventilação imediatamente.",
    "Fixe o tubo e estabilize o paciente.",
    "Se a primeira abordagem falhar, acione resgate cirúrgico imediato.",
  ]);
  assert.deepEqual(titulos(r("laringoespasmo"), "adulto"), [
    "Solicite ajuda e administre oxigênio a 100%.",
    "Interrompa imediatamente o estímulo desencadeante.",
    "Remova fatores obstrutivos visíveis.",
    "Execute manobras de abertura da via aérea.",
    "Se o espasmo persistir, considere aprofundamento anestésico.",
    "Em obstrução persistente ou deterioração, administre bloqueador neuromuscular apropriado.",
    "Restabeleça a ventilação e confirme a resposta.",
    "Considere intubação traqueal quando necessária.",
    "Avalie complicações após a resolução.",
  ]);
  assert.deepEqual(titulos(r("pressao-vias-aereas"), "adulto"), [
    "Solicite ajuda quando houver comprometimento e administre oxigênio a 100%.",
    "Passe à ventilação manual para avaliação rápida.",
    "Inspecione o sistema ventilatório.",
    "Verifique a posição e a permeabilidade do tubo traqueal.",
    "Avalie possível hiperinsuflação dinâmica.",
    "Avalie causas pulmonares e torácicas.",
    "Trate imediatamente causas críticas.",
    "Reavalie fatores cirúrgicos e anestésicos.",
    "Reavalie a ventilação após a intervenção.",
  ]);
  assert.deepEqual(titulos(r("broncoespasmo-grave"), "adulto"), [
    "Solicite ajuda.",
    "Administre oxigênio a 100%.",
    "Exclua obstrução mecânica.",
    "Considere aprofundamento anestésico.",
    "Administre salbutamol inalatório.",
    "Considere associação de ipratrópio.",
    "Ajuste a ventilação.",
    "Se houver resposta insuficiente, considere medicamentos adicionais.",
    "Avalie anafilaxia e instabilidade hemodinâmica.",
    "Reavalie continuamente e considere suporte intensivo.",
  ]);
  assert.deepEqual(titulos(r("broncoaspiracao"), "adulto"), [
    "Solicite ajuda e comunique a ocorrência.",
    "Evite aspiração adicional.",
    "Aspire imediatamente o material visível da orofaringe.",
    "Proteja a via aérea.",
    "Administre oxigênio e suporte ventilatório.",
    "Avalie aspiração traqueobrônquica e broncoscopia.",
    "Avalie a descompressão gástrica e a continuidade da cirurgia.",
    "Estabeleça monitorização e plano de acompanhamento.",
  ]);
  // Cada passo é uma ação completa, com ponto final; nenhum se repete.
  for (const p of RESPIRATORIO_V3) {
    const passos = p.agirAgora;
    assert.equal(new Set(passos.map((x) => `${x.caminho ?? ""}|${x.texto}`)).size, passos.length, p.id);
    for (const x of passos) {
      assert.match(x.texto, /^\S.*\.$/, `${p.id}: "${x.texto}"`);
      if (x.detalhe) assert.match(x.detalhe, /\.$/, `${p.id}: "${x.detalhe}"`);
    }
  }
});

test("respiratório: o texto essencial de cada passo está inteiro (integridade depois da atualização)", () => {
  const tudo = (id: string) => r(id).agirAgora.map((x) => `${x.texto} ${x.detalhe ?? ""}`).join(" ");
  const trechos: Record<string, string[]> = {
    "ventilacao-mascara-dificil": [
      "ressuscitador autoinflável conectado diretamente a fonte de oxigênio confiável",
      "Em pacientes obesos, considere posição de rampa e cabeça elevada.",
      "A quantidade de tentativas é um limite máximo, não uma obrigação",
      "Ative imediatamente o protocolo \"Não intubo, não oxigeno\"",
    ],
    "intubacao-dificil": [
      "o limite é de até três tentativas, com possibilidade de uma tentativa adicional por profissional mais experiente",
      "Cada nova tentativa deve incorporar uma mudança que aumente a probabilidade de sucesso.",
      "Limite as inserções a até três tentativas, somente enquanto houver segurança clínica.",
      "A opção padrão, quando possível, é interromper a anestesia e despertar o paciente.",
      "Não realizar intubação às cegas através do dispositivo.",
      "Abra o kit de acesso cervical de emergência.",
      "Não espere dessaturação extrema para reconhecer a falha.",
    ],
    "nao-ventilo-nao-intubo": [
      "técnica treinada de bisturi, bougie e tubo traqueal",
      "a incisão cutânea vertical mediana permite dissecção e identificação das estruturas",
      "O conjunto adulto DAS utiliza tubo traqueal de 6,0 mm.",
      "confirme a ventilação com capnografia de onda sustentada",
    ],
    laringoespasmo: [
      "aplicando CPAP ou pressão positiva cuidadosamente quando apropriado",
      "Não prolongue manobras ineficazes durante hipóxia grave.",
      "Se não for possível oxigenar, ative imediatamente o protocolo CICO.",
      "Investigue edema pulmonar por pressão negativa",
    ],
    "pressao-vias-aereas": [
      "pode ser necessária desconexão breve para permitir a expiração",
      "realize descompressão urgente por profissional habilitado, sem esperar radiografia",
      "pressão de platô quando disponível",
    ],
    "broncoespasmo-grave": [
      "aerossol dosimetrado por adaptador ou nebulização integrada ao circuito",
      "Hipercapnia permissiva pode ser considerada em situações apropriadas",
      "A adrenalina IV no broncoespasmo isolado não deve ser apresentada como primeira linha universal.",
    ],
    broncoaspiracao: [
      "Se já existir tubo corretamente posicionado com cuff, não o retire automaticamente.",
      "Não prolongue a aspiração quando isso atrasar a oxigenação necessária.",
      "Não realize lavagem pulmonar indiscriminadamente.",
    ],
  };
  for (const [id, lista] of Object.entries(trechos)) for (const t of lista) assert.ok(tudo(id).includes(t), `${id}: falta "${t}"`);
  // As seções do cartão continuam as mesmas, todas preenchidas.
  for (const p of RESPIRATORIO_V3) {
    for (const campo of ["reconhecer", "agirAgora", "pensarEm", "depois", "referencias"] as const) {
      assert.ok(p[campo].length > 0, `${p.id}: ${campo} vazio`);
    }
    assert.ok((p.notasDeDose ?? []).length > 0 || p.medicamentos.length > 0, `${p.id}: sem a seção de doses`);
  }
  assert.ok(r("broncoaspiracao").depois.includes(
    "Não utilizar ausência de sintomas por apenas duas horas ou radiografia inicial normal como critérios universais de alta."));
  assert.deepEqual(r("intubacao-dificil").depois.slice(0, 6).map((x) => x.replace(/^Registrar /, "")), [
    "o número e o tipo das tentativas.", "os dispositivos e as técnicas utilizados.", "a melhor visualização glótica obtida.",
    "as complicações.", "o método definitivo de obtenção da via aérea.", "o plano de extubação.",
  ]);
});

test("CICO: título novo, ramo do adulto com a técnica DAS e ramo pediátrico separado, sem a técnica do adulto", () => {
  const cico = r("nao-ventilo-nao-intubo");
  assert.equal(cico.titulo, "Não intubo, não oxigeno — CICO");
  assert.ok(cico.sinonimos.includes("não ventilo, não intubo"), "o nome antigo continua achando o cartão");
  const crianca = titulos(cico, "pediatrico");
  assert.deepEqual(crianca, ["Declare CICO e peça ajuda especializada.", "Continue oferecendo oxigênio pela via superior quando possível.",
    "Não aplique a técnica nem o tubo do adulto."]);
  assert.deepEqual(titulos(cico, "neonatal"), crianca);
  const textoCrianca = passosDe(cico, "pediatrico").map((x) => `${x.texto} ${x.detalhe}`).join(" ");
  assert.doesNotMatch(textoCrianca, /bisturi|6,0|bougie/i, "o ramo pediátrico não pode trazer a técnica do adulto");
  assert.equal(titulos(cico, "gestante").length, 10);
  // Sem idade, os dois ramos aparecem, cada um com o seu título (a numeração recomeça).
  assert.deepEqual([...new Set(passosDe(cico, null).map((x) => x.caminho))], ["A. Adulto — Plano D (DAS 2025)", "B. Criança — ramo separado"]);
  assert.deepEqual(cico.material, [
    "Bisturi com lâmina nº 10.", "Bougie apropriado.", "Tubo traqueal com cuff 6,0 mm no adulto, conforme técnica DAS.",
    "Seringa para o cuff.", "Sistema de ventilação e capnografia.", "Aspirador.", "Equipamento de resgate cirúrgico.",
  ]);
  assert.equal(cico.alertas!.length, 3);
  assert.match(cico.alertas![1], /fluxos e tempos fixos.*barotrauma/);
  assert.equal(cico.medicamentos.length, 0);
  // Na lista da prévia, o título novo cobre o previsto antigo: nada de "Não ventilo, não intubo — em preparação".
  const { prontos, previstos } = itensDaCategoria("respiratorio", PROTOCOLOS_DA_PREVIA);
  assert.ok(prontos.includes(cico));
  assert.deepEqual(previstos.filter((x) => /intubo/i.test(x.titulo)), []);
  assert.deepEqual(itensDaCategoria("respiratorio").previstos.filter((x) => /intubo/i.test(x.titulo)), []);
  // Intubação difícil: algoritmo do adulto, sem a faixa pediátrica.
  assert.deepEqual(r("intubacao-dificil").populacoes, ["adulto", "gestante"]);
  assert.ok(r("intubacao-dificil").reconhecer.some((x) => /crianças, utilizar protocolo específico/.test(x)));
});

test("calculadora: peso ausente bloqueia toda dose por kg, e idade ausente deixa a faixa sem escolha", () => {
  const sem = pac(40, null);
  for (const [id, dose] of [["laringoespasmo", "propofol-laringoespasmo"], ["laringoespasmo", "succinilcolina-iv-laringoespasmo"],
    ["laringoespasmo", "succinilcolina-im-laringoespasmo"], ["ventilacao-mascara-dificil", "sugamadex-mascara"],
    ["broncoespasmo-grave", "magnesio-broncoespasmo-ped"], ["broncoespasmo-grave", "hidrocortisona-ped"]] as const) {
    assert.equal(conta(r(id), dose, sem).bloqueio, "Informe o peso para calcular.", dose);
    assert.equal(conta(r(id), dose, pac(null, null)).bloqueio, "Informe o peso para calcular.", dose);
  }
  // Dose fixa não precisa do peso.
  assert.deepEqual(conta(r("broncoespasmo-grave"), "salbutamol-iv-adulto", sem).contas, [[250, "mcg", 5, "mL"]]);
  // Sem idade não há faixa: a tela pede a idade antes de mostrar a dose da faixa.
  assert.equal(populacaoDe(pac(null, 20)), null);
  assert.match(readFileSync(new URL("../../components/intercorrencias/protocolo.tsx", import.meta.url), "utf8"),
    /semFaixa \? "Informe a idade para calcular na faixa certa\."/);
});

test("calculadora: mg e mcg, mg/mL e mcg/mL, sem trocar uma unidade pela outra", () => {
  const bronco = r("broncoespasmo-grave");
  // 250 mcg na solução de 50 mcg/mL: 5 mL (não 0,005 mL nem 5000 mL).
  assert.deepEqual(conta(bronco, "salbutamol-iv-adulto", ADULTO).contas, [[250, "mcg", 5, "mL"]]);
  // Nebulização em mg/mL: 5 mg a 5 mg/mL = 1 mL; ipratrópio 0,5 mg a 0,25 mg/mL = 2 mL.
  assert.deepEqual(conta(bronco, "salbutamol-neb-adulto", ADULTO).contas, [[5, "mg", 1, "mL"]]);
  assert.deepEqual(conta(bronco, "ipratropio-adulto", ADULTO).contas, [[0.5, "mg", 2, "mL"]]);
  // Magnésio em g: 2 g a 100 mg/mL = 20 mL; a 50% (500 mg/mL) = 4 mL.
  assert.deepEqual(conta(bronco, "magnesio-broncoespasmo-adulto", ADULTO).contas, [[2, "g", 20, "mL"]]);
  assert.deepEqual(conta(bronco, "magnesio-broncoespasmo-adulto", ADULTO, 1).contas, [[2, "g", 4, "mL"]]);
  // Laringoespasmo, 70 kg: propofol 17,5 a 35 mg = 1,75 a 3,5 mL (0,025 a 0,05 mL/kg); succinilcolina IV 17,5 a 35 mg = 1,75 a 3,5 mL; IM 280 mg = 5,6 mL.
  const lar = r("laringoespasmo");
  assert.deepEqual(conta(lar, "propofol-laringoespasmo", ADULTO).contas, [[17.5, "mg", 1.75, "mL"], [35, "mg", 3.5, "mL"]]);
  assert.deepEqual(conta(lar, "succinilcolina-iv-laringoespasmo", ADULTO).contas, [[17.5, "mg", 1.75, "mL"], [35, "mg", 3.5, "mL"]]);
  assert.deepEqual(conta(lar, "succinilcolina-im-laringoespasmo", ADULTO).contas, [[280, "mg", 5.6, "mL"]]);
  // Sugamadex 16 mg/kg, 70 kg: 1120 mg = 11,2 mL a 100 mg/mL.
  assert.deepEqual(conta(r("ventilacao-mascara-dificil"), "sugamadex-mascara", ADULTO).contas, [[1120, "mg", 11.2, "mL"]]);
  // O aerossol é contado em jatos: dose em mcg, sem volume nem concentração presumida.
  const aerossol = doseDe(bronco, "salbutamol-aerossol-adulto");
  assert.deepEqual(conta(bronco, "salbutamol-aerossol-adulto", ADULTO).contas, [[600, "mcg", undefined, undefined], [800, "mcg", undefined, undefined]]);
  assert.equal(aerossol.apresentacoes.length, 0);
  assert.equal(aerossol.semVolume, "6 a 8 jatos de 100 mcg");
});

test("calculadora: taxa de infusão do salbutamol, 5 a 20 mcg/min a 50 mcg/mL = 6 a 24 mL/h", () => {
  assert.deepEqual(conta(r("broncoespasmo-grave"), "salbutamol-infusao-adulto", ADULTO).contas,
    [[5, "mcg", 6, "mL/h"], [20, "mcg", 24, "mL/h"]]);
});

test("calculadora: cada dose só com apresentação da própria via; IM não vai para IO, inalatório não vira IV", () => {
  for (const p of RESPIRATORIO_V3) {
    for (const d of p.medicamentos) {
      d.apresentacoes.forEach((_, i) => {
        const perigo = calcularDose(d, p, ADULTO, i).alertas.filter((a) => a.nivel === "perigo" && /Confira antes de aspirar/.test(a.texto));
        assert.deepEqual(perigo, [], `${p.id}/${d.id}: apresentação de outra via`);
      });
      assert.doesNotMatch(d.via, /IO|intraóss/i, `${p.id}/${d.id}: via IO não validada`);
    }
  }
  const lar = r("laringoespasmo");
  assert.deepEqual(doseDe(lar, "succinilcolina-im-laringoespasmo").apresentacoes.map((a) => a.vias), [["IM"]]);
  assert.deepEqual(doseDe(lar, "succinilcolina-iv-laringoespasmo").apresentacoes.map((a) => a.vias), [["IV"]]);
  assert.ok(doseDe(lar, "succinilcolina-im-laringoespasmo").cuidados!.includes("Não aplicar automaticamente esta dose à via IO."));
  assert.ok(lar.notasDeDose!.includes("Atenção: não aplicar automaticamente a dose IM de 4 mg/kg à via IO."));
  const bronco = r("broncoespasmo-grave");
  for (const d of bronco.medicamentos) {
    if (d.via === "Inalatória") assert.ok(d.apresentacoes.every((a) => a.vias!.includes("Inalatória")), d.id);
    if (/IV/.test(d.via)) assert.ok(d.apresentacoes.every((a) => a.vias!.includes("IV") && !/nebuliza/i.test(a.rotulo)), d.id);
  }
  assert.ok(doseDe(bronco, "salbutamol-aerossol-adulto").cuidados!.includes("Dose inalatória: não converter para a via IV."));
  assert.deepEqual(bronco.alertas, [
    "Utilizar exclusivamente apresentação própria para administração IV quando a via for intravenosa.",
    "Não confundir solução para nebulização com solução injetável.",
  ]);
});

test("calculadora: limites pediátricos — faixas de idade, teto do magnésio e salbutamol IV da criança fora da calculadora", () => {
  const bronco = r("broncoespasmo-grave");
  const servem = (idade: number, peso: number) => bronco.medicamentos
    .filter((d) => doseServe(d, populacaoDe(pac(idade, peso))!, idade, peso)).map((d) => d.id);
  // 3 anos: salbutamol 2,5 mg, ipratrópio 0,25 mg (2 a 12 anos).
  assert.deepEqual(servem(3, 14), ["salbutamol-neb-ped", "ipratropio-ped", "magnesio-broncoespasmo-ped", "hidrocortisona-ped"]);
  // 1 ano: sem ipratrópio.
  assert.deepEqual(servem(1, 10), ["salbutamol-neb-ped", "magnesio-broncoespasmo-ped", "hidrocortisona-ped"]);
  // 8 anos: 2,5 a 5 mg.
  assert.deepEqual(servem(8, 26), ["salbutamol-neb-ped-maior", "ipratropio-ped", "magnesio-broncoespasmo-ped", "hidrocortisona-ped"]);
  assert.deepEqual(conta(bronco, "salbutamol-neb-ped-maior", pac(8, 26)).contas, [[2.5, "mg", 0.5, "mL"], [5, "mg", 1, "mL"]]);
  assert.deepEqual(conta(bronco, "salbutamol-neb-ped", pac(3, 14)).contas, [[2.5, "mg", 0.5, "mL"]]);
  assert.deepEqual(conta(bronco, "ipratropio-ped", pac(3, 14)).contas, [[0.25, "mg", 1, "mL"]]);
  // 12 anos ou mais: as doses do adulto.
  assert.ok(servem(12, 45).includes("salbutamol-neb-adulto") && !servem(12, 45).includes("ipratropio-ped"));
  // Magnésio 50 mg/kg: 20 kg = 1000 mg (10 mL a 10%); 50 kg chega ao teto de 2 g (2000 mg, 20 mL).
  assert.deepEqual(conta(bronco, "magnesio-broncoespasmo-ped", pac(6, 20)).contas, [[1000, "mg", 10, "mL"]]);
  const teto = conta(bronco, "magnesio-broncoespasmo-ped", pac(11, 50));
  assert.deepEqual(teto.contas, [[2000, "mg", 20, "mL"]]);
  assert.ok(teto.alertas.some((a) => /2 g/.test(a.texto)), "o teto aparece como alerta");
  assert.deepEqual(conta(bronco, "hidrocortisona-ped", pac(11, 60)).contas, [[200, "mg", undefined, undefined]]);
  // Salbutamol IV da criança: fora da calculadora até a validação; a referência fica escrita.
  assert.ok(!bronco.medicamentos.some((d) => d.farmaco === "Salbutamol" && d.populacao === "pediatrico" && /IV/.test(d.via)));
  assert.ok(acharProtocolo("broncoespasmo-grave")!.medicamentos.some((d) => d.id === "salbutamol-infusao-ped"), "a versão 2 publicada não mudou");
  assert.match(bronco.notasDeDose![0], /^Salbutamol IV na criança: exige protocolo pediátrico específico\..*0,5 a 1 mcg\/kg\/min, até 20 mcg\/min.*antes de habilitar a calculadora\.$/);
  // Sugamadex e as doses só do adulto não aparecem para a criança.
  assert.equal(doseServe(doseDe(r("ventilacao-mascara-dificil"), "sugamadex-mascara"), "pediatrico", 6, 20), false);
});

test("calculadora: as doses que continuam são as da versão 2 aprovada — o que mudou é só o que o texto mandou", () => {
  for (const id of IDS) {
    const antes = acharProtocolo(id)!;
    for (const d of r(id).medicamentos) {
      const v2 = antes.medicamentos.find((m) => m.id === d.id);
      if (!v2) continue;
      assert.deepEqual(d.dose, v2.dose, `${d.id}: dose mudou`);
      assert.deepEqual(d.apresentacoes, v2.apresentacoes, `${d.id}: apresentação mudou`);
      assert.deepEqual(d.tetoAbsoluto, v2.tetoAbsoluto, `${d.id}: teto mudou`);
      assert.equal(d.via, v2.via, `${d.id}: via mudou`);
    }
  }
  const novas = RESPIRATORIO_V3.flatMap((p) => p.medicamentos.filter((d) => !acharProtocolo(p.id)!.medicamentos.some((m) => m.id === d.id)).map((d) => d.id));
  assert.deepEqual(novas, ["salbutamol-aerossol-adulto", "salbutamol-neb-ped-maior"]);
  const saem = RESPIRATORIO_V3.flatMap((p) => acharProtocolo(p.id)!.medicamentos.filter((m) => !p.medicamentos.some((d) => d.id === m.id)).map((m) => m.id));
  assert.deepEqual(saem, ["salbutamol-iv-lactente", "salbutamol-iv-crianca", "salbutamol-infusao-ped"]);
});

test("calculadora: contraindicações e cuidados de cada fármaco estão no cartão", () => {
  const lar = r("laringoespasmo");
  for (const id of ["succinilcolina-iv-laringoespasmo", "succinilcolina-im-laringoespasmo"]) {
    const c = doseDe(lar, id).cuidados!.join(" ");
    for (const t of ["hiperpotassemia", "doenças neuromusculares", "hipertermia maligna"]) assert.ok(c.includes(t), `${id}: ${t}`);
  }
  assert.match(doseDe(lar, "succinilcolina-iv-laringoespasmo").cuidados![0], /não confundir com a dose utilizada especificamente para intubação traqueal/);
  assert.match(doseDe(lar, "succinilcolina-im-laringoespasmo").cuidados![0], /dose máxima, as contraindicações e a apresentação institucional/);
  assert.deepEqual(doseDe(lar, "propofol-laringoespasmo").cuidados, ["Titular conforme a pressão arterial e o contexto clínico."]);
  assert.ok(lar.notasDeDose!.some((x) => /bradicardia importante com comprometimento.*apropriado à idade/.test(x)));
  const bronco = r("broncoespasmo-grave");
  for (const id of ["salbutamol-iv-adulto", "salbutamol-infusao-adulto"]) {
    assert.ok(doseDe(bronco, id).cuidados!.some((x) => /potássio, glicose e lactato/.test(x)), id);
    assert.ok(doseDe(bronco, id).cuidados!.includes("Usar apenas a apresentação injetável."), id);
  }
  assert.ok(doseDe(bronco, "hidrocortisona-adulto").cuidados!.includes("Não produz reversão imediata do broncoespasmo."));
  assert.ok(bronco.notasDeDose!.includes("Aminofilina não integra a primeira linha deste protocolo."));
  assert.ok(bronco.notasDeDose!.some((x) => /^Adrenalina, ketamina/.test(x)));
  const sug = doseDe(r("ventilacao-mascara-dificil"), "sugamadex-mascara");
  assert.equal(sug.populacao, "adulto");
  assert.ok(sug.cuidados!.some((x) => /não é tratamento garantido para CICO/.test(x)));
  assert.ok(sug.cuidados!.some((x) => /Não atrasar o resgate da oxigenação/.test(x)));
  const asp = r("broncoaspiracao").notasDeDose!.join(" ");
  assert.match(asp, /Antibióticos: não iniciar profilaticamente de rotina/);
  assert.match(asp, /Corticosteroides: não administrar rotineiramente/);
  assert.equal(r("broncoaspiracao").medicamentos.length, 0);
});

test("navegação: os botões pedidos existem e abrem protocolos do catálogo, sem apagar os dados do paciente", () => {
  const destinos = (id: string) => [...(r(id).relacionados ?? []), ...r(id).agirAgora.flatMap((x) => (x.abre ? [x.abre] : []))].map((x) => x.protocolo);
  const pedidos: Array<[string, string]> = [
    ["ventilacao-mascara-dificil", "intubacao-dificil"], ["intubacao-dificil", "nao-ventilo-nao-intubo"],
    ["laringoespasmo", "nao-ventilo-nao-intubo"], ["pressao-vias-aereas", "broncoespasmo-grave"],
    ["broncoespasmo-grave", "anafilaxia"], ["broncoaspiracao", "broncoespasmo-grave"], ["broncoaspiracao", "dessaturacao"],
  ];
  for (const [de, para] of pedidos) {
    assert.ok(destinos(de).includes(para), `${de} → ${para}`);
    assert.equal(r(de).relacionados![de === "broncoaspiracao" && para === "dessaturacao" ? 1 : 0].protocolo, para, `${de}: ${para} em primeiro`);
  }
  // O passo que manda para o CICO tem o botão no próprio passo.
  for (const id of ["ventilacao-mascara-dificil", "intubacao-dificil", "laringoespasmo"]) {
    assert.ok(r(id).agirAgora.some((x) => x.abre?.protocolo === "nao-ventilo-nao-intubo" && /CICO/.test(`${x.texto} ${x.detalhe}`)), id);
  }
  assert.ok(r("broncoespasmo-grave").agirAgora.some((x) => x.abre?.protocolo === "anafilaxia" && /Se houver suspeita de anafilaxia/.test(x.detalhe!)));
  // Todo destino existe no catálogo; na prévia, abre o rascunho quando há um.
  for (const p of RESPIRATORIO_V3) {
    for (const alvo of destinos(p.id)) {
      assert.ok(acharProtocolo(alvo), `${p.id} → ${alvo}`);
      assert.equal(PROTOCOLOS_DA_PREVIA.find((x) => x.id === alvo), rascunhoDe(alvo) ?? acharProtocolo(alvo));
    }
  }
  // A tela: o botão do passo só aparece para destino liberado, e abrir outro protocolo não mexe nos dados do paciente.
  const tela = readFileSync(new URL("../../components/intercorrencias/protocolo.tsx", import.meta.url), "utf8");
  assert.match(tela, /x\.abre && aoAbrirProtocolo && disponivel\(x\.abre\.protocolo\)/);
  const modulo = readFileSync(new URL("../../components/intercorrencias/intercorrencias.tsx", import.meta.url), "utf8");
  const abrir = modulo.slice(modulo.indexOf("const abrir = "), modulo.indexOf("const alternarFavorito"));
  assert.doesNotMatch(abrir, /\bset\(|dados/, "abrir um protocolo não pode limpar os dados do paciente");
  assert.match(modulo, /aoAbrirProtocolo=\{\(x\) => \{ const alvo = disponiveis\.find/);
});

test("impressão: todas as etapas saem no papel; só os botões ficam de fora", () => {
  const tela = readFileSync(new URL("../../components/intercorrencias/protocolo.tsx", import.meta.url), "utf8");
  // O cartão inteiro é a área impressa; o Agir agora, o material e os alertas não têm a classe que some no papel.
  assert.match(tela, /className=\{`\$\{estilos\.modulo\} \$\{estilos\.impressao\}`\}/);
  const agir = tela.slice(tela.indexOf('<section id="agir"'), tela.indexOf("{temDoses && <section"));
  // Só os botões e o seletor de ramo (idade gestacional, um toque) ficam de fora do papel.
  assert.doesNotMatch(agir.replace(/<button[\s\S]*?<\/button>/g, "").replace("${estilos.ramos} ${estilos.naoImprimir}", ""), /naoImprimir/);
  assert.match(agir, /estilos\.abrePasso\} \$\{estilos\.naoImprimir\}/);
  assert.match(agir, /<h4>Material<\/h4>/);
  assert.match(agir, /<h4>Alertas de segurança<\/h4>/);
  // Sem idade, o papel leva os dois ramos do CICO.
  assert.equal(passosDe(r("nao-ventilo-nao-intubo"), null).length, 13);
  // O selo do rascunho.
  // A versão e o estado do rascunho ficam no fim do cartão, junto das referências; o topo não traz mais essas linhas.
  const topo = tela.slice(tela.indexOf("<header className={estilos.protoTitulo}>"), tela.indexOf("</header>"));
  assert.doesNotMatch(topo, /Versão \{p\.versao\}|Corrigido — aguardando validação médica/);
  const refs = tela.slice(tela.indexOf('<section id="referencias"'));
  assert.match(refs, /Versão \{p\.versao\} · conteúdo de \{dataBr\(p\.atualizadoEm\)\}/);
  assert.match(refs, /rascunho em validação; quem usa continua com a versão/);
});

test("referências: SBA 2024 identificada pelo DOI; AHRQ pendente; toda referência dos sete existe", () => {
  const sba = acharReferencia("sba-2024-via-aerea")!;
  assert.equal(sba.doi, "10.1016/j.bjane.2023.12.001");
  assert.equal(sba.ano, 2024);
  assert.equal(sba.conferida, false);
  const ahrq = acharReferencia("ahrq-aspiracao")!;
  assert.equal(ahrq.conferida, false);
  assert.equal(ahrq.localizacao, null);
  for (const p of RESPIRATORIO_V3) {
    for (const id of [...p.referencias, ...p.medicamentos.flatMap((d) => d.referencias), ...p.divergencias.flatMap((d) => d.posicoes.map((x) => x.referencia))]) {
      assert.ok(acharReferencia(id), `${p.id}: referência ${id}`);
    }
  }
  for (const id of ["ventilacao-mascara-dificil", "intubacao-dificil", "nao-ventilo-nao-intubo"]) {
    assert.ok(r(id).referencias.includes("das-2025") && r(id).referencias.includes("sba-2024-via-aerea"), id);
  }
});
