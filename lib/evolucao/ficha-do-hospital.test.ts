import test from "node:test";
import assert from "node:assert/strict";
import {
  jaPreenchido, juntarComConfianca, lerFichaDoHospital, mesmoPaciente, numeroDe, preencherAFolha, propostaDaFicha, simOuNao,
  type PalavraComConfianca,
} from "./ficha-do-hospital.ts";
import { apagarLinhas, binarizar, type Imagem } from "./imagem-da-ficha.ts";

// Uma ficha pré-anestésica no desenho da do hospital, com paciente e médica
// FICTÍCIOS: cada linha é [y, [x, texto]…], e cada palavra vira uma caixa,
// como o OCR devolve. A folha vem levemente torta (2%), e com a sujeira que a
// borda da foto deixa ("j" de confiança baixa, um "E" isolado).
const FOLHA: Array<[number, Array<[number, string]>]> = [
  [100, [[100, "Paciente: MARIA FICTÍCIA DA SILVA"], [1500, "Prontuário: 12.345"]]],
  [140, [[100, "Data de Nascimento: 07/08/1975"], [900, "Idade: 51a"], [1500, "Convênio: 02 - UNIMED"]]],
  [180, [[100, "Sexo: Feminino"], [1500, "Atendimento: 10/11/2026"]]],
  [300, [[800, "Evento em: 10/11/2026 08:30:00-03:00"]]],
  [340, [[700, "CRM: PR - 12345 MEDICA FICTICIA"]]],
  [420, [[100, "ANAMNESE"]]],
  [470, [[100, "Peso"], [500, "Altura"]]],
  [510, [[105, "64,5"], [505, "1,58"]]],
  [560, [[100, "Cirurgia proposta"]]],
  [600, [[105, "COLECISTECTOMIA VIDEO"]]],
  [650, [[100, "Já fez alguma cirurgia?"], [900, "Qual?"]]],
  [690, [[105, "Sim"], [905, "CESAREA EM 2010 - RAQUI"]]],
  [740, [[100, "Apresentou reação a algum tipo de anestesia? E na família?"], [1400, "Medicação de uso contínua"]]],
  [780, [[105, "Não"], [1405, "Sim"]]],
  [830, [[100, "Qual?"]]],
  [870, [[105, "LOSARTANA 50 MG"]]],
  [920, [[100, "Faz uso de anticoagulante, quando parou"]]],
  [960, [[105, "NEGA"]]],
  [1010, [[100, "Tem doença cardiovascular?"], [900, "Capacidade funcional em METS: <4 4 a 10 >10"]]],
  [1050, [[105, "Sim"], [905, "Sim"]]],
  [1100, [[100, "Qual?"]]],
  [1140, [[105, ">10"]]],
  [1190, [[100, "Tem sintomas cardiovasculares?"], [700, "Tem doença respiratória?"], [1300, "Apneia obstrutiva do sono?"]]],
  [1230, [[105, "Não"], [705, "Sim"], [1305, "Não"]]],
  [1280, [[100, "Tem diabetes?"], [700, "Tem problemas neurológicos ou psiquiátricos?"]]],
  [1320, [[105, "Não"], [705, "Não"]]],
  [1370, [[100, "Tem outras doenças? (tireoide, artrites, hepáticas, renais, etc)"]]],
  [1410, [[105, "Sim"]]],
  [1460, [[100, "Qual?"]]],
  [1500, [[105, "HIPOTIREOIDISMO"]]],
  [1550, [[100, "Tem doença aguda no momento? (Gripe, tosse, febre, ITU, etc.)"], [1300, "Usa prótese dentária removível?"]]],
  [1590, [[105, "Não"], [1305, "Não"]]],
  [1640, [[100, "Tem alergias?"], [700, "É Tabagista, Etilista ou Toxicômano?"]]],
  [1680, [[105, "Sim"], [705, "Não"]]],
  [1730, [[100, "Qual?"]]],
  [1770, [[105, "DIPIRONA"]]],
  [1820, [[100, "Tem Glaucoma?"]]],
  [1860, [[105, "Não"]]],
  [1910, [[100, "EXAME FÍSICO"]]],
  [1960, [[100, "Pressão Arterial Sistólica"], [600, "Pressão Arterial Diastólica"], [1100, "ASA"], [1400, "Mallampati"]]],
  [2000, [[105, "130 mmHg"], [605, "Bo mmHg"], [1105, "3"], [1405, "II"]]],
  [2050, [[100, "Abertura Bocal"], [600, "Distância MT"], [1100, "Dentes"]]],
  [2090, [[105, ">= 4 CM"], [605, "> 6 CM"], [1105, "Normais"]]],
  [2200, [[600, "HOSPITAL FICTÍCIO DE TESTE"]]],
];

function palavrasDa(folha: typeof FOLHA, inclinacao = 0.02): PalavraComConfianca[] {
  const ps: PalavraComConfianca[] = [];
  for (const [y, pedacos] of folha) {
    for (const [x0, texto] of pedacos) {
      let x = x0;
      for (const t of texto.split(" ")) {
        const largura = t.length * 15;
        const dy = (x + largura / 2) * inclinacao;
        ps.push({ t, c: 92, x0: x, x1: x + largura, y0: y - 14 + dy, y1: y + 14 + dy });
        x += largura + 14;
      }
    }
  }
  // A sujeira da borda da foto.
  ps.push({ t: "j", c: 30, x0: 20, x1: 30, y0: 1400, y1: 1420 });
  ps.push({ t: "E", c: 96, x0: 25, x1: 40, y0: 1395 + 20 * 0.02, y1: 1423 });
  return ps;
}

const lida = lerFichaDoHospital(palavrasDa(FOLHA));
const porChave = Object.fromEntries(propostaDaFicha(lida).map((c) => [c.chave, c.valor]));

test("ficha do hospital: a identificação e quem avaliou", () => {
  assert.deepEqual(lida.paciente, { nome: "MARIA FICTÍCIA DA SILVA", nascimento: "1975-08-07", sexo: "Feminino", convenio: "UNIMED", prontuario: "12.345" });
  assert.deepEqual(lida.autor, { crm: "PR 12345", nome: "MEDICA FICTICIA", quando: "10/11/2026 08:30" });
});

test("ficha do hospital: o nome e o nascimento mesmo com o cabeçalho mal lido", () => {
  const variante = (cabecalho: typeof FOLHA) => lerFichaDoHospital(palavrasDa([...cabecalho, ...FOLHA.slice(5)])).paciente;
  // "Paciente:" colado no nome, e o Prontuário lido numa linha à parte.
  const colado = variante([
    [100, [[100, "Paciente:MARIA FICTÍCIA DA SILVA"]]],
    [104, [[1500, "Prontuário: 12.345"]]],
    [140, [[100, "Data de Nascimento:O7/08/l975"], [900, "Idade: 51a"], [1500, "Convênio: 02 - UNIMED"]]],
  ]);
  assert.equal(colado.nome, "MARIA FICTÍCIA DA SILVA");
  assert.equal(colado.nascimento, "1975-08-07", "O e l no lugar de 0 e 1");
  // Sem a palavra "Nascimento" lida: a data mais antiga do cabeçalho (a outra é a do atendimento).
  const semRotulo = variante([
    [100, [[100, "Paciente: MARIA FICTÍCIA DA SILVA"], [1500, "Prontuário: 12.345"]]],
    [140, [[100, "Data de Nasclmentu 07/08/1975"], [1500, "Atendimento: 10/11/2026"]]],
  ]);
  assert.equal(semRotulo.nascimento, "1975-08-07");
  // A data partida em duas palavras pela leitura ("07/08/1 975").
  const partida = variante([
    [100, [[100, "Paciente: MARIA FICTÍCIA DA SILVA"], [1500, "Prontuário: 12.345"]]],
    [140, [[100, "Data de Nascimento:07/08/1 975"], [900, "Idade: 51a"]]],
  ]);
  assert.equal(partida.nascimento, "1975-08-07");
});

test("ficha do hospital: cada resposta na sua coluna, mesmo com três perguntas lado a lado e a foto torta", () => {
  assert.equal(lida.respostas.sintomas, "Não");
  assert.equal(lida.respostas.respiratoria, "Sim");
  assert.equal(lida.respostas.apneia, "Não");
  assert.equal(lida.respostas.diabetes, "Não");
  assert.equal(lida.respostas.neuro, "Não", "o 'Tem' de 'Tem problemas neurológicos' abre a coluna, e não o 'neurológicos'");
  assert.equal(lida.respostas.anticoagulante, "NEGA", "o rótulo que começa em 'Faz uso de' é dono da resposta embaixo dele");
  assert.equal(lida.respostas.outras, "Sim", "o 'E' da borda da foto não entra");
  assert.equal(lida.detalhes.cirurgias, "CESAREA EM 2010 - RAQUI", "o Qual? ao lado é da pergunta à esquerda");
  assert.equal(lida.detalhes.medicacao, "LOSARTANA 50 MG", "o Qual? sozinho é do Sim da linha de cima");
  assert.equal(lida.detalhes.capacidade, ">10", "faixa de METs é da capacidade funcional, mesmo com a cardiopatia em Sim");
  assert.equal(lida.detalhes.alergias, "DIPIRONA");
});

test("ficha do hospital: da avaliação do outro médico, só os dados do paciente para o cabeçalho", () => {
  assert.deepEqual(porChave, {
    procedimento: "COLECISTECTOMIA VIDEO",
    peso_kg: "64,5",
    altura_cm: "158",
    alergias: "DIPIRONA",
    papel_medicacao_uso: "LOSARTANA 50 MG",
  }, "sem ASA, PA, aparelhos, anestesia anterior nem observações: a avaliação clínica é de quem está na sala");
});

test("ficha do hospital: só o campo vazio é preenchido, e a ficha guarda de onde veio", () => {
  const dados = { peso_kg: 70, papel_medicacao_uso: "Enalapril", procedimento: "", nega_alergia: false };
  const campos = propostaDaFicha(lida).map(({ chave, valor }) => ({ chave, valor }));
  assert.equal(jaPreenchido(dados, "peso_kg"), true);
  assert.equal(jaPreenchido(dados, "papel_medicacao_uso"), true);
  assert.equal(jaPreenchido(dados, "procedimento"), false);
  const parcial = preencherAFolha(dados, campos, new Date("2026-11-11T12:00:00Z"), lida);
  assert.equal(parcial.peso_kg, undefined, "o peso que já estava fica");
  assert.equal(parcial.papel_medicacao_uso, undefined);
  assert.equal(parcial.altura_cm, 158);
  assert.equal(parcial.procedimento, "COLECISTECTOMIA VIDEO");
  assert.equal(parcial.alergias, "DIPIRONA");
  assert.equal(parcial.nega_alergia, false);
  assert.deepEqual(Object.keys(parcial).sort(), ["alergias", "altura_cm", "ficha_do_hospital", "nega_alergia", "procedimento"]);
  assert.deepEqual(parcial.ficha_do_hospital,
    { lida_em: "2026-11-11T12:00:00.000Z", crm: "PR 12345", medico: "MEDICA FICTICIA", avaliada_em: "10/11/2026 08:30" });
  // "Nega" alergia marca a opção da ficha, sem texto.
  const nega = preencherAFolha({}, [{ chave: "alergias", valor: "Nega" }], new Date(), lida);
  assert.equal(nega.nega_alergia, true);
  assert.equal(nega.alergias, "");
  // Nada a preencher: nada gravado, nem a marca de origem.
  assert.deepEqual(preencherAFolha({ peso_kg: 70 }, [{ chave: "peso_kg", valor: "80" }], new Date()), {});
  // Peso absurdo (OCR que leu 780) não entra.
  assert.deepEqual(preencherAFolha({}, [{ chave: "peso_kg", valor: "780" }], new Date()), {});
});

test("ficha do hospital: Sim, Não e números como o OCR devolve", () => {
  assert.equal(simOuNao("[Não"), "Não");
  assert.equal(simOuNao("NEGA"), "Não");
  assert.equal(simOuNao("Slm"), "Sim");
  assert.equal(simOuNao("N"), "Não");
  assert.equal(simOuNao("talvez"), "");
  assert.equal(numeroDe("120 mmHg"), 120);
  assert.equal(numeroDe("Bo mmHg"), 80);
  assert.equal(numeroDe("1,70"), 1.7);
  assert.equal(numeroDe("7O"), 70);
  assert.equal(numeroDe("Normais"), null);
});

test("ficha do hospital: a folha é deste paciente?", () => {
  assert.equal(mesmoPaciente("Maria Fictícia da Silva", "MARIA FICTICIA DA SILVA"), true);
  assert.equal(mesmoPaciente("Maria Fictícia da Silva", "MARIA FICTICIA DA SLVA SILVA"), true);
  assert.equal(mesmoPaciente("Maria Fictícia da Silva", "JOAO EXEMPLO PEREIRA"), false);
  assert.equal(mesmoPaciente("Maria Fictícia da Silva", ""), true, "sem nome lido, não há o que conferir");
});

test("ficha do hospital: das duas leituras do OCR, a palavra inteira e a mais confiante", () => {
  const a: PalavraComConfianca[] = [
    { t: "N", c: 93, x0: 100, x1: 120, y0: 0, y1: 20 },
    { t: "BK", c: 38, x0: 200, x1: 230, y0: 0, y1: 20 },
    { t: "(OMEPRAZOL", c: 0, x0: 300, x1: 450, y0: 0, y1: 20 },
    { t: "lixo", c: 5, x0: 600, x1: 650, y0: 0, y1: 20 },
  ];
  const b: PalavraComConfianca[] = [
    { t: "Não", c: 32, x0: 98, x1: 150, y0: 0, y1: 20 },
    { t: "BX", c: 59, x0: 201, x1: 231, y0: 0, y1: 20 },
  ];
  const juntas = juntarComConfianca(a, b).map((p) => p.t).sort();
  assert.deepEqual(juntas, ["(OMEPRAZOL", "BX", "Não"]);
});

test("imagem da ficha: o cinza da caixa some, a letra fica, e a borda torta da caixa sai", () => {
  const W = 300, H = 120;
  const cinza = new Uint8Array(W * H).fill(200);
  // Uma "letra" escura de 10×20, um traço horizontal comprido e levemente torto (a borda da caixa) e uma vertical de 60.
  for (let y = 40; y < 60; y++) for (let x = 20; x < 30; x++) cinza[y * W + x] = 60;
  for (let x = 10; x < 290; x++) cinza[(90 + Math.floor(x / 70)) * W + x] = 50;
  for (let y = 10; y < 70; y++) cinza[y * W + 250] = 50;
  const img: Imagem = { largura: W, altura: H, pontos: cinza };
  const pb = binarizar(img, { janela: 0.2, k: 0.12 });
  assert.equal(pb.pontos[50 * W + 25], 0, "a letra vira tinta");
  assert.equal(pb.pontos[20 * W + 100], 255, "o fundo cinza vira branco");
  const limpa = apagarLinhas(pb, { minimoH: 60, minimoV: 38 });
  assert.equal(limpa.pontos[50 * W + 25], 0, "a letra fica");
  for (let x = 10; x < 290; x += 7) assert.equal(limpa.pontos[(90 + Math.floor(x / 70)) * W + x], 255, `a borda torta sai (x=${x})`);
  assert.equal(limpa.pontos[30 * W + 250], 255, "a borda vertical sai");
});
