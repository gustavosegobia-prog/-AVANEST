import test from "node:test";
import assert from "node:assert/strict";
import { cortarNoProximoRotulo, lerFichaDeInternacao, pareceNome } from "./ficha-internacao.ts";

// As fichas abaixo imitam o que o OCR devolve de fotos reais: caixa alta,
// acento perdido, rótulo às vezes ao lado do valor e às vezes acima dele.

test("ficha com rótulo e valor na mesma linha", () => {
  const { dados } = lerFichaDeInternacao(`
HOSPITAL SANTA CASA DE CAMPO MOURAO
FICHA DE INTERNACAO
Paciente: MARIA APARECIDA DOS SANTOS
Data de nascimento: 14/03/1958
Convenio: UNIMED
Procedimento: COLECISTECTOMIA VIDEOLAPAROSCOPICA
Leito: 214
`);
  assert.equal(dados.paciente, "MARIA APARECIDA DOS SANTOS");
  assert.equal(dados.convenio, "UNIMED");
  assert.equal(dados.procedimento, "COLECISTECTOMIA VIDEOLAPAROSCOPICA");
});

test("ficha com o rótulo acima do valor", () => {
  const { dados } = lerFichaDeInternacao(`
NOME DO PACIENTE
JOAO BATISTA DE OLIVEIRA
CONVENIO
BRADESCO SAUDE
CIRURGIA PROPOSTA
HERNIORRAFIA INGUINAL DIREITA
`);
  assert.equal(dados.paciente, "JOAO BATISTA DE OLIVEIRA");
  assert.equal(dados.convenio, "BRADESCO SAUDE");
  assert.equal(dados.procedimento, "HERNIORRAFIA INGUINAL DIREITA");
});

test("rótulo seguido de outro rótulo não vira valor", () => {
  // O erro que mais custa caro: campo em branco na ficha, e o OCR entrega o
  // rótulo seguinte como se fosse o nome do paciente.
  const { dados, naoEncontrados } = lerFichaDeInternacao(`
PACIENTE:
DATA DE NASCIMENTO: 02/05/1970
LEITO: 12
`);
  assert.equal(dados.paciente, undefined);
  assert.ok(naoEncontrados.includes("paciente"));
});

test("o nome do cirurgião não é confundido com o do paciente", () => {
  const { dados } = lerFichaDeInternacao(`
Paciente: ANA LUCIA FERREIRA
Cirurgiao: DR CARLOS EDUARDO NUNES
Anestesista: DR GUSTAVO SEGOBIA
Convenio: CASSI
`);
  assert.equal(dados.paciente, "ANA LUCIA FERREIRA");
});

test('"nome" só é usado quando não há "paciente"', () => {
  const { dados } = lerFichaDeInternacao(`
Nome: TEREZINHA DE JESUS ALVES
Convenio: PARTICULAR
`);
  assert.equal(dados.paciente, "TEREZINHA DE JESUS ALVES");
  assert.equal(dados.convenio, "PARTICULAR");
});

test("particular carimbado, sem rótulo de convênio", () => {
  const { dados } = lerFichaDeInternacao(`
Paciente: SEBASTIAO RODRIGUES FILHO
Procedimento: RINOPLASTIA
PARTICULAR
`);
  assert.equal(dados.convenio, "Particular");
});

test("registro colado no nome é cortado, não descartado", () => {
  // Esta regra MUDOU, e a mudança tem motivo. Antes, nome com número dentro
  // era jogado fora inteiro — "não adivinhar" era a política. Só que a ficha
  // do SUS põe o prontuário na mesma linha do nome, sem rótulo entre os dois:
  // "MARTINA SIQUEIRA BRAGA 4.407.256". Descartar ali é descartar a ficha
  // toda, que é o que estava acontecendo.
  //
  // Cortar no número não é adivinhar: nome de pessoa não tem número de quatro
  // dígitos dentro. O que vem depois do número é de outra coluna.
  const { dados } = lerFichaDeInternacao("Paciente: MARIA APARECIDA 4471\n");
  assert.equal(dados.paciente, "MARIA APARECIDA");

  // O que continua descartado: número curto colado na palavra, que é o OCR
  // errando dentro do próprio nome e não uma coluna vizinha.
  const grudado = lerFichaDeInternacao("Paciente: MAR1A APARECIDA\n");
  assert.equal(grudado.dados.paciente, undefined);
});

test("primeiro nome sozinho não serve para cobrar", () => {
  const { dados } = lerFichaDeInternacao("Paciente: MARIA\n");
  assert.equal(dados.paciente, undefined);
});

test("linha colada com a seguinte não vira nome", () => {
  const longo = "Paciente: " + "PALAVRA ".repeat(20);
  const { dados } = lerFichaDeInternacao(longo);
  assert.equal(dados.paciente, undefined);
});

test("ficha ilegível não devolve nada — e diz o que faltou", () => {
  const { dados, naoEncontrados } = lerFichaDeInternacao("|||| ### ~~~ 8888\n");
  assert.deepEqual(dados, {});
  assert.deepEqual(naoEncontrados.sort(), ["convenio", "paciente", "procedimento"]);
});

test("texto vazio não quebra", () => {
  assert.deepEqual(lerFichaDeInternacao("").dados, {});
  assert.deepEqual(lerFichaDeInternacao("   \n\n  ").dados, {});
});

test("acento e caixa não atrapalham o rótulo", () => {
  const { dados } = lerFichaDeInternacao(`
convênio: Unimed Regional
Procedimento Proposto: Artroplastia total de joelho
`);
  assert.equal(dados.convenio, "Unimed Regional");
  assert.equal(dados.procedimento, "Artroplastia total de joelho");
});

test("o primeiro valor plausível vence a repetição do rodapé", () => {
  const { dados } = lerFichaDeInternacao(`
Paciente: RITA DE CASSIA LOPES
...
Paciente: SEGUNDA VIA DO DOCUMENTO
`);
  assert.equal(dados.paciente, "RITA DE CASSIA LOPES");
});

test("convênio longo demais é frase, não operadora", () => {
  const { dados } = lerFichaDeInternacao(
    "Convenio: o paciente declarou que possui plano de saude porem nao apresentou a carteirinha hoje\n");
  assert.equal(dados.convenio, undefined);
});

test("pareceNome aceita nome composto e recusa rótulo", () => {
  assert.equal(pareceNome("MARIA APARECIDA DOS SANTOS"), true);
  assert.equal(pareceNome("José D'Ávila Sá"), true);
  assert.equal(pareceNome("Ana-Clara Nogueira"), true);
  assert.equal(pareceNome("DATA DE NASCIMENTO"), false);
  assert.equal(pareceNome("Paciente"), false);
  assert.equal(pareceNome("LEITO 214"), false);
  assert.equal(pareceNome(""), false);
});

// ---------------------------------------------------------------------------
// O que a foto de verdade entrega
//
// Estes casos vieram da ficha não sendo reconhecida no celular. Nenhum deles é
// hipótese de laboratório: são o jeito como o reconhecimento de uma foto de
// formulário impresso realmente sai.
// ---------------------------------------------------------------------------
test("duas colunas juntadas numa linha só", () => {
  // O caso mais comum e o que mais estragava: o reconhecimento junta a coluna
  // da esquerda com a da direita, e o campo inteiro era recusado por ter
  // dígito — a tela dizia que não reconheceu nada, tendo reconhecido tudo.
  const { dados } = lerFichaDeInternacao(`
Paciente: JOAO CARLOS PEREIRA  Data de nascimento: 12/03/1958
Convenio: UNIMED  Carteira: 0123456789
Procedimento: COLECISTECTOMIA VIDEOLAPAROSCOPICA
`);
  assert.equal(dados.paciente, "JOAO CARLOS PEREIRA");
  assert.equal(dados.convenio, "UNIMED");
  assert.equal(dados.procedimento, "COLECISTECTOMIA VIDEOLAPAROSCOPICA");
});

test("duas colunas sem os dois-pontos, que o OCR come", () => {
  const { dados } = lerFichaDeInternacao(`
PACIENTE MARIA APARECIDA DOS SANTOS  DATA DE NASCIMENTO 02/05/1970
CONVENIO BRADESCO SAUDE  MATRICULA 998877
`);
  assert.equal(dados.paciente, "MARIA APARECIDA DOS SANTOS");
  assert.equal(dados.convenio, "BRADESCO SAUDE");
});

test("borda de tabela colada na frente do rótulo", () => {
  // "|", "[" e "»" são o que a linha da tabela e o quadradinho de marcar
  // viram no reconhecimento. Sem tirá-los, a linha não começava com rótulo
  // nenhum e a ficha inteira passava batida.
  const { dados } = lerFichaDeInternacao(`
| Paciente: ANTONIO FERREIRA LIMA |
» Convenio: SUL AMERICA
[ Procedimento: HERNIORRAFIA INGUINAL
`);
  assert.equal(dados.paciente, "ANTONIO FERREIRA LIMA");
  assert.equal(dados.convenio, "SUL AMERICA");
  assert.equal(dados.procedimento, "HERNIORRAFIA INGUINAL");
});

test("rótulo no meio da linha só conta com dois-pontos", () => {
  // Com dois-pontos é coluna juntada, e o valor está ali. Sem eles, "nome" é
  // palavra comum de frase e devolveria pedaço de texto solto.
  const { dados } = lerFichaDeInternacao(
    "Guia 4471  Paciente: CARLA REGINA DUARTE\n");
  assert.equal(dados.paciente, "CARLA REGINA DUARTE");

  const solto = lerFichaDeInternacao(
    "O hospital registrou o nome completo na entrada da unidade\n");
  assert.equal(solto.dados.paciente, undefined);
});

test("espaço duplo dentro do rótulo não desloca o corte", () => {
  // O índice do rótulo é procurado no mesmo texto que vai ser recortado. Com
  // espaços juntados antes da busca, o nome saía uma letra fora do lugar.
  const { dados } = lerFichaDeInternacao("Nome  do  paciente:  PEDRO HENRIQUE ALVES\n");
  assert.equal(dados.paciente, "PEDRO HENRIQUE ALVES");
});

test("procedimento não é cortado por palavra comum", () => {
  // O corte agressivo vale para nome e convênio. No procedimento ele comeria
  // descrição legítima: "hospital" e "clinica" são rótulos de ficha e também
  // palavras de cirurgia.
  const { dados } = lerFichaDeInternacao(
    "Procedimento: SEDACAO PARA ENDOSCOPIA EM HOSPITAL DIA\n");
  assert.equal(dados.procedimento, "SEDACAO PARA ENDOSCOPIA EM HOSPITAL DIA");
});

test("o corte nunca fabrica nome a partir de rótulo", () => {
  // "DATA DE NASCIMENTO: 02/05/1970" cortado no próximo rótulo vira "DATA DE"
  // — duas palavras, sem dígito, com cara de nome de gente.
  assert.equal(cortarNoProximoRotulo("DATA DE NASCIMENTO 02/05/1970", true), "DATA DE");
  const { dados } = lerFichaDeInternacao("PACIENTE:\nDATA DE NASCIMENTO 02/05/1970\n");
  assert.equal(dados.paciente, undefined);
});

test("rótulo vizinho lido errado ainda corta pelos dois-pontos", () => {
  // Saiu assim de uma foto com sombra: "Carteira" virou "“ca rteira". O corte
  // por nome não reconhece o rótulo deformado, mas os dois-pontos sobrevivem —
  // e nome de pessoa e de operadora nunca os contêm.
  const { dados } = lerFichaDeInternacao(
    "Convenio: UNIMED CAMPO MOURAO “ca rteira: 012\n");
  assert.equal(dados.convenio, "UNIMED CAMPO MOURAO");
});

test("o corte não come sinal legítimo de razão social", () => {
  // "S/A" é curto, mas a barra pertence ao nome. Só sai cotoco com sinal que
  // não pertence a nome nenhum.
  const { dados } = lerFichaDeInternacao("Convenio: BRADESCO SAUDE S/A\n");
  assert.equal(dados.convenio, "BRADESCO SAUDE S/A");
});

// ---------------------------------------------------------------------------
// O laudo de AIH do SUS
//
// Texto real, saído do celular do anestesiologista sobre um laudo da Santa
// Casa. É o formulário de toda cirurgia pelo SUS no país, e ele quebra as
// regras que valiam até aqui — por isso tem tratamento próprio.
// ---------------------------------------------------------------------------
const LAUDO_SUS = `SUS dncsda de TE LAUDO PARA SOLICITAÇÃO DE AUTORIZAÇÃO DE ”
| Saúde — Saúde INTERNAÇÃO HOSPITALAR
1 - NOME DO ESTABELECIMENTO SOLICITANTE Frio K :
HOSPITAL SANTA CASA DE MISERICORDIA (CAMPO MOURAO/PR) 0014109 E
3 - NOME DO ESTABELECIMENTO EXECUTANTE TEN D= ;
HOSPITAL SANTA CASA DE MISERICORDIA (CAMPO MOURAO/PR) 0014109 E
Nº SOLICITAÇÃO Nº INTERNAMENTO. Nº LAUDO Nº RESERVA A
Cirurgia Eletiva: 4.022.875 FR.
bos Sdl 6. Nº PRONTUÁRIO EE
MARTINA SIQUEIRA BRAGA 4.407.256 CAE,
11 - NOME DA MÃE OU RESPONSÁVEL DDO 12. Nº TELEFONE DE CONTATO Pee Cd A, =
ALINE DE OLIVEIRA SIQUEIRA 44 98429-3415 EAbA£A
25 - DESCRIÇÃO DO PROCEDIMENTO 26 - CÓDIGO DO PROCEDIMENTO
[HERNIOPLASTIA INGUINAL / CRURAL (UNILATERAL) 04.07.04.010-2
27 - CUNICA - CARATER DA INTERNAÇÃO 29: DOCUMENTO
Cirurgia Geral Eletivo ( )ens (X)crF 069.830.716-03
31 - NOME DO PROFISSIONAL RESPONSÁVEL 32 - DATA DA SOLICITAÇÃO
IWANDERLISTER DUQUE TAVARES | 18/06/2026
44 - NOME DO PROFISSIONAL AUTORIZADOR 45: COD. ORGÃO EMISSOR
[EDUARDO BUENO SAMPAIO. ] 71
`;

test("laudo do SUS: os três campos, do texto que saiu do celular", () => {
  const { dados, naoEncontrados } = lerFichaDeInternacao(LAUDO_SUS);
  assert.equal(dados.paciente, "MARTINA SIQUEIRA BRAGA");
  assert.equal(dados.procedimento, "HERNIOPLASTIA INGUINAL / CRURAL (UNILATERAL)");
  assert.equal(dados.convenio, "SUS");
  assert.deepEqual(naoEncontrados, []);
});

test("laudo do SUS: a mãe da paciente não é a paciente", () => {
  // "nome" casa dentro de "NOME DA MÃE OU RESPONSÁVEL", e o corte devolvia
  // "DA MÃE OU" — três palavras, sem dígito, aceito como nome de gente.
  const { dados } = lerFichaDeInternacao(LAUDO_SUS);
  assert.notEqual(dados.paciente, "DA MÃE OU");
  assert.notEqual(dados.paciente, "ALINE DE OLIVEIRA SIQUEIRA");
});

test("laudo do SUS: o cirurgião e o autorizador não viram paciente", () => {
  const { dados } = lerFichaDeInternacao(LAUDO_SUS);
  assert.notEqual(dados.paciente, "WANDERLISTER DUQUE TAVARES");
  assert.notEqual(dados.paciente, "EDUARDO BUENO SAMPAIO");
  assert.notEqual(dados.paciente, "HOSPITAL SANTA CASA DE MISERICORDIA");
});

test("laudo do SUS: o número da solicitação não vira cirurgia", () => {
  // "Cirurgia Eletiva: 4.022.875" aparece no topo e é o número do laudo. Pela
  // ordem de leitura ele ganhava; pela especificidade, o campo 25 ganha.
  const { dados } = lerFichaDeInternacao(LAUDO_SUS);
  assert.notEqual(dados.procedimento, "Eletiva: 4.022.875 FR.");
  assert.notEqual(dados.procedimento, "26 - CÓDIGO DO PROCEDIMENTO");
});

test("SUS só entra quando o documento é o laudo", () => {
  // Fora do laudo, convênio em branco continua em branco: inventar pagador é
  // o erro que cobra do lugar errado.
  const { dados } = lerFichaDeInternacao("Paciente: CARLA REGINA DUARTE\n");
  assert.equal(dados.convenio, undefined);
});

// ---------------------------------------------------------------------------
// A guia TISS de solicitação de internação
// ---------------------------------------------------------------------------
// O texto abaixo é o que o reconhecimento devolveu de uma guia real da Unimed
// Campo Mourão, fotografada pelo Gustavo. Ela quebrou o leitor de dois jeitos
// ao mesmo tempo, e por isso vira teste.
const GUIA_TISS = `Unimed Campo Mourao
GUIA DE SOLICITACAO DE INTERNACAO
1 - Registro ANS 306100   2 - No Guia no Prestador   3 - Numero da Guia Atribuido pela Operadora
4 - Data da Autorizacao 26/08/2026   5 - Senha   6 - Data de Validade da Senha
Dados do Beneficiario
7 - Numero da Carteira 0183000000127160   8 - Validade da Carteira 01/05/2027
9 - Atendimento a RN N
10 - Nome IVETE SOUZA VEIGA MENEZES
11 - Cartao Nacional de Saude
Dados do Contratado Solicitante
12 - Codigo na Operadora 88161
13 - Nome do Contratado EDSON LUIZ MICHALKIEWICZ
14 - Nome do Profissional Solicitante EDSON LUIZ MICHALKIEWICZ
15 - Conselho Profissional 06   16 - Numero no Conselho 012328
20 - Nome do Hospital/Local Solicitado EDSON LUIZ MICHALKIEWICZ`;

test("guia TISS: o paciente é o campo 10, e não o nome do médico", () => {
  // O erro que esta guia produzia: ela tem cinco campos "Nome" e o primeiro
  // que aparecia com rótulo conhecido era o do contratado. A produção do mês
  // saía com o nome do cirurgião no lugar do doente — e a cobrança ia junto.
  const { dados } = lerFichaDeInternacao(GUIA_TISS);
  assert.equal(dados.paciente, "IVETE SOUZA VEIGA MENEZES");
});

test("guia TISS: a operadora vem da marca quando não há campo de convênio", () => {
  // A guia não tem campo "Convênio": a operadora está no logotipo e no
  // cabeçalho. Devolver vazio obrigaria a digitar "Unimed" em toda guia.
  const { dados } = lerFichaDeInternacao(GUIA_TISS);
  assert.equal(dados.convenio, "Unimed");
});

test("rótulo explícito ganha da marca solta", () => {
  // Guia impressa em papel da Unimed que cobre um paciente de outro convênio:
  // o campo rotulado manda, senão o paciente sairia na operadora errada.
  const { dados } = lerFichaDeInternacao(
    "Unimed Campo Mourao\n10 - Nome MARIA DA SILVA\nConvenio: Bradesco Saude");
  assert.equal(dados.convenio, "Bradesco Saude");
});

test("o modelo da ficha é reconhecido e devolvido", () => {
  // Cada hospital usa um formulário diferente, e o mesmo rótulo muda de dono de
  // um para outro. Saber QUAL ficha é vem antes de procurar campo nela.
  assert.equal(lerFichaDeInternacao(GUIA_TISS).modelo?.nome,
    "Guia TISS de solicitação de internação");
  assert.equal(
    lerFichaDeInternacao("LAUDO PARA SOLICITACAO DE AUTORIZACAO DE INTERNACAO HOSPITALAR").modelo?.nome,
    "Laudo de AIH do SUS");
  // Ficha que ele ainda não conhece não quebra: cai na busca genérica.
  const solta = lerFichaDeInternacao("Paciente: JOAO DA SILVA\nConvenio: Amil");
  assert.equal(solta.modelo, null);
  assert.equal(solta.dados.paciente, "JOAO DA SILVA");
  assert.equal(solta.dados.convenio, "Amil");
});

test("o laudo do SUS responde o convênio por existir", () => {
  // Paciente com convênio ou particular não entra por AIH. Cobrar como
  // particular um caso do SUS é o erro mais caro que esta tela produz.
  const { dados } = lerFichaDeInternacao(
    "LAUDO PARA SOLICITACAO DE AUTORIZACAO DE INTERNACAO HOSPITALAR\nNome: MARIA SOUZA");
  assert.equal(dados.convenio, "SUS");
});
