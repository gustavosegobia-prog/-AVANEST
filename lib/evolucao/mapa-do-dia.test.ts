import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cabecalhoInicial } from "./importar.ts";
import {
  cadastroDoMapa, comparacaoDoParecido, doMapaParaAFicha, idadeDoCadastro, ordenarMapaDaFicha, type CasoDoMapaNaFicha,
} from "./mapa-do-dia.ts";

const ler = (c: string) => fs.readFileSync(new URL(`../../${c}`, import.meta.url), "utf8");

const caso = (x: Partial<CasoDoMapaNaFicha>): CasoDoMapaNaFicha => ({
  id: "c1", data: "2026-11-06", horario: "07:30", ordem: 1, sala: "Sala 1", paciente: "PACIENTE FICTICIO",
  idade: 52, nascimento: null, procedimento: "COLECISTECTOMIA VIDEOLAPAROSCOPICA", cirurgiao: "DR. CIRURGIAO FICTICIO", convenio: "SUS",
  anestesista: "Dra. Ficticia", meu: false, etapa: "agendado", patientId: null, ficha: null, ...x,
});

test("mapa na ficha: os do anestesista logado primeiro, depois a ordem do mapa; cancelado some", () => {
  const lista = ordenarMapaDaFicha([
    caso({ id: "a", ordem: 1, horario: "07:00" }),
    caso({ id: "b", ordem: 2, horario: "08:00", meu: true }),
    caso({ id: "c", ordem: 3, horario: null, meu: true }),
    caso({ id: "d", ordem: 4, etapa: "cancelado", meu: true }),
    caso({ id: "e", ordem: null, horario: "06:00" }),
  ]);
  assert.deepEqual(lista.map((c) => c.id), ["b", "c", "a", "e"]);
});

test("mapa na ficha: o que é do dia vem do mapa; o resto, da avaliação", () => {
  const paciente = { nome: "Paciente Fictício", data_nascimento: null, idade_anos: 52, sexo: "Masculino", convenio: "Unimed",
    hospital: null, cirurgia: "Hérnia", procedimento: null };
  const avaliacao = { id: "av1", dados: { cirurgia: "Herniorrafia (planejada em agosto)", peso: "80", altura: "175", asa: "2",
    data_cirurgia: "2026-08-10", cirurgiao: "Dr. Antigo" } };
  const comMapa = cabecalhoInicial(paciente, avaliacao, new Date("2026-11-06T10:00:00Z"), doMapaParaAFicha(caso({})));
  assert.equal(comMapa.data_procedimento, "2026-11-06");
  assert.equal(comMapa.sala, "Sala 1");
  assert.equal(comMapa.procedimento, "COLECISTECTOMIA VIDEOLAPAROSCOPICA");
  assert.equal(comMapa.cirurgiao, "DR. CIRURGIAO FICTICIO");
  assert.equal(comMapa.convenio, "SUS");
  assert.equal(comMapa.peso_kg, 80, "o que é do paciente continua vindo da avaliação");
  assert.equal(comMapa.asa, "II");
  // Campo vazio no mapa não apaga o da avaliação.
  const semCirurgiao = cabecalhoInicial(paciente, avaliacao, new Date("2026-11-06T10:00:00Z"), doMapaParaAFicha(caso({ cirurgiao: "" })));
  assert.equal(semCirurgiao.cirurgiao, "Dr. Antigo");
  // Sem mapa, nada muda no que já existia.
  const semMapa = cabecalhoInicial(paciente, avaliacao, new Date("2026-11-06T10:00:00Z"));
  assert.equal(semMapa.procedimento, "Herniorrafia (planejada em agosto)");
  assert.equal(semMapa.sala, "");
});

test("mapa na ficha: o cadastro de quem não tem cadastro leva só o que o mapa trouxe", () => {
  assert.deepEqual(cadastroDoMapa(caso({ paciente: "  JOSE FICTICIO ", idade: 70, convenio: "", procedimento: "RTU" })),
    { nome: "JOSE FICTICIO", data_nascimento: null, idade_anos: 70, convenio: null, cirurgia: "RTU" });
  assert.equal(cadastroDoMapa(caso({ nascimento: "1956-02-10" })).data_nascimento, "1956-02-10", "a data do mapa vai para o cadastro novo");
  assert.equal(cadastroDoMapa(caso({ idade: 140 })).idade_anos, null);
});

test("mapa na ficha: o parecido é descrito para o anestesista decidir, e a idade diferente é dita", () => {
  const hoje = "2026-11-06";
  assert.equal(idadeDoCadastro({ data_nascimento: "1974-11-07", idade_anos: null }, hoje), 51, "aniversário amanhã");
  assert.equal(idadeDoCadastro({ data_nascimento: null, idade_anos: 40 }, hoje), 40);

  const mesmo = comparacaoDoParecido({ paciente: "JOAO DA SILVA FICTICIO", idade: 52 },
    { nome: "João da Silva Fictício", data_nascimento: "1974-03-01", idade_anos: null }, hoje);
  assert.deepEqual([mesmo.mesmoNome, mesmo.idade, mesmo.texto], [true, "bate", "Mesmo nome · mesma idade"]);

  const homonimo = comparacaoDoParecido({ paciente: "JOAO DA SILVA FICTICIO", idade: 52 },
    { nome: "João da Silva Fictício", data_nascimento: null, idade_anos: 19 }, hoje);
  assert.equal(homonimo.idade, "nao_bate");
  assert.match(homonimo.texto, /idade diferente \(mapa: 52, cadastro: 19\)/);

  assert.equal(comparacaoDoParecido({ paciente: "JOAO SILVA", idade: null },
    { nome: "João da Silva", data_nascimento: null, idade_anos: 52 }, hoje).texto, "Nome parecido");
});

test("mapa por hospital: as telas do mapa filtram pelo hospital da sessão e gravam com ele", () => {
  for (const arquivo of ["app/centro-cirurgico/page.tsx", "app/centro-cirurgico/tv/page.tsx", "app/centro-cirurgico/relatorio/page.tsx"]) {
    const codigo = ler(arquivo);
    assert.match(codigo, /noHospital\(supabase\.from\("centro_casos"\)/, arquivo);
    assert.match(codigo, /noHospital\(supabase\.from\("centro_salas"\)/, arquivo);
  }
  for (const arquivo of ["components/centro/mapa-cirurgico.tsx", "components/centro/painel-tv.tsx"]) {
    assert.match(ler(arquivo), /noHospital\(sb\.from\("centro_casos"\)/, arquivo);
  }
  // Toda gravação de paciente ou sala do mapa leva o hospital.
  const janelas = ler("components/centro/janelas.tsx"), importar = ler("components/centro/importar.tsx");
  assert.match(janelas, /from\("centro_casos"\)\.insert\(\{ institution_id: institutionId, \.\.\.comHospital\(localId\)/);
  assert.match(janelas, /institution_id: institutionId, \.\.\.comHospital\(localId\), nome/);
  assert.equal((importar.match(/\.\.\.comHospital\(localId\)/g) ?? []).length, 2, "salas e pacientes importados");
});

test("mapa na ficha: a ligação é pelo banco, que só deixa quem pode ver a ficha", () => {
  const sql = ler("supabase/migrations/202611060001_mapa_por_hospital_na_ficha.sql");
  assert.match(sql, /function public\.ligar_caso_a_ficha\(p_caso uuid, p_evolucao uuid\)[\s\S]*security definer/);
  assert.match(sql, /public\.pode_ver_centro\(v_caso\.institution_id\)/);
  assert.match(sql, /public\.pode_evolucao\(v_ficha\.institution_id\)/);
  assert.match(sql, /set patient_id = v_ficha\.patient_id, evolucao_id = v_ficha\.id/, "só as duas colunas reservadas");
  // A busca dos parecidos roda com os direitos de quem chama.
  assert.match(sql, /function public\.pacientes_parecidos\(p_nome text\)[\s\S]*security invoker/);
  // O hospital tem de ser da mesma organização, no caso e na sala.
  assert.equal((sql.match(/raise exception 'O hospital não é desta organização\.'/g) ?? []).length, 2);
});

test("mapa na ficha: a linha só já mostra um cadastro quando não há dúvida", async () => {
  const { principalDoCaso } = await import("./mapa-do-dia.ts");
  const hoje = "2026-11-06";
  const cad = (id: string, nome: string, idade: number | null) => ({
    id, nome, data_nascimento: null, idade_anos: idade, sexo: null, convenio: null, hospital: null, cirurgia: null, procedimento: null,
    avaliacao: null, aberta: null, comparacao: comparacaoDoParecido({ paciente: "JOAO DA SILVA FICTICIO", idade: 52 }, { nome, data_nascimento: null, idade_anos: idade }, hoje),
  });
  const certo = cad("1", "João da Silva Fictício", 52);
  assert.equal(principalDoCaso({ patientId: null }, [certo, cad("2", "João Silva", 30)])?.id, "1");
  assert.equal(principalDoCaso({ patientId: null }, [certo, cad("3", "Joao da Silva Ficticio", null)]), null, "dois com o mesmo nome: escolhe");
  assert.equal(principalDoCaso({ patientId: null }, [cad("4", "João da Silva Fictício", 19)]), null, "idade que desmente: escolhe");
  assert.equal(principalDoCaso({ patientId: null }, [cad("5", "João Silva", 52)]), null, "só parecido: escolhe");
  assert.equal(principalDoCaso({ patientId: "4" }, [cad("4", "João da Silva Fictício", 19)])?.id, "4", "o ligado antes vale");
});

test("mapa por hospital: ligado (a migração 202611060001 já rodou), grava e filtra pelo hospital da sessão", async () => {
  const { MAPA_POR_HOSPITAL, comHospital, comNascimento, noHospital } = await import("../centro-cirurgico.ts");
  assert.equal(MAPA_POR_HOSPITAL, true);
  assert.deepEqual(comHospital("h1"), { local_atendimento_id: "h1" });
  assert.deepEqual(comHospital(null), { local_atendimento_id: null }, "sem hospital na sessão, vale em todos");
  assert.deepEqual(comNascimento("1974-03-01"), { data_nascimento: "1974-03-01" });
  assert.deepEqual(comNascimento(""), { data_nascimento: null });
  let filtro = "";
  const consulta = { or: (f: string) => { filtro = f; return consulta; } };
  noHospital(consulta as never, "h1");
  assert.equal(filtro, "local_atendimento_id.eq.h1,local_atendimento_id.is.null", "o deste hospital e o de antes de haver hospital");
  filtro = "";
  noHospital(consulta as never, null);
  assert.equal(filtro, "", "sem hospital na sessão, não filtra");
  // A chave continua no código, para desligar depressa se for preciso.
  assert.match(ler("app/evolucao/mapa-do-dia-servidor.ts"), /if \(!MAPA_POR_HOSPITAL\) return \[\];/);
});

test("trava da data de nascimento: com a data dos dois lados, só a mesma data mostra o cadastro sozinho", async () => {
  const { principalDoCaso } = await import("./mapa-do-dia.ts");
  const hoje = "2026-11-06";
  const mapa = { paciente: "JOAO DA SILVA FICTICIO", idade: 52, nascimento: "1974-03-01" };
  const cad = (id: string, nome: string, data_nascimento: string | null, idade_anos: number | null = null) => ({
    id, nome, data_nascimento, idade_anos, sexo: null, convenio: null, hospital: null, cirurgia: null, procedimento: null,
    avaliacao: null, aberta: null, comparacao: comparacaoDoParecido(mapa, { nome, data_nascimento, idade_anos }, hoje),
  });

  const mesma = cad("1", "João da Silva Fictício", "1974-03-01");
  assert.deepEqual([mesma.comparacao.nascimento, mesma.comparacao.texto], ["bate", "Mesmo nome · mesma data de nascimento"]);
  assert.equal(principalDoCaso({ patientId: null }, [mesma])?.id, "1");

  // Mesmo nome e mesma idade, mas outro dia de nascimento: é outra pessoa (ou erro de digitação). Nunca sozinho.
  const outroDia = cad("2", "João da Silva Fictício", "1974-03-02");
  assert.equal(outroDia.comparacao.nascimento, "nao_bate");
  assert.equal(outroDia.comparacao.texto, "Mesmo nome · data de nascimento diferente (mapa: 01/03/1974, cadastro: 02/03/1974)");
  assert.equal(principalDoCaso({ patientId: null }, [outroDia]), null);

  // O homônimo de data diferente não atrapalha o certo.
  assert.equal(principalDoCaso({ patientId: null }, [mesma, outroDia])?.id, "1");
  // Dois com a mesma data e o mesmo nome (cadastro duplicado): escolhe.
  assert.equal(principalDoCaso({ patientId: null }, [mesma, cad("3", "Joao da Silva Ficticio", "1974-03-01")]), null);
  // Um com a data certa e outro sem data nenhuma: nada desmente o segundo, então escolhe.
  assert.equal(principalDoCaso({ patientId: null }, [mesma, cad("4", "João da Silva Fictício", null)]), null);

  // Sem a data no cadastro, a idade decide — a do mapa, ou a da data do mapa.
  assert.equal(principalDoCaso({ patientId: null }, [cad("5", "João da Silva Fictício", null, 52)])?.id, "5");
  assert.equal(principalDoCaso({ patientId: null }, [cad("6", "João da Silva Fictício", null, 30)]), null);
  const soData = comparacaoDoParecido({ paciente: "JOAO DA SILVA FICTICIO", idade: null, nascimento: "1974-03-01" },
    { nome: "João da Silva Fictício", data_nascimento: null, idade_anos: 52 }, hoje);
  assert.deepEqual([soData.nascimento, soData.idade, soData.texto], ["sem_dado", "bate", "Mesmo nome · mesma idade"]);

  // Só o nome, sem data nem idade de nenhum lado: o anestesista confirma.
  const soNome = comparacaoDoParecido({ paciente: "JOAO DA SILVA FICTICIO", idade: null, nascimento: null },
    { nome: "João da Silva Fictício", data_nascimento: null, idade_anos: null }, hoje);
  assert.deepEqual([soNome.nascimento, soNome.idade, soNome.texto], ["sem_dado", "sem_dado", "Mesmo nome"]);
  assert.equal(principalDoCaso({ patientId: null }, [{ ...cad("7", "João da Silva Fictício", null), comparacao: soNome }]), null);
});

test("trava da data de nascimento: a coluna existe no banco e só é pedida com o mapa ligado", () => {
  const sql = ler("supabase/migrations/202611060001_mapa_por_hospital_na_ficha.sql");
  assert.match(sql, /alter table public\.centro_casos\s+add column if not exists data_nascimento date;/);
  assert.match(sql, /check \(data_nascimento is null or data_nascimento >= date '1890-01-01'\)/);
  assert.match(ler("lib/centro-cirurgico.ts"), /\+ \(MAPA_POR_HOSPITAL \? ", data_nascimento" : ""\)/);
  assert.match(ler("components/centro/importar.tsx"), /\.\.\.comNascimento\(l\.nascimento\)/);
  assert.match(ler("app/evolucao/mapa-do-dia-servidor.ts"), /nascimento: l\.data_nascimento \?\? null/);
});
