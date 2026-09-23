import test from "node:test";
import assert from "node:assert/strict";
import {
  apenasOsVazios, AVISO_LEITURA_DE_EXAMES, lerExames, lerNumero, plaquetasCheias,
  lerDataDaColeta,
} from "./exames-leitura.ts";

// Um hemograma como os laboratórios brasileiros imprimem, com valor de
// referência do lado — que é justamente o que confunde leitura ingênua.
const LAUDO = `
LABORATORIO CENTRAL — HEMOGRAMA COMPLETO
Paciente: MARIA S. SOUZA      Data: 20/09/2026
Hemoglobina .......... 13,5 g/dL        VR: 12,0 a 16,0
Hematócrito .......... 40,2 %           VR: 36 a 47
Plaquetas ............ 250.000 /mm3     VR: 150.000 a 450.000
COAGULOGRAMA
TAP .................. 12,4 s
INR .................. 1,05
TTPa ................. 28,0 s
BIOQUIMICA
Creatinina ........... 0,９ mg/dL
Ureia ................ 32 mg/dL
Sódio ................ 140 mEq/L
Potássio ............. 4,2 mEq/L
Glicemia de jejum .... 92 mg/dL
Hemoglobina glicada .. 5,4 %
`.replace("０,９", "0,9").replace("０", "0").replace("９", "9");

test("lê um hemograma inteiro", () => {
  const { valores } = lerExames(LAUDO);
  assert.equal(valores.hemoglobina, "13,5");
  assert.equal(valores.hematocrito, "40,2");
  assert.equal(valores.tap, "12,4");
  assert.equal(valores.inr, "1,05");
  assert.equal(valores.ttpa, "28");
  assert.equal(valores.ureia, "32");
  assert.equal(valores.sodio, "140");
  assert.equal(valores.potassio, "4,2");
  assert.equal(valores.glicemia, "92");
  assert.equal(valores.hba1c, "5,4");
});

test("PLAQUETA COM PONTO DE MILHAR NÃO VIRA 250", () => {
  // É a armadilha central deste arquivo. `Number("250.000")` devolve 250 em
  // JavaScript — plaqueta de quem está sangrando —, e o campo seria preenchido
  // com um número que muda a conduta.
  assert.equal(lerNumero("250.000"), 250_000);
  assert.equal(lerNumero("1.234.567"), 1_234_567);
  assert.equal(lerExames("Plaquetas 250.000 /mm3").valores.plaquetas, "250.000");
});

test("vírgula continua sendo decimal", () => {
  assert.equal(lerNumero("1,05"), 1.05);
  assert.equal(lerNumero("13,5"), 13.5);
  // Três dígitos depois da vírgula NÃO são milhar: vírgula nunca agrupa.
  assert.equal(lerNumero("1,500"), 1.5);
});

test("plaqueta escrita em milhares vira a contagem cheia", () => {
  // O mesmo paciente, três laudos diferentes, o mesmo número na ficha.
  assert.equal(plaquetasCheias(250), 250_000);
  assert.equal(plaquetasCheias(250_000), 250_000);
  assert.equal(lerExames("Plaquetas: 250 mil/mm3").valores.plaquetas, "250.000");
  assert.equal(lerExames("PLT 250 10^3/uL").valores.plaquetas, "250.000");
});

test("VALOR FORA DO HUMANO É DESCARTADO, e a tela é avisada", () => {
  // OCR de foto de papel troca vírgula por nada: 1,05 vira 105. Preencher
  // INR 105 é pior do que deixar vazio — vazio o anestesiologista enxerga.
  const { valores, descartados } = lerExames("INR 105\nCreatinina 0,9");
  assert.equal(valores.inr, undefined);
  assert.ok(descartados.includes("INR"));
  assert.equal(valores.creatinina, "0,9", "o que estava plausível continua entrando");
});

test("o rótulo mais longo vence o mais curto", () => {
  // "glicemia" casaria dentro de "glicemia de jejum" e poderia trazer outro
  // número; "glicada" casaria dentro de "hemoglobina glicada".
  const t = "Glicemia de jejum: 92 mg/dL\nHemoglobina glicada: 5,4 %";
  const { valores } = lerExames(t);
  assert.equal(valores.glicemia, "92");
  assert.equal(valores.hba1c, "5,4");
});

test("HEMOGLOBINA GLICADA NÃO É HEMOGLOBINA", () => {
  // As duas começam igual. Se "hemoglobina" casar primeiro na linha da
  // glicada, a ficha recebe Hb 5,4 — anemia grave inventada num paciente
  // hígido, no campo que decide se a cirurgia acontece.
  const { valores } = lerExames("Hemoglobina glicada (HbA1c): 5,4 %");
  assert.equal(valores.hemoglobina, undefined,
    "5,4 não pode cair no campo de hemoglobina");
  assert.equal(valores.hba1c, "5,4");
});

test("rótulo curto só casa delimitado, nos dois lados", () => {
  // Sem fechar o rótulo à direita, "na" casava dentro de "Data Nasc...:
  // 04/07/2005" — apareceu no laudo real — e o sódio saía 4.
  assert.equal(lerExames("Data Nasc...: 04/07/2005").valores.sodio, undefined);
  assert.equal(lerExames("Paciente: ANA MARIA, 44 anos").valores.sodio, undefined);
  assert.equal(lerExames("K 4,2").valores.potassio, "4,2");
  assert.equal(lerExames("Sódio: 140 mEq/L").valores.sodio, "140");
  assert.equal(lerExames("Na+ 140 mEq/L").valores.sodio, "140");
});

test("O 'NA' SOZINHO NÃO É APELIDO DE SÓDIO — é preposição", () => {
  // Esta é uma perda ASSUMIDA, e vale registrar por quê. "na" é palavra comum
  // em português, e um laudo diz "coletado na unidade 3" sem nenhum esforço.
  // Casar ali escreveria sódio 3 numa ficha — plausível o bastante para passar
  // pela faixa e errado o bastante para mudar conduta. Laboratório que escreve
  // só "Na" perde a leitura automática desse campo; o anestesiologista digita,
  // que é o que ele já fazia. Campo vazio ele enxerga; campo errado, não.
  assert.equal(lerExames("Material coletado na unidade 3").valores.sodio, undefined);
  assert.equal(lerExames("Na 140 mEq/L").valores.sodio, undefined);
});

test("texto sem exame nenhum não inventa campo", () => {
  const { valores, descartados } = lerExames("Receituário — repouso por 3 dias.");
  assert.deepEqual(valores, {});
  assert.deepEqual(descartados, []);
});

test("O QUE JÁ ESTÁ PREENCHIDO NUNCA É SOBRESCRITO", () => {
  // Quem digitou a creatinina digitou por algum motivo: tinha o laudo na mão,
  // ou corrigiu uma leitura torta. Uma foto anexada depois não desfaz isso.
  const lidos = { creatinina: "0,9", hemoglobina: "13,5", sodio: "140" } as const;
  const naFicha = { creatinina: "1,4", hemoglobina: "", sodio: "   " };
  assert.deepEqual(apenasOsVazios(lidos, naFicha), { hemoglobina: "13,5", sodio: "140" });
});

test("campo ausente da ficha conta como vazio", () => {
  assert.deepEqual(apenasOsVazios({ inr: "1,05" }, {}), { inr: "1,05" });
  assert.deepEqual(apenasOsVazios({ inr: "1,05" }, { inr: undefined }), { inr: "1,05" });
});

test("o aviso diz que é leitura automática e que dá para editar", () => {
  // A frase é a proteção do anestesiologista: ele assina a ficha, não o OCR.
  assert.match(AVISO_LEITURA_DE_EXAMES, /confira/i);
  assert.match(AVISO_LEITURA_DE_EXAMES, /erra/i);
  assert.match(AVISO_LEITURA_DE_EXAMES, /edit/i);
});

test("laudo em coluna não pega o número da linha de baixo", () => {
  // O limite de distância entre rótulo e número é o que impede isso.
  const { valores } = lerExames("Ecocardiograma\nFracao de ejecao\n\n\n\n\n\n62 %\nCreatinina 0,8");
  assert.equal(valores.creatinina, "0,8");
});

// ===========================================================================
// O laudo de verdade
// ===========================================================================
// Texto extraído de um PDF do Pronto Análise (Campo Mourão), que é o
// laboratório da Santa Casa onde este sistema é usado. Cada detalhe aqui
// apareceu em produção, e três deles quebravam a versão anterior.
const PRONTO_ANALISE = `
Sr. (a).....: 181276-SARAH ALVES OLIVEIRA Data Nasc...: 04/07/2005
Emitido em..: 23/09/2026 13:09 Data Entra..: 23/09/2026
Material: Sangue Total - EDTA Coletado em: 23/09/2026 12:09
Hemograma
ERITROGRAMA
Eritrócitos.........: 3,95 milh/mm³ > 13 anos........: 4,00 a 5,00 milh/mm³
Hemoglobina.........: 12,47 g/dL > 13 anos........: 12,0 a 15,0 g/dL
Hematócrito.........: 36,87 % > 13 anos........: 36 a 46 %
H.C.M...............: 31,57 pg > 13 anos........: 27 a 32 pg
Plaquetas...........: 205.400 /mm³ > 15 anos...: 150.000 a 400.000/mm³
LEUCOGRAMA
Leucócitos..........: 9.430 /mm³ > 13 anos........: 4.000 a 11.000
Uréia
Resultado...........: 14 mg/dL 15,0 a 40,0 mg/dL
Resultados Anteriores:
21/09/2026
24 mg/dL
Creatinina
Resultado...........: 0,54 mg/dL 0.4 a 1.4 mg/dl
Resultados Anteriores:
21/09/2026
0,81 mg/dL
`;

test("LAUDO REAL: lê o hemograma do Pronto Análise", () => {
  const { valores } = lerExames(PRONTO_ANALISE);
  assert.equal(valores.hemoglobina, "12,47");
  assert.equal(valores.hematocrito, "36,87");
  assert.equal(valores.plaquetas, "205.400");
});

test("LAUDO REAL: o nome do exame é o título, e o valor diz só 'Resultado'", () => {
  // Metade dos exames deste laboratório não repete o nome na linha do valor:
  //     Uréia
  //     Resultado...........: 14 mg/dL
  // Sem a ponte do "Resultado", ureia e creatinina saíam vazias.
  const { valores } = lerExames(PRONTO_ANALISE);
  assert.equal(valores.ureia, "14");
  assert.equal(valores.creatinina, "0,54");
});

test("LAUDO REAL: 'Resultados Anteriores' não vence o resultado de hoje", () => {
  // O laudo imprime o exame de dois dias atrás logo abaixo. Pegar 24 no lugar
  // de 14, ou 0,81 no lugar de 0,54, seria decidir sobre o paciente errado —
  // o mesmo paciente, no dia errado.
  const { valores } = lerExames(PRONTO_ANALISE);
  assert.notEqual(valores.ureia, "24");
  assert.notEqual(valores.creatinina, "0,81");
});

test("LAUDO REAL: o valor de referência ao lado não é lido como resultado", () => {
  // "Hemoglobina...: 12,47 g/dL   > 13 anos...: 12,0 a 15,0 g/dL" — o primeiro
  // número depois do rótulo é o do paciente, e é por isso que a busca para nele.
  const { valores } = lerExames(PRONTO_ANALISE);
  assert.equal(valores.hemoglobina, "12,47");
  assert.notEqual(valores.hemoglobina, "12,0");
  assert.notEqual(valores.hematocrito, "36");
});

test("LAUDO REAL: exame que o laboratório não fez continua vazio", () => {
  // Este laudo não tem coagulograma nem glicemia. Inventar valor para campo
  // ausente é pior do que não ler nada.
  const { valores } = lerExames(PRONTO_ANALISE);
  for (const campo of ["tap", "inr", "ttpa", "glicemia", "hba1c", "sodio", "potassio"] as const) {
    assert.equal(valores[campo], undefined, `${campo} não existe neste laudo`);
  }
});

test("LAUDO REAL: a data que entra na ficha é a da COLETA", () => {
  // O laudo tem três datas. "Emitido em" é quando imprimiram; "Coletado em" é
  // quando o sangue saiu do paciente — e é essa que diz se o exame ainda vale
  // na véspera da cirurgia.
  assert.equal(lerDataDaColeta(PRONTO_ANALISE), "2026-09-23");
  assert.equal(
    lerDataDaColeta("Emitido em..: 30/09/2026\nColetado em: 01/09/2026 08:10"),
    "2026-09-01",
    "a coleta vence a emissão",
  );
  assert.equal(lerDataDaColeta("Receituário simples"), undefined);
});
