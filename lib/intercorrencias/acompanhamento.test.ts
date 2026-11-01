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
