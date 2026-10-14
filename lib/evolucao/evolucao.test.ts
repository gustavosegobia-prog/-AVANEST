import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { historicoDe, vigentes, type Registro } from "./registros.ts";
import { lacunaPadrao, pamEstimada, pamEstimadaCabe, periodosSemMonitorizacao, pontosDe, trechos } from "./sinais.ts";
import { pontoDoToque, tempoParaX, valorParaY, xParaTempo, yParaValor, marcasDeTempo, janelaVisivel } from "./grafico.ts";
import { consumoSevoflurano, formatarMl, mlNoIntervalo } from "./sevoflurano.ts";
import {
  CATALOGO, administrados, agruparPorMedicamento, buscarNoCatalogo, converterMassa, doseAcumulada,
  doseDoVolume, dosePorKg, exposicaoAnestesicoLocal, volumeDaDose,
} from "./medicamentos.ts";
import { montarInfusoes, totalDaInfusao } from "./infusoes.ts";
import { balancoHidrico } from "./liquidos.ts";
import { SEM_REFERENCIA, avaliarDose, idadeEmDias, type RegraDeDose } from "./doses.ts";
import {
  conferirEncerramento, duracaoEmMinutos, equipeParaImpressao, fimDaAnestesia, horarioDaSaida, horarioDoMarco,
  minutosDeTorniquete, periodosDeTorniquete,
} from "./folha.ts";
import { classificarErro, motivoLegivel } from "./fila.ts";

const T0 = Date.parse("2026-10-10T10:00:00-03:00");
const em = (min: number) => new Date(T0 + min * 60000).toISOString();
let seq = 0;
function reg(tipo: Registro["tipo"], min: number, dados: Record<string, unknown>, extra: Partial<Registro> = {}): Registro {
  seq += 1;
  return {
    id: extra.id ?? `r${seq}`, evolucao_id: "f1", tipo, momento: em(min), dados, origem: "manual",
    substitui_id: null, anulado: false, motivo: null, created_by: "u1", created_at: em(min), ...extra,
  };
}

// ---------------------------------------------------------------------------
// Registros: correção e exclusão sem apagar nada
// ---------------------------------------------------------------------------
test("Teste B — corrigir um ponto troca o vigente e guarda a cadeia", () => {
  const original = reg("sinal", 5, { parametro: "pas", valor: 120 }, { id: "a" });
  const correcao = reg("sinal", 6, { parametro: "pas", valor: 125 }, { id: "b", substitui_id: "a" });
  const outro = reg("sinal", 5, { parametro: "fc", valor: 80 }, { id: "c" });
  const v = vigentes([original, correcao, outro]);
  assert.deepEqual(v.map((r) => r.id).sort(), ["b", "c"]);
  assert.deepEqual(historicoDe("b", [original, correcao, outro]).map((r) => r.id), ["a", "b"]);
  assert.deepEqual(historicoDe("a", [original, correcao, outro]).map((r) => r.id), ["a", "b"]);
});

test("exclusão tira o ponto da folha sem apagar o registro", () => {
  const original = reg("sinal", 5, { parametro: "fc", valor: 80 }, { id: "x" });
  const exclusao = reg("sinal", 5, {}, { id: "y", substitui_id: "x", anulado: true, motivo: "Engano" });
  assert.equal(vigentes([original, exclusao]).length, 0);
  assert.equal(historicoDe("x", [original, exclusao]).length, 2);
});

// ---------------------------------------------------------------------------
// Sinais e gráfico
// ---------------------------------------------------------------------------
test("PAM estimada = (PAS + 2 × PAD) / 3, e recusa par impossível", () => {
  assert.equal(pamEstimada(120, 80), 93);
  assert.equal(pamEstimada(90, 60), 70);
  assert.equal(pamEstimada(80, 90), null, "PAD maior que PAS");
  assert.equal(pamEstimada(500, 80), null, "fora da faixa possível");
});

test("PAM estimada nunca cobre uma PAM medida no mesmo minuto", () => {
  const medida = reg("sinal", 10, { parametro: "pam", valor: 85 });
  assert.equal(pamEstimadaCabe([medida], em(10)), false);
  assert.equal(pamEstimadaCabe([medida], em(15)), true);
  const estimada = reg("sinal", 20, { parametro: "pam", valor: 85 }, { origem: "estimado" });
  assert.equal(pamEstimadaCabe([estimada], em(20)), true, "estimada não bloqueia outra estimativa");
});

test("Teste A — as curvas ligam os pontos em ordem e quebram nas lacunas", () => {
  const v = vigentes([
    reg("sinal", 10, { parametro: "pas", valor: 130 }),
    reg("sinal", 0, { parametro: "pas", valor: 120 }),
    reg("sinal", 5, { parametro: "pas", valor: 125 }),
    reg("sinal", 60, { parametro: "pas", valor: 110 }),
    reg("sinal", 0, { parametro: "pad", valor: 70 }),
    reg("sinal", 5, { parametro: "fc", valor: 78 }),
  ]);
  const pas = pontosDe(v, "pas");
  assert.deepEqual(pas.map((p) => p.valor), [120, 125, 130, 110], "ordem do horário, não do lançamento");
  const t = trechos(pas, lacunaPadrao(5));
  assert.equal(t.length, 2, "45 min sem medida não viram uma linha");
  assert.deepEqual(t[0].map((p) => p.valor), [120, 125, 130]);
  assert.equal(pontosDe(v, "pad").length, 1);
  assert.equal(pontosDe(v, "fc").length, 1);
  const lacunas = periodosSemMonitorizacao(v, em(0), em(60), 15);
  assert.equal(lacunas.length, 1);
  assert.equal(lacunas[0].de, em(10));
});

test("a geometria vai e volta: o toque cai no horário e no valor certos", () => {
  const e = { inicio: T0, minutos: 120, largura: 1200, altura: 480 };
  assert.equal(tempoParaX(T0 + 30 * 60000, e), 300);
  assert.equal(xParaTempo(300, e), T0 + 30 * 60000);
  assert.equal(valorParaY(120, e), 240);
  assert.equal(yParaValor(240, e), 120);
  const p = pontoDoToque(303, 241, e);
  assert.equal(p.ms, T0 + 30 * 60000, "minuto cheio");
  assert.equal(p.valor, 120, "valor inteiro");
  assert.equal(pontoDoToque(0, -50, e).valor, 240, "não passa do topo do eixo");
  assert.deepEqual(marcasDeTempo(T0 + 60000, T0 + 16 * 60000, 5).map((t) => (t - T0) / 60000), [5, 10, 15]);
});

test("a janela acompanha o fim do caso e navega para trás", () => {
  const fim = T0 + 300 * 60000;
  const segue = janelaVisivel(T0, fim, 120, null);
  assert.ok(segue.inicio + 120 * 60000 >= fim, "o agora fica à vista");
  const voltou = janelaVisivel(T0, fim, 120, 0);
  assert.equal(voltou.inicio, T0 - 5 * 60000);
});

// ---------------------------------------------------------------------------
// Sevoflurano
// ---------------------------------------------------------------------------
test("Teste E — 3 L/min, 2%, 20 min ≈ 6,52 mL", () => {
  assert.equal(Math.round(mlNoIntervalo(3, 2, 20) * 100) / 100, 6.52);
  const r = consumoSevoflurano([{ momento: em(0), o2: 1, ar: 2, n2o: 0, outro: 0, sevoPct: 2 }], em(20));
  assert.equal(r.totalMl, 6.52);
  assert.equal(formatarMl(r.totalMl), "6,5 mL");
});

test("Teste E — alterações no meio do caso somam por intervalo", () => {
  const r = consumoSevoflurano([
    { momento: em(0), o2: 1, ar: 2, n2o: 0, outro: 0, sevoPct: 2 },   // 20 min → 6,52
    { momento: em(20), o2: 1, ar: 1, n2o: 0, outro: 0, sevoPct: 2.5 }, // 30 min → 2×2,5×30 → 8,15
    { momento: em(50), o2: 2, ar: 0, n2o: 0, outro: 0, sevoPct: 0 },   // desligado
  ], em(70));
  assert.equal(r.intervalos.length, 3);
  assert.equal(r.totalMl, Math.round((6.52 + 8.15) * 100) / 100);
  assert.equal(r.intervalos[2].ml, 0);
});

test("o consumo não passa do fim da anestesia", () => {
  const r = consumoSevoflurano([{ momento: em(0), o2: 3, ar: 0, n2o: 0, outro: 0, sevoPct: 2 }], em(20));
  const depois = consumoSevoflurano([
    { momento: em(0), o2: 3, ar: 0, n2o: 0, outro: 0, sevoPct: 2 },
    { momento: em(30), o2: 3, ar: 0, n2o: 0, outro: 0, sevoPct: 2 },
  ], em(20));
  assert.equal(depois.totalMl, r.totalMl, "ajuste registrado depois do fim não conta");
});

test("nenhum valor financeiro na conta do sevoflurano", () => {
  // Só o código conta — o comentário que diz "sem preço" pode ficar.
  const codigo = fs.readFileSync(new URL("./sevoflurano.ts", import.meta.url), "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(codigo, /R\$|pre[cç]o|custo|reais|BRL/i);
});

// ---------------------------------------------------------------------------
// Medicamentos
// ---------------------------------------------------------------------------
test("conversões de unidade e concentração em %", () => {
  assert.equal(converterMassa(1, "mg", "mcg"), 1000);
  assert.equal(converterMassa(2, "g", "mg"), 2000);
  assert.equal(converterMassa(1, "UI", "mg"), null);
  // Lidocaína 2% = 20 mg/mL: 100 mg são 5 mL.
  assert.equal(volumeDaDose(100, "mg", { valor: 2, unidade: "%" }), 5);
  // Fentanil 50 mcg/mL: 100 mcg são 2 mL; 0,1 mg também.
  assert.equal(volumeDaDose(100, "mcg", { valor: 50, unidade: "mcg/mL" }), 2);
  assert.equal(volumeDaDose(0.1, "mg", { valor: 50, unidade: "mcg/mL" }), 2);
  assert.equal(doseDoVolume(3, "mg", { valor: 10, unidade: "mg/mL" }), 30);
  assert.equal(volumeDaDose(10, "UI", { valor: 5, unidade: "mg/mL" }), null, "UI com mg não conversa");
});

test("Teste C — criança de 6 anos e 22 kg: a conta em mg/kg", () => {
  // Dose FICTÍCIA, só para conferir a matemática.
  assert.equal(dosePorKg(44, 22), 2);
  assert.equal(dosePorKg(33, 22), 1.5);
  assert.equal(dosePorKg(110, 22), 5);
  assert.equal(dosePorKg(44, null), null);
  const nasc = "2020-10-10";
  const dias = idadeEmDias(nasc, new Date("2026-10-10T12:00:00-03:00"))!;
  assert.ok(dias >= 2190 && dias <= 2192, `6 anos em dias: ${dias}`);
});

test("Teste D — só o administrado vai para a coluna da impressão", () => {
  const v = vigentes([
    reg("medicamento", 5, { nome: "Propofol", status: "administrado", dose: 150, unidade: "mg", via: "EV", forma: "bolus" }),
    reg("medicamento", 5, { nome: "Fentanil", status: "administrado", dose: 100, unidade: "mcg", via: "EV", forma: "bolus" }),
    reg("medicamento", 6, { nome: "Rocurônio", status: "planejado", dose: 50, unidade: "mg", via: "EV", forma: "bolus" }),
    reg("medicamento", 7, { nome: "Cefazolina", status: "cancelado", dose: 2, unidade: "g", via: "EV", forma: "bolus" }),
  ]);
  const nomes = agruparPorMedicamento(administrados(v)).map((g) => g.nome);
  assert.deepEqual(nomes, ["Propofol", "Fentanil"]);
});

test("doses repetidas aparecem todas, com o total, mesmo em unidades diferentes", () => {
  const v = vigentes([
    reg("medicamento", 5, { nome: "Fentanil", status: "administrado", dose: 100, unidade: "mcg", via: "EV", forma: "bolus" }),
    reg("medicamento", 45, { nome: "fentanil", status: "administrado", dose: 0.05, unidade: "mg", via: "EV", forma: "bolus" }),
  ]);
  const [g] = agruparPorMedicamento(administrados(v));
  assert.equal(g.vezes.length, 2);
  assert.equal(g.total, 150);
  assert.equal(g.unidade, "mcg");
  assert.equal(doseAcumulada(administrados(v), "Fentanil", "mcg", em(10)), 100);
});

test("a exposição a anestésico local soma por agente, sem julgar", () => {
  const lista = administrados(vigentes([
    reg("medicamento", 5, { nome: "Lidocaína", status: "administrado", dose: 100, unidade: "mg", via: "perineural", forma: "bloqueio" }),
    reg("medicamento", 6, { nome: "Ropivacaína", status: "administrado", dose: 150, unidade: "mg", via: "perineural", forma: "bloqueio" }),
  ]));
  const exp = exposicaoAnestesicoLocal(lista, 70);
  assert.deepEqual(exp.map((e) => [e.nome, e.mg]), [["Ropivacaína", 150], ["Lidocaína", 100]].sort(
    (a, b) => exp.findIndex((e) => e.nome === a[0]) - exp.findIndex((e) => e.nome === b[0])));
  assert.equal(exp.find((e) => e.nome === "Lidocaína")!.mgPorKg, 1.4286);
});

test("a busca acha pelo nome comercial e sem acento", () => {
  assert.equal(buscarNoCatalogo("dormonid")[0].nome, "Midazolam");
  assert.equal(buscarNoCatalogo("rocuronio")[0].nome, "Rocurônio");
  assert.equal(buscarNoCatalogo("PRECEDEX")[0].nome, "Dexmedetomidina");
  assert.ok(buscarNoCatalogo("fenta").some((i) => i.nome === "Fentanil"));
});

test("o catálogo não carrega nenhuma dose", () => {
  for (const item of CATALOGO) {
    assert.deepEqual(Object.keys(item).filter((k) => /dose|concentra|apresenta|ampola|max|min/i.test(k)), [],
      `${item.nome} tem campo de dose`);
  }
  const fonte = fs.readFileSync(new URL("./doses.ts", import.meta.url), "utf8");
  assert.doesNotMatch(fonte, /dose_habitual_(min|max):\s*\d/, "valor de dose escrito no código");
});

// ---------------------------------------------------------------------------
// Infusões e líquidos
// ---------------------------------------------------------------------------
test("infusão em mL/h: volume e quantidade pela concentração, por intervalo", () => {
  const ini = reg("infusao", 0, { acao: "iniciar", nome: "Noradrenalina", concentracao: { valor: 80, unidade: "mcg/mL" },
    velocidade: { valor: 6, unidade: "mL/h" } }, { id: "inf1" });
  const aj = reg("infusao", 30, { acao: "ajustar", infusao_id: "inf1", velocidade: { valor: 12, unidade: "mL/h" } });
  const fim = reg("infusao", 60, { acao: "encerrar", infusao_id: "inf1" });
  const [inf] = montarInfusoes(vigentes([ini, aj, fim]));
  const t = totalDaInfusao(inf, 70);
  assert.equal(t.volumeMl, 9);            // 3 mL + 6 mL
  assert.equal(t.quantidade, 720);        // 9 mL × 80 mcg
  assert.equal(t.unidadeQuantidade, "mcg");
  assert.equal(t.incompleto, false);
});

test("infusão por peso: quantidade direta; sem término não presume que seguiu", () => {
  const ini = reg("infusao", 0, { acao: "iniciar", nome: "Remifentanil", concentracao: { valor: 50, unidade: "mcg/mL" },
    velocidade: { valor: 0.1, unidade: "mcg/kg/min" } }, { id: "inf2" });
  const aj = reg("infusao", 40, { acao: "ajustar", infusao_id: "inf2", velocidade: { valor: 0.2, unidade: "mcg/kg/min" } });
  const [inf] = montarInfusoes(vigentes([ini, aj]));
  const t = totalDaInfusao(inf, 50);
  assert.equal(t.quantidade, 200);        // 0,1 × 50 × 40 min; o ajuste não tem minuto confirmado depois
  assert.equal(t.volumeMl, 4);
  assert.equal(t.incompleto, true);
  assert.equal(totalDaInfusao(inf, null).quantidade, null, "sem peso não há conta por kg");
});

test("balanço hídrico com avisos de registro incompleto", () => {
  const b = balancoHidrico(vigentes([
    reg("liquido", 0, { sentido: "entrada", categoria: "cristaloide", nome: "Ringer lactato", volume_ml: 1000 }),
    reg("liquido", 30, { sentido: "entrada", categoria: "hemoderivado", nome: "Concentrado de hemácias", volume_ml: 300 }),
    reg("liquido", 60, { sentido: "saida", categoria: "diurese", nome: "Diurese", volume_ml: 250 }),
  ]), 70);
  assert.equal(b.entradas, 1300);
  assert.equal(b.saidas, 250);
  assert.equal(b.saldo, 1050);
  assert.ok(b.avisos.includes("Sem registro de sangramento."));
  assert.ok(!b.avisos.includes("Sem registro de diurese."));
});

// ---------------------------------------------------------------------------
// Motor de doses
// ---------------------------------------------------------------------------
// Regra FICTÍCIA, só deste teste: "Fármaco de teste", valores redondos que não
// correspondem a medicamento nenhum. Regra real só entra pelo banco, aprovada.
const REGRA_DE_TESTE: RegraDeDose = {
  id: "teste", medicamento: "Fármaco de teste", via: "EV", indicacao: "teste",
  idade_min_dias: 365, idade_max_dias: 365 * 12, peso_min_kg: 10, peso_max_kg: 40,
  unidade_por_kg: "mg/kg", dose_habitual_min: 1, dose_habitual_max: 2, dose_critica_max: 4,
  dose_maxima_absoluta: 100, unidade_maxima_absoluta: "mg", dose_acumulada_max_por_kg: 6,
  intervalo_minimo_min: 30, fonte: "Fonte fictícia de teste", edicao: "1ª", ano: 2000, versao: 1, aprovada: true,
};
const ctx = (extra: Partial<Parameters<typeof avaliarDose>[1]> = {}) => ({
  medicamento: "Fármaco de teste", via: "EV", indicacao: "teste", dose: 33, unidade: "mg" as const,
  pesoKg: 22, idadeDias: 2191, acumuladoAntes: 0, minutosDesdeUltima: null, ...extra,
});

test("sem regra aprovada: referência indisponível, sem julgar a dose", () => {
  const sem = avaliarDose([], ctx());
  assert.equal(sem.nivel, "indisponivel");
  assert.ok(sem.motivos[0].startsWith(SEM_REFERENCIA));
  assert.equal(sem.porKg, 1.5, "a conta aparece mesmo sem regra");
  const naoAprovada = avaliarDose([{ ...REGRA_DE_TESTE, aprovada: false }], ctx());
  assert.equal(naoAprovada.nivel, "indisponivel", "regra não aprovada não vale");
  const outraVia = avaliarDose([REGRA_DE_TESTE], ctx({ via: "IM" }));
  assert.equal(outraVia.nivel, "indisponivel", "via diferente não herda a regra");
});

test("verde, amarelo e vermelho contra uma regra aprovada", () => {
  const verde = avaliarDose([REGRA_DE_TESTE], ctx({ dose: 33 }));          // 1,5 mg/kg
  assert.equal(verde.nivel, "verde");
  assert.equal(verde.exigeJustificativa, false);
  assert.ok(verde.motivos.some((m) => m.includes("Fonte fictícia de teste")), "a fonte aparece");
  const amarelo = avaliarDose([REGRA_DE_TESTE], ctx({ dose: 66 }));        // 3 mg/kg
  assert.equal(amarelo.nivel, "amarelo");
  assert.equal(amarelo.exigeJustificativa, true);
  const vermelho = avaliarDose([REGRA_DE_TESTE], ctx({ dose: 99 }));       // 4,5 mg/kg
  assert.equal(vermelho.nivel, "vermelho");
  const acumulado = avaliarDose([REGRA_DE_TESTE], ctx({ dose: 33, acumuladoAntes: 110 })); // 6,5 mg/kg acumulado
  assert.equal(acumulado.nivel, "vermelho");
  const cedo = avaliarDose([REGRA_DE_TESTE], ctx({ dose: 33, minutosDesdeUltima: 10 }));
  assert.equal(cedo.nivel, "amarelo");
});

test("unidade que não converte e peso ausente são erro, não alerta", () => {
  assert.equal(avaliarDose([REGRA_DE_TESTE], ctx({ unidade: "UI" })).nivel, "erro");
  assert.equal(avaliarDose([REGRA_DE_TESTE], ctx({ pesoKg: null })).nivel, "indisponivel",
    "sem peso, a regra (que exige peso mínimo) não se aplica");
  const semPesoMinimo = { ...REGRA_DE_TESTE, peso_min_kg: null, peso_max_kg: null };
  assert.equal(avaliarDose([semPesoMinimo], ctx({ pesoKg: null })).nivel, "erro");
});

test("a dose em mcg é comparada à regra em mg/kg pela conversão", () => {
  const r = avaliarDose([REGRA_DE_TESTE], ctx({ dose: 33000, unidade: "mcg" }));
  assert.equal(r.porKg, 1.5);
  assert.equal(r.nivel, "verde");
});

// ---------------------------------------------------------------------------
// Folha, equipe e conferência
// ---------------------------------------------------------------------------
test("Teste F — a impressão leva só a equipe vinculada", () => {
  const so = equipeParaImpressao([{ perfil_id: "u1", nome: "Dra. A", crm: "1", uf: "PR", funcao: "responsavel" }]);
  assert.equal(so.length, 1);
  const com = equipeParaImpressao([
    { perfil_id: null, nome: "Dr. Residente", crm: "2", uf: "PR", funcao: "residente", ano_residencia: "R2" },
    { perfil_id: "u1", nome: "Dra. A", crm: "1", uf: "PR", funcao: "responsavel" },
    { perfil_id: null, nome: "Dr. Preceptor", crm: "3", uf: "PR", funcao: "preceptor" },
    { perfil_id: null, nome: "  ", crm: "", uf: "", funcao: "outro" },
  ]);
  assert.deepEqual(com.map((p) => p.funcao), ["responsavel", "preceptor", "residente"]);
});

test("a conferência aponta o que falta e o que não bate, sem inventar", () => {
  const v = vigentes([
    reg("evento", 0, { codigo: "inicio_anestesia" }),
    reg("evento", 90, { codigo: "fim_anestesia" }),
    reg("infusao", 10, { acao: "iniciar", nome: "Propofol", velocidade: { valor: 10, unidade: "mL/h" } }),
    reg("medicamento", 5, { nome: "Rocurônio", status: "preparado", dose: 50, unidade: "mg", via: "EV", forma: "bolus" }),
  ]);
  const p = conferirEncerramento({ procedimento: "", tecnicas: [] }, v, 5);
  const textos = p.map((x) => x.texto);
  assert.ok(textos.includes("Anestesiologista responsável."));
  assert.ok(textos.includes("Técnica anestésica."));
  assert.ok(textos.some((t) => t.startsWith("Infusão de Propofol")));
  assert.ok(textos.some((t) => t.startsWith("Rocurônio está como preparado")));
  assert.ok(textos.some((t) => t.startsWith("Sem registro de PA ou FC")));
  assert.equal(horarioDoMarco(v, "fim_anestesia"), em(90));
});

test("a fila trata reenvio como salvo e dado recusado como definitivo", () => {
  assert.equal(classificarErro(null), "salvo");
  assert.equal(classificarErro({ code: "23505", message: 'duplicate key value violates unique constraint "evolucao_registros_pkey"' }), "salvo");
  assert.equal(classificarErro({ code: "23505", message: 'duplicate key ... "evolucao_registros_substitui_unico"' }), "conflito");
  assert.equal(classificarErro({ code: "P0001", message: "REGISTRO_INVALIDO: pas fora da faixa possível (20 a 300)" }), "recusado");
  assert.equal(classificarErro({ message: "TypeError: Failed to fetch" }), "tentar_de_novo");
  assert.equal(motivoLegivel("REGISTRO_INVALIDO: dose, concentração e volume não batem"), "dose, concentração e volume não batem");
});

test("torniquete: insuflações somadas, a aberta conta até agora", () => {
  const ev = (min: number, codigo: string) => reg("evento", min, { codigo });
  const periodos = periodosDeTorniquete([ev(10, "inicio_torniquete"), ev(12, "inicio_torniquete"), ev(70, "fim_torniquete"),
    ev(71, "fim_torniquete"), ev(90, "inicio_torniquete"), ev(5, "inicio_anestesia")]);
  assert.deepEqual(periodos, [{ inicio: em(10), fim: em(70) }, { inicio: em(90), fim: null }]);
  assert.equal(minutosDeTorniquete(periodos, Date.parse(em(105))), 75);
  assert.deepEqual(periodosDeTorniquete([ev(3, "fim_torniquete")]), []);
  assert.equal(duracaoEmMinutos(45), "45 min");
  assert.equal(duracaoEmMinutos(60), "1 h");
  assert.equal(duracaoEmMinutos(75), "1 h 15 min");
});

test("a saída da sala encerra o tempo quando o fim da anestesia não foi marcado", () => {
  const ev = (min: number, codigo: string, extra: Partial<Registro> = {}) => reg("evento", min, { codigo }, extra);
  const base = [ev(0, "inicio_anestesia"), ev(45, "transferencia_rpa"), reg("medicamento", 200, { nome: "Dipirona", status: "administrado" })];
  // Sem "Fim da anestesia": vale a transferência — não o último lançamento.
  assert.equal(horarioDaSaida(base), em(45));
  assert.equal(fimDaAnestesia(vigentes(base)), em(45));
  // Com o fim marcado, ele vence a saída.
  assert.equal(fimDaAnestesia(vigentes([...base, ev(50, "fim_anestesia")])), em(50));
  // UTI conta igual; e a primeira saída é a que vale.
  assert.equal(horarioDaSaida([ev(60, "transferencia_uti"), ev(70, "transferencia_rpa")]), em(60));
  // Transferência excluída não encerra nada.
  const t = ev(45, "transferencia_rpa", { id: "t1" });
  assert.equal(fimDaAnestesia(vigentes([ev(0, "inicio_anestesia"), t, ev(46, "transferencia_rpa", { substitui_id: "t1", anulado: true })])), null);
  // A conferência de encerramento aceita a saída como fim.
  const textos = conferirEncerramento({}, vigentes(base), 5).map((x) => x.texto);
  assert.ok(!textos.includes("Horário de fim da anestesia."));
  assert.ok(conferirEncerramento({}, vigentes([ev(0, "inicio_anestesia")]), 5).some((x) => x.texto === "Horário de fim da anestesia."));
});

test("linha pronta em cada coluna do intervalo: o último valor antes dela, a pré-anestésica ou o neutro", async () => {
  const { colunasProntas } = await import("./sinais.ts");
  const reg = (id: string, p: string, valor: number, momento: string) =>
    ({ id, evolucao_id: "e", tipo: "sinal", momento, dados: { parametro: p, valor }, origem: "manual",
      substitui_id: null, anulado: false, motivo: null, created_by: "u", created_at: momento }) as Registro;
  const ms = (hhmm: string) => Date.parse(`2026-10-14T${hhmm}:00Z`);
  const hora = (t: number) => new Date(t).toISOString().slice(11, 16);
  // Começo às 10:00, agora 10:12, intervalo 5: colunas 10:00, 10:05, 10:10.
  const vazia = colunasProntas([], { pa: "100/60", pulso: "98" }, { inicioMs: ms("10:00"), ateMs: ms("10:12"), intervaloMin: 5 });
  assert.deepEqual(vazia.map((c) => hora(c.ms)), ["10:00", "10:05", "10:10"]);
  assert.deepEqual(vazia[0].itens.map((r) => [r.parametro, r.valor, r.origem]), [["pas", 100, "pre"], ["pad", 60, "pre"], ["fc", 98, "pre"]]);
  // A PA lançada às 10:05 some daquela coluna e passa a ser o valor das seguintes.
  const vig = [reg("1", "pas", 130, "2026-10-14T10:05:00Z"), reg("2", "pad", 80, "2026-10-14T10:06:00Z")];
  const cols = colunasProntas(vig, {}, { inicioMs: ms("10:00"), ateMs: ms("10:12"), intervaloMin: 5 });
  assert.deepEqual(cols.find((c) => hora(c.ms) === "10:05")!.itens.map((r) => r.parametro), ["fc"]);
  assert.deepEqual(cols.find((c) => hora(c.ms) === "10:10")!.itens.map((r) => [r.parametro, r.valor, r.origem]),
    [["pas", 130, "anterior"], ["pad", 80, "anterior"], ["fc", 100, "padrao"]]);
  // Intervalo de 3 min: colunas 10:00, 10:03, 10:06, 10:09, 10:12.
  assert.equal(colunasProntas([], {}, { inicioMs: ms("10:00"), ateMs: ms("10:12"), intervaloMin: 3 }).length, 5);
  // Nunca no futuro: às 10:12 a coluna de 10:15 ainda não existe.
  assert.ok(cols.every((c) => c.ms <= ms("10:12")));
  // Só PAM registrada: a linha pronta é de PAM.
  const pam = [reg("4", "pam", 85, "2026-10-14T10:00:00Z")];
  assert.deepEqual(colunasProntas(pam, {}, { inicioMs: ms("10:00"), ateMs: ms("10:05"), intervaloMin: 5 })[1].itens.map((r) => r.parametro), ["pam", "fc"]);
});

test("folha de 3 em 3 min: a grade forte e a lacuna seguem de 15 min", async () => {
  const { INTERVALOS, lacunaPadrao: lacuna, marcaForte } = await import("./sinais.ts");
  assert.deepEqual([...INTERVALOS], [3, 5, 10, 15]);
  assert.deepEqual(INTERVALOS.map(marcaForte), [15, 15, 30, 45]);
  assert.deepEqual(INTERVALOS.map(lacuna), [15, 15, 30, 45]);
});
