import test from "node:test";
import assert from "node:assert/strict";
import { acharProtocolo, buscar, itensDaCategoria, PREVISTOS, PROTOCOLOS } from "./catalogo.ts";
import { calcularDose, calcularVolume, conferirPaciente, doseServe, passosDe, populacaoDe, type PacienteDaConsulta } from "./calculo.ts";
import { acharReferencia, REFERENCIAS } from "./referencias.ts";
import { assinatura, resolverEstado, type RegistroDeRevisao } from "./situacao.ts";

const anafilaxia = acharProtocolo("anafilaxia")!;
const laringo = acharProtocolo("laringoespasmo")!;
const dose = (p: typeof anafilaxia, id: string) => p.medicamentos.find((m) => m.id === id)!;
const adulto: PacienteDaConsulta = { idadeAnos: 40, pesoKg: 70 };
const crianca: PacienteDaConsulta = { idadeAnos: 4, pesoKg: 16 };

test("todo protocolo tem as seis partes, e toda dose aponta para uma referência que existe", () => {
  for (const p of PROTOCOLOS) {
    for (const parte of ["reconhecer", "agirAgora", "pensarEm", "depois", "referencias"] as const) {
      assert.ok(p[parte].length > 0, `${p.id}: ${parte} vazio`);
    }
    assert.ok(p.medicamentos.length > 0, `${p.id}: sem medicamentos`);
    const ids = new Set<string>();
    for (const m of p.medicamentos) {
      assert.ok(!ids.has(m.id), `${p.id}: id repetido ${m.id}`);
      ids.add(m.id);
      assert.ok(m.referencias.length > 0, `${m.id}: dose sem referência`);
      for (const r of m.referencias) assert.ok(acharReferencia(r), `${m.id}: referência ${r} não existe`);
      // Sem concentração presumida: toda dose tem apresentação rotulada.
      assert.ok(m.apresentacoes.length > 0 && m.apresentacoes.every((a) => a.rotulo.trim()), `${m.id}: sem apresentação`);
      if (m.par) assert.ok(p.medicamentos.some((x) => x.id === m.par), `${m.id}: par ${m.par} não existe`);
    }
    for (const v of p.volumes) for (const r of v.referencias) assert.ok(acharReferencia(r), `${v.id}: ${r}`);
    for (const d of p.divergencias) {
      assert.ok(d.posicoes.length >= 2, `${p.id}: divergência com uma posição só`);
      for (const pos of d.posicoes) assert.ok(acharReferencia(pos.referencia), `${p.id}: ${pos.referencia}`);
    }
    for (const r of p.referencias) assert.ok(acharReferencia(r), `${p.id}: ${r}`);
  }
});

test("referência conferida tem onde está o número; sem localização, não está conferida", () => {
  for (const r of Object.values(REFERENCIAS)) {
    if (r.conferida) assert.ok(r.localizacao, `${r.id}: conferida sem localização`);
    if (r.doi) assert.match(r.doi, /^10\.\d{4,}\//, r.id);
  }
});

test("a faixa sai da idade: recém-nascido, criança até 12 anos, adulto ou gestante", () => {
  assert.equal(populacaoDe({ idadeAnos: 0.02, pesoKg: 3 }), "neonatal");
  assert.equal(populacaoDe({ idadeAnos: 11.9, pesoKg: 40 }), "pediatrico");
  assert.equal(populacaoDe({ idadeAnos: 12, pesoKg: 45 }), "adulto");
  assert.equal(populacaoDe({ idadeAnos: 28, pesoKg: 70, gestante: true }), "gestante");
  assert.equal(populacaoDe({ idadeAnos: null, pesoKg: 70 }), null);
  // Adrenalina IM da criança: por idade, com o corte dos 6 anos.
  const menor = dose(anafilaxia, "adrenalina-im-ped-menor-6");
  const maior = dose(anafilaxia, "adrenalina-im-ped-6-12");
  assert.equal(doseServe(menor, "pediatrico", 5.9), true);
  assert.equal(doseServe(menor, "pediatrico", 6), false);
  assert.equal(doseServe(maior, "pediatrico", 6), true);
  assert.equal(doseServe(dose(anafilaxia, "adrenalina-im-adulto"), "gestante", 30), true);
});

test("adrenalina no adulto: mcg na seringa diluída, e a ampola pura só no IM", () => {
  // 50–100 mcg na solução de 100 mcg/mL: 0,5 a 1 mL.
  const grave = calcularDose(dose(anafilaxia, "adrenalina-iv-grave-adulto"), anafilaxia, adulto, 0);
  assert.deepEqual(grave.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume, c.unidadeVolume]), [[50, "mcg", 0.5, "mL"], [100, "mcg", 1, "mL"]]);
  // A mesma dose na de 10 mcg/mL: 5 a 10 mL.
  assert.deepEqual(calcularDose(dose(anafilaxia, "adrenalina-iv-grave-adulto"), anafilaxia, adulto, 1).contas.map((c) => c.volume), [5, 10]);
  // IM: 500 mcg da ampola de 1 mg/mL = 0,5 mL (mcg convertido para mg uma vez só).
  const im = calcularDose(dose(anafilaxia, "adrenalina-im-adulto"), anafilaxia, adulto);
  assert.deepEqual(im.contas.map((c) => [c.doseTotal, c.volume]), [[500, 0.5]]);
  assert.ok(!im.alertas.some((a) => a.nivel === "perigo"));
  // Infusão: 3 a 40 mcg/min em 3 mg/50 mL (60 mcg/mL) = 3 a 40 mL/h, sem peso.
  const inf = calcularDose(dose(anafilaxia, "adrenalina-infusao-adulto"), anafilaxia, { idadeAnos: 40, pesoKg: null });
  assert.equal(inf.bloqueio, null);
  assert.deepEqual(inf.contas.map((c) => [c.volume, c.unidadeVolume]), [[3, "mL/h"], [40, "mL/h"]]);
});

test("criança: bolus por kg, infusão em mL/kg/h, PCR com teto de 1 mg", () => {
  // 2 mcg/kg × 16 kg = 32 mcg na solução de 20 mcg/mL = 1,6 mL.
  const mod = calcularDose(dose(anafilaxia, "adrenalina-iv-moderada-ped"), anafilaxia, crianca);
  assert.deepEqual(mod.contas.map((c) => [c.doseTotal, c.volume]), [[32, 1.6]]);
  // Infusão 0,1 mcg/kg/min = 0,3 mL/kg/h na de 20 mcg/mL: 4,8 mL/h para 16 kg.
  const inf = calcularDose(dose(anafilaxia, "adrenalina-infusao-ped"), anafilaxia, crianca);
  assert.deepEqual(inf.contas.map((c) => c.volume), [4.8, 96]);
  // PCR 10 mcg/kg na de 100 mcg/mL = 0,1 mL/kg; com 120 kg informado, o teto de 1 mg segura e avisa.
  const pcr = calcularDose(dose(anafilaxia, "adrenalina-pcr-ped"), anafilaxia, crianca);
  assert.deepEqual(pcr.contas.map((c) => [c.doseTotal, c.volume]), [[160, 1.6]]);
  const pesoErrado = calcularDose(dose(anafilaxia, "adrenalina-pcr-ped"), anafilaxia, { idadeAnos: 8, pesoKg: 120 });
  assert.deepEqual(pesoErrado.contas.map((c) => [c.doseTotal, c.unidadeDose, c.limitada]), [[1000, "mcg", true]]);
  assert.ok(pesoErrado.alertas.some((a) => a.nivel === "perigo" && /Limitada ao máximo de 1 mg/.test(a.texto)));
});

test("diluição por peso: noradrenalina 0,15 mg/kg em 50 mL dá 2 a 40 mL/h; vasopressina 1 UI/kg em 50 mL", () => {
  const nora = calcularDose(dose(anafilaxia, "noradrenalina-ped"), anafilaxia, crianca);
  assert.match(nora.apresentacao!.rotulo, /para 16 kg: 2,4 mg em 50 mL/);
  assert.deepEqual(nora.contas.map((c) => c.volume), [2, 40]);
  const vaso = calcularDose(dose(anafilaxia, "vasopressina-infusao-ped"), anafilaxia, crianca);
  assert.deepEqual(vaso.contas.map((c) => c.volume), [1, 3]);
  const bolus = calcularDose(dose(anafilaxia, "vasopressina-bolus-ped"), anafilaxia, crianca);
  assert.deepEqual(bolus.contas.map((c) => c.volume), [2]);
});

test("sem peso, sem conta: a dose por kg diz o que falta, a fixa calcula", () => {
  const sem: PacienteDaConsulta = { idadeAnos: 5, pesoKg: null };
  assert.equal(calcularDose(dose(anafilaxia, "adrenalina-iv-moderada-ped"), anafilaxia, sem).bloqueio, "Informe o peso para calcular.");
  assert.equal(calcularDose(dose(anafilaxia, "noradrenalina-ped"), anafilaxia, sem).contas.length, 0);
  assert.equal(calcularDose(dose(anafilaxia, "adrenalina-im-ped-menor-6"), anafilaxia, sem).contas[0].volume, 0.15);
  assert.equal(calcularVolume(anafilaxia.volumes.find((v) => v.id === "cristaloide-ped")!, sem).bloqueio, "Informe o peso para calcular.");
  assert.equal(calcularVolume(anafilaxia.volumes.find((v) => v.id === "cristaloide-ped")!, crianca).texto, "320 mL");
  assert.equal(calcularVolume(anafilaxia.volumes.find((v) => v.id === "cristaloide-refrataria-ped")!, crianca).texto, "320 a 640 mL");
});

test("unidade: magnésio em g convertido para a ampola em mg/mL; glucagon em mcg/kg com teto em mg", () => {
  const mg = calcularDose(dose(anafilaxia, "magnesio-adulto"), anafilaxia, adulto);
  assert.deepEqual(mg.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[2, "g", 4]]);
  // 50 mg/kg × 50 kg = 2,5 g → teto de 2 g (4 mL).
  const mgPed = calcularDose(dose(anafilaxia, "magnesio-ped"), anafilaxia, { idadeAnos: 11, pesoKg: 50 });
  assert.deepEqual(mgPed.contas.map((c) => [c.doseTotal, c.limitada, c.volume]), [[2000, true, 4]]);
  // Glucagon 40 mcg/kg × 30 kg = 1.200 mcg → teto de 1 mg.
  const glu = calcularDose(dose(anafilaxia, "glucagon-ped"), anafilaxia, { idadeAnos: 9, pesoKg: 30 });
  assert.deepEqual(glu.contas.map((c) => [c.doseTotal, c.unidadeDose, c.volume]), [[1000, "mcg", 1]]);
});

test("alertas: apresentação errada para a via, peso estranho para a idade, dose da criança acima da do adulto", () => {
  // Trocar a apresentação do IM por uma IV diluída de propósito: a tela avisa.
  const im = { ...dose(anafilaxia, "adrenalina-iv-grave-adulto"), apresentacoes: [dose(anafilaxia, "adrenalina-im-adulto").apresentacoes[0]] };
  const errada = calcularDose(im, anafilaxia, adulto);
  assert.equal(errada.alertas[0].nivel, "perigo");
  assert.match(errada.alertas[0].texto, /é para IM.*Confira antes de aspirar/);
  // 70 kg com 3 anos: digitação errada.
  assert.ok(conferirPaciente({ idadeAnos: 3, pesoKg: 70 }).some((a) => a.nivel === "perigo"));
  assert.deepEqual(conferirPaciente(adulto), []);
  assert.ok(conferirPaciente({ idadeAnos: 40, pesoKg: 70, alturaCm: 1.7 }).some((a) => /cm, não metros/.test(a.texto)));
  // Criança com peso de adulto: 10 mcg/kg × 45 kg = 450 mcg, acima dos 100 mcg do adulto.
  const grande = calcularDose(dose(anafilaxia, "adrenalina-iv-grave-ped"), anafilaxia, { idadeAnos: 11, pesoKg: 45 });
  assert.ok(grande.alertas.some((a) => /passa da dose do adulto \(100 mcg\)/.test(a.texto)));
  // Criança de 16 kg: 2 mcg/kg = 32 mcg passa os 20 mcg do adulto, e é o que a fonte manda — sem alarme falso.
  const pequena = calcularDose(dose(anafilaxia, "adrenalina-iv-moderada-ped"), anafilaxia, crianca);
  assert.ok(!pequena.alertas.some((a) => /dose do adulto/.test(a.texto)));
  // A diferença entre adulto e criança aparece no cartão.
  assert.ok(grande.alertas.some((a) => /No adulto: 50–100 mcg/.test(a.texto)));
  // Nome parecido.
  assert.ok(grande.alertas.some((a) => /noradrenalina/.test(a.texto)));
});

test("laringoespasmo: propofol e succinilcolina por kg, IM 4 mg/kg, atropina da criança com teto", () => {
  const prop = calcularDose(dose(laringo, "propofol-laringoespasmo"), laringo, crianca);
  assert.deepEqual(prop.contas.map((c) => [c.doseTotal, c.volume]), [[4, 0.4], [8, 0.8]]);
  const sux = calcularDose(dose(laringo, "succinilcolina-iv-laringoespasmo"), laringo, crianca);
  assert.deepEqual(sux.contas.map((c) => [c.doseTotal, c.volume]), [[4, 0.4], [8, 0.8]]);
  assert.ok(sux.dose.cuidados?.some((c) => /hipercalemia/.test(c)));
  const im = calcularDose(dose(laringo, "succinilcolina-im-laringoespasmo"), laringo, crianca);
  assert.deepEqual(im.contas.map((c) => [c.doseTotal, c.volume]), [[64, 1.28]]);
  // Atropina 0,02 mg/kg × 16 = 0,32 mg; com 40 kg, o teto de 0,5 mg.
  const atr = calcularDose(dose(laringo, "atropina-laringoespasmo-ped"), laringo, crianca);
  assert.deepEqual(atr.contas.map((c) => [c.doseTotal, c.volume]), [[0.32, 1.28]]);
  const atrGrande = calcularDose(dose(laringo, "atropina-laringoespasmo-ped"), laringo, { idadeAnos: 11, pesoKg: 40 });
  assert.equal(atrGrande.contas[0].doseTotal, 0.5);
  // Recém-nascido de 3 kg: a atropina dá 0,06 mg = 0,24 mL — mede; propofol 0,75 mg = 0,075 mL, avisa.
  const rn: PacienteDaConsulta = { idadeAnos: 0.02, pesoKg: 3 };
  const propRn = calcularDose(dose(laringo, "propofol-laringoespasmo"), laringo, rn);
  assert.ok(propRn.alertas.some((a) => /menor que 0,1 mL/.test(a.texto)));
});

test("passos da gestante só aparecem para ela; sem faixa, todos aparecem", () => {
  const gestante = passosDe(anafilaxia, "gestante").map((x) => x.texto).join(" ");
  assert.match(gestante, /deslocar o útero/);
  assert.doesNotMatch(passosDe(anafilaxia, "adulto").map((x) => x.texto).join(" "), /deslocar o útero/);
  assert.equal(passosDe(anafilaxia, null).length, anafilaxia.agirAgora.length);
  assert.match(passosDe(laringo, "pediatrico").map((x) => x.texto).join(" "), /Criança com bradicardia/);
});

test("busca pelo nome, pelo sinônimo e pelo sinal, sem acento; previstos aparecem como em preparação", () => {
  assert.equal((buscar("anafilaxia")[0] as { protocolo: { id: string } }).protocolo.id, "anafilaxia");
  assert.equal((buscar("choque anafilatico")[0] as { protocolo: { id: string } }).protocolo.id, "anafilaxia");
  const estridor = buscar("estridor");
  assert.equal(estridor[0].tipo === "protocolo" && estridor[0].protocolo.id, "laringoespasmo");
  assert.match(estridor[0].tipo === "protocolo" ? estridor[0].porque : "", /sinal|sinônimo/);
  assert.ok(buscar("urticaria").some((a) => a.tipo === "protocolo" && a.protocolo.id === "anafilaxia"));
  const hm = buscar("hipertermia");
  assert.ok(hm.some((a) => a.tipo === "previsto" && a.previsto.titulo === "Hipertermia maligna"));
  assert.deepEqual(buscar("  "), []);
  // O laringoespasmo pediátrico previsto é coberto pelo protocolo único.
  assert.ok(itensDaCategoria("pediatria").prontos.some((p) => p.id === "laringoespasmo"));
  assert.ok(!itensDaCategoria("pediatria").previstos.some((p) => p.titulo === "Laringoespasmo pediátrico"));
  assert.ok(!itensDaCategoria("respiratorio").previstos.some((p) => p.titulo === "Laringoespasmo"));
  assert.equal(PREVISTOS.filter((p) => p.categoria === "cardiovascular").length, 10);
});

const registro = (r: Partial<RegistroDeRevisao> & Pick<RegistroDeRevisao, "situacao" | "assinatura" | "criadoEm">): RegistroDeRevisao => ({
  id: r.criadoEm, protocolo: "anafilaxia", versao: 1, conteudo: anafilaxia, observacao: null,
  autorNome: "Revisor Fictício", autorCrm: "CRM-SP 000000", autorPapel: "revisor", ...r,
});

test("situação: sem registro é pendente; aprovado põe em uso; versão nova não derruba a aprovada", () => {
  const atual = assinatura(anafilaxia);
  assert.equal(assinatura(anafilaxia), atual, "a assinatura é estável");
  assert.notEqual(assinatura({ ...anafilaxia, versao: 2 }), atual);

  const nada = resolverEstado(anafilaxia, []);
  assert.equal(nada.daVersaoAtual, "pendente");
  assert.equal(nada.emUso, null);

  const aprovado = resolverEstado(anafilaxia, [registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z" })]);
  assert.equal(aprovado.daVersaoAtual, "aprovado");
  assert.equal(aprovado.emUso, anafilaxia);

  // O código mudou (versão 2): a 1 continua em uso, e a 2 espera revisão.
  const v2 = { ...anafilaxia, versao: 2, resumo: "outro texto" };
  const antigo = resolverEstado(v2, [registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z" })]);
  assert.equal(antigo.daVersaoAtual, "pendente");
  assert.equal(antigo.versaoNovaEsperando, true);
  assert.equal((antigo.emUso as typeof anafilaxia).versao, 1);

  // Necessita atualização: continua em uso, com aviso.
  const atualizar = resolverEstado(anafilaxia, [
    registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z" }),
    registro({ situacao: "necessita_atualizacao", assinatura: atual, criadoEm: "2026-11-01T10:00:00Z" }),
  ]);
  assert.equal(atualizar.daVersaoAtual, "necessita_atualizacao");
  assert.ok(atualizar.emUso && atualizar.precisaAtualizar);

  // Suspenso: sai de uso; uma nova aprovação (reversão) volta.
  const suspenso = resolverEstado(anafilaxia, [
    registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z" }),
    registro({ situacao: "suspenso", assinatura: atual, criadoEm: "2026-11-02T10:00:00Z" }),
  ]);
  assert.equal(suspenso.daVersaoAtual, "suspenso");
  assert.equal(suspenso.emUso, null);
  const revertido = resolverEstado(anafilaxia, [
    ...suspenso.historico,
    registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-11-03T10:00:00Z" }),
  ]);
  assert.equal(revertido.daVersaoAtual, "aprovado");

  // Instantâneo inválido no banco não vira conteúdo em uso.
  const lixo = resolverEstado(anafilaxia, [registro({ situacao: "aprovado", assinatura: atual, criadoEm: "2026-10-20T10:00:00Z", conteudo: { id: "anafilaxia" } })]);
  assert.equal(lixo.emUso, null);
  // Registro de outro protocolo não conta.
  assert.equal(resolverEstado(laringo, aprovado.historico).daVersaoAtual, "pendente");
});

test("o banco e a tela concordam sobre quem registra o quê, e o histórico não muda", async () => {
  const { readFileSync } = await import("node:fs");
  const { PODE_REGISTRAR } = await import("./situacao.ts");
  const sql = readFileSync(new URL("../../supabase/migrations/202610150001_intercorrencias_anestesicas.sql", import.meta.url), "utf8");
  // Editor: só rascunho e pendente; admin: mais suspender; aprovar exige revisor com CRM.
  assert.match(sql, /v_papel = 'editor' and p_situacao not in \('rascunho', 'pendente'\)/);
  assert.match(sql, /v_papel = 'admin' and p_situacao not in \('rascunho', 'pendente', 'suspenso'\)/);
  assert.deepEqual(PODE_REGISTRAR.editor, ["rascunho", "pendente"]);
  assert.deepEqual(PODE_REGISTRAR.admin, ["rascunho", "pendente", "suspenso"]);
  assert.match(sql, /autor_papel = 'revisor' and autor_crm is not null/);
  assert.match(sql, /REVISOR_SEM_CRM/);
  // Só cresce: gatilho contra update e delete; e as funções fora do alcance de anon.
  assert.match(sql, /before update or delete on public\.intercorrencias_revisoes/);
  for (const f of ["intercorrencias_meu_papel()", "intercorrencias_registrar(text, integer, text, text, jsonb, text)", "intercorrencias_definir_papel(text, text)", "intercorrencias_equipe_lista()"]) {
    assert.ok(sql.includes(`revoke all on function public.${f} from public, anon;`), f);
  }
});
