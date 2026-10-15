/**
 * HEMORRAGIA MACIÇA — adulto, gestante e criança.
 *
 * Doses do QRH 3-2 da Association of Anaesthetists (aberto e lido: cálcio e
 * ácido tranexâmico, adulto e criança) e do Manual de Crises (protocolo 05,
 * lido no livro: plasma, crioprecipitado, plaquetas, fibrinogênio, complexo
 * protrombínico e fator VIIa). O texto das condutas é do AVANEST.
 *
 * Fibrinogênio, complexo protrombínico e fator VIIa não têm apresentação
 * cadastrada: o frasco e a reconstituição variam com o fabricante, então a
 * tela dá a dose total e deixa o volume para a bula.
 */

import type { Protocolo } from "../tipos.ts";
import { CLORETO_DE_CALCIO_10, GLUCONATO_DE_CALCIO_10, TRANEXAMICO_50 } from "./comum.ts";

const NECROSE = "Em veia calibrosa: extravasamento causa necrose.";

export const HEMORRAGIA: Protocolo = {
  id: "hemorragia-macica",
  titulo: "Hemorragia maciça",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["hemorragia intraoperatória grave", "sangramento", "transfusão maciça", "choque hemorrágico", "hemorragia crítica", "coagulopatia"],
  sinais: ["sangramento", "PA caindo", "taquicardia", "aspirador cheio", "hemoglobina caindo", "lactato alto", "sangramento difuso"],
  resumo: "Controle de danos: parar o sangramento, hemocomponentes cedo e na proporção, ácido tranexâmico, cálcio acima de 1,1 mmol/L e paciente aquecido.",
  reconhecer: [
    "Hemorragia crítica: perda de uma volemia em 24 horas, de meia volemia em 4 horas, ou acima de 150 mL por minuto.",
    "Hipotensão, taquicardia, lactato subindo e hemoglobina caindo; aspirador e compressas mostram o tamanho da perda.",
    "Falha da hemostasia já instalada: fibrinogênio abaixo de 1 g/L com TP ou TTPa acima de 1,5 vez o normal — vai precisar de mais plasma.",
    "Hemodiluição, hipocalcemia e hipotermia impedem a coagulação: tratar as três com a mesma pressa.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, avisar a equipe e anotar a hora.",
      detalhe: "Uma pessoa só para falar com o banco de sangue; outra para levar amostras e buscar os hemocomponentes." },
    { texto: "Ativar cedo o protocolo de transfusão maciça e dizer ao banco a urgência e a quantidade.",
      detalhe: "Sem tempo para a tipagem completa: O negativo ou o grupo específico." },
    { texto: "Parar o sangramento: confirmar o esforço cirúrgico, compressão, tamponamento ou pinçamento.",
      detalhe: "Se preciso, pedir ao cirurgião uma pausa para o controle. Considerar radiologia intervencionista." },
    { texto: "Útero: massagem e uterotônicos.", so: ["gestante"] },
    { texto: "Via aérea: considerar intubar e subir a FiO2 para manter a SpO2." },
    { texto: "Dois acessos calibrosos; considerar introdutor 8,5 F e linha arterial." },
    { texto: "Aquecer fluidos, sala e paciente; infusor rápido e recuperador de células.",
      detalhe: "Evitar a sobrecarga de cristaloide." },
    { texto: "Hemácias, plasma e plaquetas cedo e na proporção de 1:1:1 ou 2:1:1.",
      detalhe: "Plasma precoce (15 mL/kg) ajuda a evitar a falência da hemostasia e o sangramento microvascular." },
    { texto: "Hipotensão permissiva até o controle: PAM de 65 mmHg ou mais (80 no traumatismo craniano).",
      detalhe: "Vasopressor só para manter a perfusão dos órgãos.", so: ["adulto", "gestante"] },
    { texto: "Ácido tranexâmico cedo." },
    { texto: "Cálcio iônico acima de 1,1 mmol/L: medir e repor." },
    { texto: "Exames em série: Hb, coagulação, fibrinogênio, cálcio, lactato e gasometria; TEG ou ROTEM, se houver.",
      detalhe: "Acompanhar diurese, temperatura e PVC." },
    { texto: "Metas: temperatura acima de 35 °C, pH acima de 7,2, lactato abaixo de 4 mmol/L, Hb acima de 8 g/dL, plaquetas acima de 75 mil, RNI e TP/TTPa abaixo de 1,5, fibrinogênio acima de 1 g/L." },
    { texto: "Sangramento que continua apesar de hemácias, plasma e plaquetas: chamar a hematologia e considerar o fator VIIa.",
      detalhe: "Chamar também se o paciente usa varfarina ou anticoagulante oral direto, ou tem doença hemorrágica hereditária." },
  ],
  medicamentos: [
    {
      id: "tranexamico-hemorragia-adulto", farmaco: "Ácido tranexâmico", indicacao: "Fibrinólise — cedo",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [TRANEXAMICO_50],
      velocidade: "Em 10 minutos.",
      repeticao: "Depois, mais 1 g em 8 horas. Na hemorragia obstétrica, o QRH prevê uma segunda dose de 1 g 30 minutos depois.",
      par: "tranexamico-hemorragia-ped", referencias: ["qrh-3-2", "manual-05"],
    },
    {
      id: "tranexamico-hemorragia-ped", farmaco: "Ácido tranexâmico", indicacao: "Fibrinólise — bolus",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 15, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "g" },
      apresentacoes: [TRANEXAMICO_50],
      repeticao: "Depois, infusão de 2 mg/kg/h até o sangramento parar.",
      par: "tranexamico-hemorragia-adulto", referencias: ["qrh-3-2"],
    },
    {
      id: "tranexamico-infusao-ped", farmaco: "Ácido tranexâmico", indicacao: "Fibrinólise — infusão, depois do bolus",
      populacao: "pediatrico", via: "IV, infusão contínua",
      dose: { usual: 2, unidade: "mg", por: "kg/h" }, apresentacoes: [TRANEXAMICO_50],
      repeticao: "Até o sangramento parar.",
      referencias: ["qrh-3-2"],
    },
    {
      id: "cloreto-de-calcio-hemorragia-adulto", farmaco: "Cloreto de cálcio", indicacao: "Hipocalcemia (alvo acima de 1,1 mmol/L)",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      repeticao: "10 mL da solução a 10%; repetir pelo cálcio iônico.",
      cuidados: [NECROSE], par: "cloreto-de-calcio-hemorragia-ped", referencias: ["qrh-3-2", "manual-05"],
    },
    {
      id: "gluconato-hemorragia-adulto", farmaco: "Gluconato de cálcio", indicacao: "Hipocalcemia (alvo acima de 1,1 mmol/L)",
      populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "fixa" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      repeticao: "20 mL da solução a 10%; repetir pelo cálcio iônico.",
      par: "gluconato-hemorragia-ped", referencias: ["qrh-3-2", "manual-05"],
    },
    {
      id: "cloreto-de-calcio-hemorragia-ped", farmaco: "Cloreto de cálcio", indicacao: "Hipocalcemia (alvo acima de 1,1 mmol/L)",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 20, unidade: "mg", por: "kg" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      repeticao: "0,2 mL/kg da solução a 10%; repetir pelo cálcio iônico.",
      cuidados: [NECROSE], par: "cloreto-de-calcio-hemorragia-adulto", referencias: ["qrh-3-2"],
    },
    {
      id: "gluconato-hemorragia-ped", farmaco: "Gluconato de cálcio", indicacao: "Hipocalcemia (alvo acima de 1,1 mmol/L)",
      populacao: "pediatrico", via: "IV",
      dose: { usual: 50, unidade: "mg", por: "kg" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      repeticao: "0,5 mL/kg da solução a 10%; repetir pelo cálcio iônico.",
      par: "gluconato-hemorragia-adulto", referencias: ["qrh-3-2"],
    },
    {
      id: "fibrinogenio-hemorragia", farmaco: "Concentrado de fibrinogênio", indicacao: "Fibrinogênio abaixo de 1 g/L",
      populacao: "todas", via: "IV",
      dose: { min: 25, max: 50, unidade: "mg", por: "kg" }, apresentacoes: [],
      referencias: ["manual-05"],
    },
    {
      id: "ccp-hemorragia", farmaco: "Concentrado de complexo protrombínico",
      indicacao: "Sem resposta ao tratamento habitual, reversão de varfarina ou sem plasma disponível",
      populacao: "todas", via: "IV",
      dose: { min: 25, max: 50, unidade: "UI", por: "kg" }, apresentacoes: [],
      referencias: ["manual-05"],
    },
    {
      id: "fator-viia-hemorragia", farmaco: "Fator VIIa recombinante",
      indicacao: "Sangramento que continua apesar dos hemocomponentes, com a hematologia",
      populacao: "todas", via: "IV",
      dose: { usual: 90, unidade: "mcg", por: "kg" }, apresentacoes: [],
      referencias: ["manual-05", "qrh-3-2"],
    },
  ],
  volumes: [
    { id: "pfc", rotulo: "Plasma fresco congelado", indicacao: "TP ou TTPa acima de 1,5 vez o normal, ou fibrinogênio abaixo de 1 g/L",
      populacao: "todas", porKg: { min: 15 }, repeticao: "Cedo na hemorragia maciça; a falha da hemostasia instalada pede mais.",
      referencias: ["manual-05", "qrh-3-2"] },
    { id: "crio", rotulo: "Crioprecipitado", indicacao: "Fibrinogênio abaixo de 1 g/L",
      populacao: "todas", unidade: "unidades", porKg: { min: 0.1, max: 0.2 }, repeticao: "1 unidade para cada 5 a 10 kg.",
      referencias: ["manual-05", "qrh-3-2"] },
    { id: "plaquetas", rotulo: "Plaquetas", indicacao: "Contagem abaixo de 75 mil (75 × 10⁹/L)",
      populacao: "todas", porKg: { min: 15, max: 20 },
      repeticao: "No adulto, o banco costuma liberar plaquetas em unidades (aférese ou pool): confirme com ele a dose em volume.",
      referencias: ["manual-05", "qrh-3-2"] },
  ],
  pensarEm: [
    "Sangramento que não se vê: retroperitônio, tórax, abdome na laparoscopia.",
    "Coagulopatia por diluição, consumo (CIVD) ou fibrinólise; anticoagulantes e antiagregantes em uso.",
    "Hipotermia, acidose e hipocalcemia: juntas, impedem a coagulação.",
    "Transfusão rápida: hipercalemia, sobrecarga de volume (TACO) e lesão pulmonar (TRALI).",
    "Reação transfusional hemolítica: hipotensão, hemoglobinúria e sangramento difuso.",
    "Doença hemorrágica hereditária: hemofilia, doença de von Willebrand.",
    "Outra causa de choque ao mesmo tempo: anafilaxia, raqui alta, pneumotórax, tamponamento.",
  ],
  depois: [
    "UTI; manter as metas e repetir os exames até estabilizar.",
    "Avisar o banco de sangue quando o sangramento parar, para encerrar o protocolo de transfusão maciça.",
    "Vigiar TRALI, TACO, hipercalemia, hipotermia e síndrome compartimental abdominal.",
    "Registrar na ficha cada hemocomponente (número da bolsa e horário), os fármacos e os exames.",
    "Fazer a revisão do caso com a equipe.",
  ],
  divergencias: [
    {
      tema: "Dose do ácido tranexâmico no adulto",
      posicoes: [
        { texto: "“1 mg EV por 10 min, depois 1 mg por 8 h” (tabela do protocolo).", referencia: "manual-05" },
        { texto: "1 g IV em bolus; fora da obstetrícia, mais 1 g em 8 horas.", referencia: "qrh-3-2" },
      ],
      escolha: "O protocolo usa 1 g, a dose do QRH e dos ensaios clínicos. O “1 mg” do Manual parece erro de impressão (mil vezes menos): o revisor confirma.",
    },
    {
      tema: "Meta de excesso de base",
      posicoes: [
        { texto: "“BE < −6” entre as metas da hemorragia.", referencia: "manual-05" },
      ],
      escolha: "Como meta, BE abaixo de −6 seria acidose pior. O protocolo deixou o BE fora das metas (usa pH e lactato) até o revisor confirmar o sentido — provavelmente BE acima de −6.",
    },
    {
      tema: "Dose de plaquetas",
      posicoes: [
        { texto: "15 a 20 mL/kg, com contagem abaixo de 75 × 10⁹/L.", referencia: "manual-05" },
        { texto: "Manter as plaquetas acima de 75 × 10⁹/L, sem dose definida.", referencia: "qrh-3-2" },
      ],
      escolha: "O protocolo calcula pelo Manual. No adulto, 15 a 20 mL/kg passa de 1 litro: o revisor confirma, e o banco de sangue define a unidade.",
    },
  ],
  referencias: ["manual-05", "qrh-3-2"],
};
