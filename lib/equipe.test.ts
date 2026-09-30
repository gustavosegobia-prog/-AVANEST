import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  areasEfetivas, concessoesLegadas, duplicidadesNaEquipe, estadoDoAcesso, estadoDoConvite,
  formatarCRM, indicadores, lerCRM, mostraRegistroMedico, pendencias, possiveisDuplicados,
  profissao, resumoDaMudanca, type ConviteDeLink, type Login, type Pessoa,
} from "./equipe.ts";

const p = (id: string, x: Partial<Pessoa> = {}): Pessoa => ({
  id, nome: id, email: `${id}@x.com`, role: "medico", status: "ativo", crm: null, rqe: null,
  permissoes: [], sem_acesso: false, na_escala: true, escalista: false, atuacao_medica: null, ...x,
});
const AGORA = "2026-09-30T12:00:00Z";
const confirmado: Login = { convidado_em: "2026-01-01T00:00:00Z", confirmado_em: "2026-01-02T00:00:00Z", ultimo_acesso: "2026-09-29T00:00:00Z" };

describe("profissão e função são coisas separadas", () => {
  it("médico que também é administrador continua médico", () => {
    const dono = p("dono", { role: "owner", crm: "60593/PR" });
    assert.equal(profissao(dono).tipo, "medico");
    assert.equal(profissao(p("adm", { role: "admin", atuacao_medica: true })).tipo, "medico");
    const ind = indicadores([dono, p("m1", { crm: "1/PR" }), p("rec", { role: "recepcao" })], null, [], AGORA);
    assert.equal(ind.medicos, 2);
    assert.equal(ind.medicosQueAdministram, 1);
  });

  it("não inventa profissão: gestor sem CRM fica 'não informada'", () => {
    assert.equal(profissao(p("g", { role: "admin" })).tipo, "nao_informada");
    assert.equal(profissao(p("r", { role: "recepcao" })).tipo, "nao_informada");
    assert.equal(profissao(p("x", { role: "recepcao", atuacao_medica: false })).tipo, "nao_medico");
  });

  it("CRM aparece para quem atua como médico — e para quem já tem CRM gravado", () => {
    assert.equal(mostraRegistroMedico(p("adm", { role: "admin", atuacao_medica: true })), true);
    assert.equal(mostraRegistroMedico(p("rec", { role: "recepcao" })), false);
    assert.equal(mostraRegistroMedico(p("rec", { role: "recepcao", crm: "123/SP" })), true,
      "esconder um CRM gravado seria o jeito de ele sumir sem ninguém ver");
  });
});

describe("CRM/UF", () => {
  it("lê as grafias comuns sem reescrever o dado", () => {
    for (const bruto of ["60593/PR", "CRM-PR 60.593", "60593 pr", "CRM/PR 060593"]) {
      assert.deepEqual(lerCRM(bruto), { numero: "60593", uf: "PR" }, bruto);
    }
    assert.equal(formatarCRM("60593/PR"), "CRM 60593/PR");
    assert.equal(formatarCRM("60593"), "CRM 60593 (UF não informada)");
    assert.equal(formatarCRM("pendente"), "pendente", "o que não dá para ler aparece como foi digitado");
  });
});

describe("acesso", () => {
  it("profissional sem conta: sem login, continua na equipe e sem áreas", () => {
    const s = p("s", { sem_acesso: true });
    assert.equal(estadoDoAcesso(s, null), "sem_conta");
    assert.deepEqual(areasEfetivas(s), []);
    assert.equal(indicadores([s], null, [], AGORA).profissionais, 1);
    assert.equal(indicadores([s], null, [], AGORA).acessoHabilitado, 0);
  });

  it("convite pendente só quando se sabe; desativado e pausado distintos", () => {
    assert.equal(estadoDoAcesso(p("a"), { convidado_em: "2026-09-01", confirmado_em: null, ultimo_acesso: null }), "convite_pendente");
    assert.equal(estadoDoAcesso(p("a"), null), "habilitado", "sem a leitura do login não se afirma convite pendente");
    assert.equal(estadoDoAcesso(p("a", { status: "inativo" }), confirmado), "desativado");
    assert.equal(estadoDoAcesso(p("a", { status: "inativo", pausada_motivo: "inatividade" }), confirmado), "pausado");
  });
});

describe("permissões efetivas", () => {
  it("pessoa com mais de uma área: a função e as extras somam", () => {
    const rec = p("rec", { role: "recepcao", permissoes: ["financeiro"] });
    const areas = areasEfetivas(rec);
    assert.deepEqual(areas.map((a) => a.id), ["pacientes", "financeiro"]);
    assert.equal(areas.find((a) => a.id === "financeiro")?.origem, "area_extra");
    assert.equal(areas.find((a) => a.id === "pacientes")?.origem, "funcao");
  });

  it("montar a escala segue o escalista, como pode_montar_escala()", () => {
    const adm = p("adm", { role: "admin" });
    const escala = (x: Pessoa, temEscalista: boolean) =>
      areasEfetivas(x, { temEscalista }).find((a) => a.id === "escala")!.niveis;
    assert.ok(escala(adm, false).includes("Administrar"));
    assert.ok(!escala(adm, true).includes("Administrar"));
    assert.ok(escala(p("e", { escalista: true }), true).includes("Administrar"));
    assert.ok(escala(p("dono", { role: "owner" }), true).includes("Administrar"));
  });

  it("módulo não contratado aparece marcado, não some nem é prometido", () => {
    const fin = areasEfetivas(p("f", { role: "financeiro" }), { modulos: ["medico", "plantoes"] })[0];
    assert.equal(fin.foraDoPlano, true);
  });

  it("concessões antigas aparecem, com o efeito verdadeiro", () => {
    const legado = concessoesLegadas(p("x", { permissoes: ["todos", "clinico", "financeiro"] }));
    assert.deepEqual(legado.map((c) => c.valor), ["todos", "clinico"]);
    assert.match(legado[1].efeito, /não tem efeito/);
  });
});

describe("resumo antes de salvar", () => {
  it("diz o que passa a permitir, o que deixa de permitir e onde vale", () => {
    const antes = p("r", { role: "recepcao" });
    const r = resumoDaMudanca(antes, { ...antes, permissoes: ["financeiro"] });
    assert.ok(r.passaAPermitir.includes("Financeiro: aprovar"));
    assert.deepEqual(r.deixaDePermitir, []);
    assert.match(r.escopo, /toda a organização/);
    assert.equal(r.temMudancaDeAcesso, true);
  });

  it("desativar mantém o histórico e diz isso", () => {
    const antes = p("m");
    const r = resumoDaMudanca(antes, { ...antes, status: "inativo" });
    assert.ok(r.deixaDePermitir.length > 0);
    assert.match(r.outras.join(" "), /histórico continuam/);
  });

  it("mudar só o nome não é mudança de acesso", () => {
    const antes = p("m");
    assert.equal(resumoDaMudanca(antes, { ...antes, nome: "Outro" }).temMudancaDeAcesso, false);
  });
});

describe("duplicidades", () => {
  it("acha por e-mail e por CRM/UF, sem mesclar", () => {
    const equipe = [p("a", { crm: "60593/PR" }), p("b", { crm: "CRM-PR 60.593", email: "b@y.com" }), p("c", { email: "A@x.com" })];
    const d = duplicidadesNaEquipe(equipe);
    assert.equal(d.find((x) => x.motivo === "crm")?.pessoas.length, 2);
    assert.equal(d.find((x) => x.motivo === "email")?.pessoas.length, 2);
    assert.equal(equipe.length, 3, "nenhum cadastro some");
  });

  it("CRM de UF diferente não é duplicado", () => {
    assert.equal(duplicidadesNaEquipe([p("a", { crm: "100/PR" }), p("b", { crm: "100/SP" })]).length, 0);
  });

  it("cadastro novo avisa sobre pessoa e convite existentes", () => {
    const convite: ConviteDeLink = { id: "c1", email: "novo@x.com", role: "medico", status: "pendente", expires_at: "2026-10-10", created_at: "2026-09-01" };
    const achados = possiveisDuplicados({ email: "NOVO@x.com" }, [p("a", { crm: "1/SP" })], [convite]);
    assert.equal(achados.length, 1);
    assert.ok(achados[0].convite);
    assert.equal(possiveisDuplicados({ crm: "1 sp" }, [p("a", { crm: "1/SP" })]).length, 1);
  });
});

describe("convites", () => {
  const c = (x: Partial<ConviteDeLink>): ConviteDeLink => ({ id: "c", email: "e@x.com", role: "medico", status: "pendente", expires_at: "2026-10-10T00:00:00Z", created_at: "2026-09-01", ...x });
  it("pendente, expirado, aceito e cancelado", () => {
    assert.equal(estadoDoConvite(c({}), AGORA), "pendente");
    assert.equal(estadoDoConvite(c({ expires_at: "2026-09-01T00:00:00Z" }), AGORA), "expirado");
    assert.equal(estadoDoConvite(c({ status: "aceito" }), AGORA), "aceito");
    assert.equal(estadoDoConvite(c({ status: "revogado" }), AGORA), "cancelado");
  });
});

describe("pendências", () => {
  const base = { logins: null, convites: [] as ConviteDeLink[], locaisCompartilhadosAtivos: 2, agora: AGORA };

  it("campo opcional vazio não é pendência", () => {
    assert.deepEqual(pendencias({ ...base, pessoas: [p("rec", { role: "recepcao", email: null, rqe: null })] }), []);
  });

  it("cada pendência tem motivo, evidência e ação", () => {
    const lista = pendencias({
      ...base,
      locaisCompartilhadosAtivos: 0,
      pessoas: [
        p("m"), // na escala, atua como médico, sem CRM
        p("g", { role: "owner" }), // na escala sem profissão
        p("l", { crm: "1/PR", permissoes: ["todos"] }),
        p("d1", { crm: "9/SP" }), p("d2", { crm: "9 sp" }),
      ],
      convites: [{ id: "c", email: "e@x.com", role: "medico", status: "pendente", expires_at: "2026-09-01T00:00:00Z", created_at: "2026-08-01" }],
    });
    const chaves = lista.map((x) => x.chave.split("-")[0]);
    for (const k of ["dup", "convite", "crm", "profissao", "legado", "sem"]) assert.ok(chaves.includes(k), k);
    for (const x of lista) {
      assert.ok(x.motivo && x.evidencia && x.acao.rotulo, x.chave);
    }
  });

  it("administrador sem uso há 90 dias pede revisão; convite parado pede reenvio", () => {
    const logins = new Map<string, Login>([
      ["a", { ...confirmado, ultimo_acesso: "2026-05-01T00:00:00Z" }],
      ["n", { convidado_em: "2026-09-01T00:00:00Z", confirmado_em: null, ultimo_acesso: null }],
    ]);
    const lista = pendencias({ ...base, logins, pessoas: [p("a", { role: "admin", crm: "5/PR" }), p("n", { crm: "6/PR" })] });
    assert.ok(lista.some((x) => x.chave === "admin-parado-a"));
    assert.ok(lista.some((x) => x.chave === "convite-parado-n" && x.acao.rotulo === "Reenviar convite"));
  });
});
