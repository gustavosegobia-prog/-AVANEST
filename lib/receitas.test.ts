import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dePlantao, deProducao, deConsulta, doMes, idadeDaReceita, minhaFatia, paraRecebivel,
  porOrigem, porProfissional, somar, somarComAtraso, type Receita,
} from "./receitas.ts";

const ANA = "11111111-1111-1111-1111-111111111111";
const BRUNO = "22222222-2222-2222-2222-222222222222";
const NOMES = new Map([[ANA, "Dra. Ana"], [BRUNO, "Dr. Bruno"]]);

describe("a consulta pré-anestésica vira receita", () => {
  const base = {
    id: "c1", convenio: "Unimed", valor: 300, recebido: 120,
    status: "aguardando", medico_id: ANA, created_at: "2026-08-14T10:00:00Z",
  };

  it("traz valor, recebido e dono", () => {
    const r = deConsulta(base, "Cassilda")!;
    assert.equal(r.origem, "consulta");
    assert.equal(r.valor, 300);
    assert.equal(r.recebido, 120);
    assert.equal(r.donoId, ANA);
    assert.equal(r.pagador, "Unimed");
    assert.equal(r.descricao, "Cassilda");
  });

  it("a competência declarada manda sobre o mês do lançamento", () => {
    // O financeiro fecha por mês de ATENDIMENTO: um lançamento criado em
    // setembro para uma consulta de agosto pertence a agosto.
    const r = deConsulta({ ...base, periodo: "2026-07", created_at: "2026-09-02T10:00:00Z" })!;
    assert.equal(r.competencia, "2026-07");
  });

  it("cancelado não é receita", () => {
    assert.equal(deConsulta({ ...base, status: "cancelado" }), null);
  });
});

describe("a produção anestésica vira receita", () => {
  const base = {
    id: "p1", perfil_id: BRUNO, data: "2026-08-14", paciente: "José",
    convenio: "Particular", valor: 800, situacao: "a_cobrar",
  };

  it("anotada e ainda não cobrada: valor cheio, recebido zero", () => {
    const r = deProducao(base)!;
    assert.equal(r.valor, 800);
    assert.equal(r.recebido, 0);
    assert.equal(r.donoId, BRUNO);
  });

  it("recebida conta como recebida", () => {
    assert.equal(deProducao({ ...base, situacao: "recebido" })!.recebido, 800);
  });

  it("faturada ainda não é dinheiro na conta", () => {
    assert.equal(deProducao({ ...base, situacao: "faturado" })!.recebido, 0);
  });

  it("glosada FICA na receita, com recebido zero", () => {
    // É dinheiro que se está tentando recuperar. Tirá-lo esconderia a perda.
    const r = deProducao({ ...base, situacao: "glosado" })!;
    assert.equal(r.valor, 800);
    assert.equal(r.recebido, 0);
  });

  it("junta procedimento ao nome quando há", () => {
    assert.equal(deProducao({ ...base, procedimento: "Colecistectomia" })!.descricao,
      "José — Colecistectomia");
  });
});

describe("o plantão vira receita", () => {
  const base = {
    id: "t1", perfil_id: ANA, data: "2026-08-01", valor: 2000,
    situacao: "realizado", local_texto: "FUNDHOSPAR",
  };

  it("realizado é trabalho feito e ainda não pago", () => {
    const r = dePlantao(base)!;
    assert.equal(r.valor, 2000);
    assert.equal(r.recebido, 0);
    assert.equal(r.pagador, "FUNDHOSPAR");
    assert.equal(r.descricao, "Plantão — FUNDHOSPAR");
  });

  it("pago conta como recebido", () => {
    assert.equal(dePlantao({ ...base, situacao: "pago" })!.recebido, 2000);
  });

  it("ESCALADO não entra: ainda não aconteceu", () => {
    // Contar o mês inteiro da escala como faturamento no dia 1º daria um número
    // que se desfaz a cada cancelamento.
    assert.equal(dePlantao({ ...base, situacao: "escalado" }), null);
  });

  it("cancelado não entra", () => {
    assert.equal(dePlantao({ ...base, situacao: "cancelado" }), null);
  });

  it("o nome do local cadastrado tem preferência sobre o texto livre", () => {
    const r = dePlantao({ ...base, local_nome: "Santa Casa", local_texto: "FUNDHOSPAR" })!;
    assert.equal(r.pagador, "Santa Casa");
  });
});

// ── As somas ────────────────────────────────────────────────────────────────

const receitas: Receita[] = [
  deConsulta({ id: "c1", convenio: "Unimed", valor: 300, recebido: 300,
    status: "pago", medico_id: ANA, periodo: "2026-08", created_at: "2026-08-02T10:00:00Z" })!,
  deProducao({ id: "p1", perfil_id: ANA, data: "2026-08-10", paciente: "José",
    convenio: "Particular", valor: 800, situacao: "a_cobrar" })!,
  dePlantao({ id: "t1", perfil_id: BRUNO, data: "2026-08-01", valor: 2000,
    situacao: "realizado", local_texto: "FUNDHOSPAR" })!,
  dePlantao({ id: "t2", perfil_id: BRUNO, data: "2026-07-15", valor: 1500,
    situacao: "pago", local_texto: "Santa Casa" })!,
];

describe("somas", () => {
  it("o total junta as três fontes", () => {
    const s = somar(receitas);
    assert.equal(s.valor, 300 + 800 + 2000 + 1500);
    assert.equal(s.recebido, 300 + 1500);
    assert.equal(s.aReceber, 800 + 2000);
    assert.equal(s.linhas, 4);
  });

  it("filtra por competência", () => {
    assert.equal(doMes(receitas, "2026-08").length, 3);
    assert.equal(doMes(receitas, "2026-07").length, 1);
  });

  it("lista vazia devolve zeros, não NaN", () => {
    assert.deepEqual(somar([]), { valor: 0, recebido: 0, aReceber: 0, linhas: 0 });
  });
});

describe("por origem", () => {
  const linhas = porOrigem(doMes(receitas, "2026-08"));

  it("mostra SEMPRE as três, mesmo zeradas", () => {
    // Origem que some da tabela vira pergunta ("cadê os plantões?") em vez de
    // resposta ("os plantões deram zero").
    assert.deepEqual(linhas.map((l) => l.origem), ["consulta", "producao", "plantao"]);
    const semNada = porOrigem([]);
    assert.equal(semNada.length, 3);
    assert.equal(semNada.every((l) => l.valor === 0), true);
  });

  it("soma cada fonte separada", () => {
    const [consulta, producao, plantao] = linhas;
    assert.equal(consulta.valor, 300);
    assert.equal(producao.valor, 800);
    assert.equal(plantao.valor, 2000);
  });

  it("a soma das origens bate com o total", () => {
    // Se um dia uma origem nova entrar e alguém esquecer de somá-la, é aqui
    // que aparece.
    const total = somar(doMes(receitas, "2026-08"));
    assert.equal(linhas.reduce((s, l) => s + l.valor, 0), total.valor);
    assert.equal(linhas.reduce((s, l) => s + l.recebido, 0), total.recebido);
  });
});

describe("por profissional — cada um leva o que produziu", () => {
  const fatias = porProfissional(receitas, NOMES);

  it("separa por dono e ordena pelo maior", () => {
    assert.deepEqual(fatias.map((f) => f.nome), ["Dr. Bruno", "Dra. Ana"]);
    assert.equal(fatias[0].valor, 2000 + 1500);
    assert.equal(fatias[1].valor, 300 + 800);
  });

  it("o plantão é de quem plantonou, a consulta de quem avaliou", () => {
    const ana = fatias.find((f) => f.donoId === ANA)!;
    assert.equal(ana.recebido, 300);
    assert.equal(ana.aReceber, 800);
  });

  it("a soma das fatias bate com o total do grupo", () => {
    const total = somar(receitas);
    assert.equal(fatias.reduce((s, f) => s + f.valor, 0), total.valor);
    assert.equal(fatias.reduce((s, f) => s + f.aReceber, 0), total.aReceber);
  });

  it("receita sem dono vira linha própria em vez de sumir", () => {
    // Lançamentos antigos, de antes de o sistema guardar quem atendeu. Somem no
    // silêncio e o total da tela deixa de bater com o do grupo.
    const comOrfa = [...receitas, deConsulta({ id: "c9", convenio: "SUS", valor: 250,
      recebido: 0, status: "aguardando", created_at: "2026-08-20T10:00:00Z" })!];
    const linhas = porProfissional(comOrfa, NOMES);
    const orfa = linhas.find((l) => l.donoId === null);
    assert.ok(orfa, "a linha sem dono tem de existir");
    assert.equal(orfa.valor, 250);
    assert.equal(linhas.reduce((s, l) => s + l.valor, 0), somar(comOrfa).valor);
  });

  it("dono sem nome conhecido não quebra a tabela", () => {
    const linhas = porProfissional(receitas, new Map());
    assert.equal(linhas.every((l) => l.nome.length > 0), true);
  });
});

describe("tradução para os indicadores de recebível", () => {
  it("a consulta leva emissão e vencimento", () => {
    const r = deConsulta({ id: "c1", convenio: "Unimed", valor: 300, recebido: 0,
      status: "aguardando", created_at: "2026-08-02T10:00:00Z",
      nota_emitida_at: "2026-08-05", nota_vencimento_at: "2026-09-05" })!;
    const rec = paraRecebivel(r);
    assert.equal(rec.nota_emitida_at, "2026-08-05");
    assert.equal(rec.nota_vencimento_at, "2026-09-05");
  });

  it("plantão e produção vêm sem nota, e a idade conta da data do atendimento", () => {
    // É a data em que o serviço foi prestado, que é quando o dinheiro passou a
    // ser devido.
    const rec = paraRecebivel(dePlantao({ id: "t1", perfil_id: ANA,
      data: "2026-08-01", valor: 2000, situacao: "realizado" })!);
    assert.equal(rec.nota_vencimento_at, null);
    assert.equal(rec.created_at.slice(0, 10), "2026-08-01");
  });

  it("o pagador vira o 'convênio' que agrupa o envelhecimento", () => {
    // No plantão o pagador é o hospital: é ele que deve, e é por ele que a
    // cobrança se organiza.
    const rec = paraRecebivel(dePlantao({ id: "t1", perfil_id: ANA,
      data: "2026-08-01", valor: 2000, situacao: "realizado",
      local_texto: "FUNDHOSPAR" })!);
    assert.equal(rec.convenio, "FUNDHOSPAR");
  });

  it("nunca marca plantão como glosa", () => {
    // Glosa é estado da cobrança da consulta. Marcar plantão assim daria uma
    // taxa de glosa que não existe.
    const rec = paraRecebivel(dePlantao({ id: "t1", perfil_id: ANA,
      data: "2026-08-01", valor: 2000, situacao: "realizado" })!);
    assert.equal(rec.status, "aguardando");
  });

  it("preserva valor e recebido", () => {
    const rec = paraRecebivel(deProducao({ id: "p1", perfil_id: BRUNO,
      data: "2026-08-10", paciente: "José", convenio: "Particular",
      valor: 800, situacao: "recebido" })!);
    assert.equal(rec.valor, 800);
    assert.equal(rec.recebido, 800);
  });
});

describe("minha fatia", () => {
  it("devolve só o que é da pessoa", () => {
    const minha = minhaFatia(receitas, ANA);
    assert.equal(minha.valor, 1100);
    assert.equal(minha.linhas, 2);
  });

  it("quem não produziu nada recebe zeros", () => {
    assert.equal(minhaFatia(receitas, "outro").valor, 0);
  });
});

describe("o que está a receber há tempo demais", () => {
  const receita = (id: string, data: string, valor: number, recebido: number,
                   vencimento: string | null = null): Receita => ({
    id, origem: "plantao", data, competencia: data.slice(0, 7), donoId: ANA,
    descricao: "Plantão", pagador: "Hospital", valor, recebido, vencimento,
  });
  const HOJE = "2026-09-05";

  it("conta a idade do vencimento quando ele existe", () => {
    // Só a consulta tem nota. Onde há vencimento é ele que manda; onde não há,
    // vale o dia do trabalho, que é o único marco que existe.
    assert.equal(idadeDaReceita(receita("a", "2026-07-01", 100, 0), HOJE), 66);
    assert.equal(idadeDaReceita(receita("b", "2026-07-01", 100, 0, "2026-08-30"), HOJE), 6);
  });

  it("separa o que ainda está no prazo do que já passou", () => {
    // O plantão do mês passado que não caiu é normal; o de abril que não caiu é
    // um telefonema a dar. Somados no mesmo número, o segundo desaparece.
    const soma = somarComAtraso([
      receita("a", "2026-08-20", 1000, 0),   // 16 dias — no prazo
      receita("b", "2026-04-10", 2000, 0),   // 148 dias — atrasado
      receita("c", "2026-03-01", 500, 500),  // velho, mas já recebido
    ], HOJE);
    assert.equal(soma.aReceber, 3000);
    assert.equal(soma.noPrazo, 1000);
    assert.equal(soma.atrasado, 2000);
    assert.equal(soma.recebido, 500);
  });

  it("o recebido em parte só atrasa o que sobrou", () => {
    const soma = somarComAtraso([receita("a", "2026-04-10", 2000, 1500)], HOJE);
    assert.equal(soma.atrasado, 500);
    assert.equal(soma.noPrazo, 0);
  });

  it("no prazo mais atrasado é sempre o total a receber", () => {
    // A conta não pode perder nem inventar dinheiro no caminho: é a mesma soma
    // de sempre, só partida em duas.
    const linhas = [
      receita("a", "2026-08-20", 1000, 0), receita("b", "2026-04-10", 2000, 300),
      receita("c", "2026-09-01", 700, 700), receita("d", "2026-06-30", 900, 0),
    ];
    const soma = somarComAtraso(linhas, HOJE);
    assert.equal(soma.noPrazo + soma.atrasado, soma.aReceber);
    assert.equal(soma.valor, somar(linhas).valor);
  });

  it("o corte é o mesmo do envelhecimento do grupo: 60 dias", () => {
    // Duas réguas para a mesma pergunta fariam a tela pessoal e a do serviço
    // discordarem sobre o mesmo atraso.
    const naLinha = somarComAtraso([receita("a", "2026-07-07", 100, 0)], HOJE); // 60 dias
    assert.equal(naLinha.atrasado, 0, "60 dias ainda é no prazo");
    const umDiaDepois = somarComAtraso([receita("a", "2026-07-06", 100, 0)], HOJE); // 61
    assert.equal(umDiaDepois.atrasado, 100);
  });
});
