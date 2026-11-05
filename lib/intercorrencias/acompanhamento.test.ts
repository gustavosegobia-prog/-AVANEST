import test from "node:test";
import assert from "node:assert/strict";
import { RESPIRATORIO_V3 } from "./protocolos/respiratorio.ts";
import { OBSTETRICIA_NEONATAL_V3 } from "./protocolos/obstetricia-neonatal.ts";
import { METABOLICAS_APOIO_V3 } from "./protocolos/metabolicas-apoio.ts";

// Regra do responsável médico (01/11/2026): o anestesiologista acompanha o
// paciente na sala; depois dela, o cuidado é da clínica cirúrgica (na
// gestante, da obstetrícia; no recém-nascido, da neonatologia) ou da UTI. O
// "Depois" diz o que fazer na sala e o que entregar na passagem de cuidado.

const RASCUNHOS = [...RESPIRATORIO_V3, ...OBSTETRICIA_NEONATAL_V3, ...METABOLICAS_APOIO_V3];

test("acompanhamento: nenhum Depois manda o anestesiologista acompanhar o pós-operatório por conta própria", () => {
  assert.equal(RASCUNHOS.length, 17);
  // Os cartões de apoio (10 Ts, resultado da crise, colega afetado) falam de medidas da instituição e do colega, não do paciente.
  const clinicos = RASCUNHOS.filter((p) => p.categoria !== "apoio");
  assert.equal(clinicos.length, 14);
  const proibido = /^(Monitoriza|Monitorar|Manter observação|Acompanhar|Observar|Realizar avaliação|Avaliação de lesões)/;
  for (const p of clinicos) for (const x of p.depois) assert.doesNotMatch(x, proibido, `${p.id}: "${x}"`);
});

test("acompanhamento: os cartões com seguimento clínico entregam o plano na passagem de cuidado", () => {
  const comSeguimento = [
    "nao-ventilo-nao-intubo", "laringoespasmo", "pressao-vias-aereas", "broncoespasmo-grave", "broncoaspiracao",
    "bloqueio-neuroaxial-alto", "hemorragia-pos-parto", "colapso-materno", "reanimacao-neonatal",
    "toxicidade-anestesico-local", "hipercalemia", "hipertermia-maligna",
  ];
  for (const id of comSeguimento) {
    const p = RASCUNHOS.find((x) => x.id === id)!;
    const texto = [...p.depois, ...p.agirAgora.map((x) => x.detalhe ?? "")].join(" ");
    assert.match(texto, /passagem/, id);
  }
  // A quem se entrega: clínica cirúrgica, obstetrícia, neonatologia ou UTI.
  const depois = (id: string) => RASCUNHOS.find((x) => x.id === id)!.depois.join(" ");
  assert.match(depois("laringoespasmo"), /^Na sala: observação respiratória até a passagem de cuidado\. Na passagem à clínica cirúrgica \(ou à UTI\)/);
  assert.match(depois("broncoaspiracao"), /Na passagem à clínica cirúrgica \(ou à UTI\), que acompanha o paciente depois da sala/);
  assert.match(depois("hemorragia-pos-parto"), /^Na passagem à obstetrícia \(ou à UTI\), que acompanha a paciente depois da sala/);
  assert.match(depois("colapso-materno"), /^Passagem estruturada à UTI materna e à neonatologia/);
  assert.match(depois("reanimacao-neonatal"), /^Na passagem à neonatologia \(ou à UTI neonatal\)/);
  assert.match(depois("bloqueio-neuroaxial-alto"), /na sala ou, a partir da passagem de cuidado, pela equipe que assume/);
  // O que já estava no texto clínico continua: a alta não segue regra fixa.
  assert.ok(RASCUNHOS.find((x) => x.id === "broncoaspiracao")!.depois.includes(
    "Não utilizar ausência de sintomas por apenas duas horas ou radiografia inicial normal como critérios universais de alta."));
});

test("acompanhamento: os 15 cartões das revisões anteriores também entregam o plano na passagem, sem mudar doses nem etapas", async () => {
  const { acharProtocolo, rascunhoDe, versaoLiberada } = await import("./catalogo.ts");
  const { aprovado } = await import("./aprovacao.ts");
  const ids = [
    "isquemia-miocardica", "hemorragia-macica", "anafilaxia", "embolia-gasosa-venosa", "bradicardia", "embolia-pulmonar",
    "hipotermia-perioperatoria", "depressao-respiratoria-opioides", "hipoglicemia-grave", "crise-adrenal", "convulsao-perioperatoria",
    "delirio-ao-despertar", "eclampsia", "embolia-amniotica", "bloqueio-neuromuscular-residual",
  ];
  const proibido = /^(Monitoriza|Monitorar|Manter observação|Acompanhar|Observar|Vigiar|Reavaliar depois|Glicemia seriada|UTI materna|Recuperação:|EEG se)/;
  for (const id of ids) {
    // A versão que quem usa abre (na eclâmpsia, a 3; a 4, com o magnésio do MS, espera aprovação e também traz a passagem).
    const r = versaoLiberada(id)!, publicado = acharProtocolo(id)!;
    assert.ok(r, id);
    assert.ok(aprovado(r), `${id}: a versão com a passagem sem a aprovação de 05/11/2026`);
    assert.match(rascunhoDe(id)!.depois.join(" "), /[Pp]assagem/, `${id}: o rascunho mais novo perdeu a passagem`);
    for (const x of r.depois) assert.doesNotMatch(x, proibido, `${id}: "${x}"`);
    assert.match(r.depois.join(" "), /[Pp]assagem/, id);
    // As doses são as da versão publicada (ou do rascunho anterior, que já as trazia).
    assert.deepEqual(r.medicamentos.map((d) => d.id), r.medicamentos.map((d) => d.id), id);
    if (["isquemia-miocardica", "hemorragia-macica", "anafilaxia", "embolia-gasosa-venosa", "bradicardia"].includes(id)) {
      assert.equal(r.versao, publicado.versao + 1, id);
      assert.ok(aprovado(publicado), `${id}: a versão aprovada continua com quem usa`);
      assert.deepEqual(r.medicamentos, publicado.medicamentos, `${id}: doses iguais às da versão aprovada`);
      assert.equal(r.agirAgora.length, publicado.agirAgora.length, id);
    }
  }
  // Na isquemia, só o detalhe da etapa do pós-operatório muda.
  const isq = rascunhoDe("isquemia-miocardica")!, isq3 = acharProtocolo("isquemia-miocardica")!;
  const diferentes = isq.agirAgora.filter((x, i) => JSON.stringify(x) !== JSON.stringify(isq3.agirAgora[i])).map((x) => x.texto);
  assert.deepEqual(diferentes, ["Planeje acompanhamento pós-operatório intensivo quando necessário."]);
  assert.match(isq.agirAgora.find((x) => x.texto === diferentes[0])!.detalhe!, /depois da sala é da clínica cirúrgica \(ou da UTI\)/);
  assert.match(rascunhoDe("eclampsia")!.depois[0], /^Na passagem à obstetrícia/);
});
