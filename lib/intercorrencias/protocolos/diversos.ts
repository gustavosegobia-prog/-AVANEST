/**
 * TOXICIDADE SISTÊMICA POR ANESTÉSICOS LOCAIS, HIPERCALEMIA E HIPERTERMIA
 * MALIGNA — cartões 22 a 24 da minuta de validação de 15/10/2026.
 *
 * Base: Manual de Crises (abas 20 a 22) e Tratado SAESP (cap. 143, toxicidade
 * pediátrica; cap. 221, hipertermia maligna). Atualizações: checklist ASRA
 * 2020 e QRH 3-10 v2 (anestésico local), UK Kidney Association 2023 e alerta
 * MHRA 2023 (hipercalemia do adulto), MHAUS (hipertermia maligna). O teto
 * pediátrico do lipídio é uma escolha explícita (10 mL/kg, Tratado SAESP), e
 * não consenso entre fontes. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import {
  ADRENALINA_10, CLORETO_DE_CALCIO_10, DANTROLENO_20, DANTROLENO_250, GLICOSE_10, GLICOSE_50, GLUCONATO_DE_CALCIO_10,
  INSULINA_1, MIDAZOLAM_1, SALBUTAMOL_NEBULIZACAO,
} from "./comum.ts";

const LIPIDIO = "Emulsão lipídica 20%";

export const TOXICIDADE_AL: Protocolo = {
  id: "toxicidade-anestesico-local",
  titulo: "Toxicidade sistêmica por anestésicos locais",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["LAST", "toxicidade por anestésico local", "intoxicação por anestésico local", "emulsão lipídica", "intralipid"],
  sinais: ["convulsão", "gosto metálico", "zumbido", "agitação", "perda da consciência", "arritmia", "bradicardia", "QRS largo",
    "hipotensão", "parada", "depois do bloqueio"],
  resumo: "Parar o anestésico local, oxigenar e controlar a convulsão, emulsão lipídica 20% cedo na toxicidade grave e adrenalina em doses menores; ECMO se refratária.",
  reconhecer: [
    "Convulsão, alteração neurológica, bloqueio, arritmia ou colapso depois de anestésico local.",
    "Pode ser tardia, ou só cardiovascular sob anestesia.",
  ],
  agirAgora: [
    { texto: "Parar o anestésico local, inclusive a bomba; chamar ajuda, o kit de resgate e a equipe de suporte extracorpóreo, se grave." },
    { texto: "O2, ventilação adequada e controle da convulsão, evitando hipóxia, hipercapnia e acidemia." },
    { texto: "Iniciar a emulsão lipídica 20% cedo na toxicidade grave.", detalhe: "Sem pulso: RCP com as adaptações da toxicidade por anestésico local." },
    { texto: "Adrenalina em doses menores; evitar vasopressina, bloqueadores beta e de canal de cálcio e novos anestésicos locais." },
    { texto: "Persistir no suporte e considerar ECMO ou circulação extracorpórea se refratária." },
  ],
  medicamentos: [
    {
      id: "adrenalina-last", farmaco: "Adrenalina", indicacao: "Iniciar abaixo deste valor e titular", populacao: "todas", via: "IV",
      dose: { max: 1, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_10], altoRisco: true,
      cuidados: [
        "O número é o limite de cima do início: começar com menos de 1 mcg/kg.",
        "Não dar automaticamente 1 mg do algoritmo de PCR.",
      ],
      referencias: ["asra-2020-last"],
    },
    {
      id: "midazolam-last", farmaco: "Midazolam", indicacao: "Convulsão — dose inicial", populacao: "todas", via: "IV",
      dose: { usual: 0.05, unidade: "mg", por: "kg" }, apresentacoes: [MIDAZOLAM_1],
      repeticao: "Titular em pequenas doses.",
      cuidados: ["Evitar depressão hemodinâmica por grandes doses de propofol."],
      referencias: ["manual-20", "asra-2020-last"],
    },
  ],
  volumes: [
    { id: "lipidio-bolus", grupo: LIPIDIO, rotulo: "Bolus", indicacao: "Em 2 a 3 minutos; a partir de 70 kg, cerca de 100 mL. Instável: repetir",
      populacao: "todas", porKg: { min: 1.5 }, maximo: 100, referencias: ["asra-2020-last", "qrh-3-10"] },
    { id: "lipidio-infusao", grupo: LIPIDIO, rotulo: "Infusão — abaixo de 70 kg", indicacao: "0,25 mL/kg/min. Instável: dobrar",
      populacao: "todas", unidade: "mL/h", porKg: { min: 15 }, referencias: ["asra-2020-last", "qrh-3-10"] },
    { id: "lipidio-infusao-70", grupo: LIPIDIO, rotulo: "Infusão — 70 kg ou mais", indicacao: "Em 15 a 20 minutos (estratégia ASRA aproximada)",
      populacao: "adulto", fixo: { min: 250 }, referencias: ["asra-2020-last"] },
    { id: "lipidio-teto-adulto", grupo: LIPIDIO, rotulo: "Máximo acumulado — adulto", indicacao: "Somando bolus e infusão",
      populacao: "adulto", porKg: { min: 12 }, referencias: ["asra-2020-last", "qrh-3-10"] },
    { id: "lipidio-teto-ped", grupo: LIPIDIO, rotulo: "Máximo acumulado — criança", indicacao: "Somando bolus e infusão; escalonar só com especialista",
      populacao: "pediatrico", porKg: { min: 10 }, referencias: ["saesp-tratado"] },
  ],
  notasDeDose: [
    "Não aplicar teto silencioso de 20 g de lipídio.",
    "Teto do lipídio: ASRA e QRH, 12 mL/kg; Tratado SAESP pediátrico, 10 mL/kg. Nesta versão, criança com teto de 10 mL/kg, com especialista para decidir o escalonamento; não alternar tetos durante o cálculo.",
  ],
  pensarEm: ["Raqui alta, anafilaxia, reação vasovagal, hipoglicemia, eclâmpsia e arritmia primária."],
  depois: [
    "Manter o lipídio por mais de 15 minutos depois da estabilidade, respeitando o teto e a avaliação.",
    "Observação conforme a gravidade: pelo menos 2 horas depois de convulsão isolada; 4 a 6 horas depois de instabilidade, e mais depois de PCR.",
    "Registrar a dose acumulada de anestésico local e de lipídio e investigar complicações.",
    "Não exibir “máximos seguros” universais de anestésico local no cartão de crise.",
  ],
  divergencias: [
    {
      tema: "Teto da emulsão lipídica",
      posicoes: [
        { texto: "“Dose cumulativa máxima 8–12 mg/kg”.", referencia: "manual-20" },
        { texto: "Máximo de 12 mL/kg.", referencia: "asra-2020-last" },
        { texto: "Criança: máximo de 10 mL/kg.", referencia: "saesp-tratado" },
      ],
      escolha: "Adulto: 12 mL/kg (ASRA e QRH; o “mg/kg” do Manual parece erro, pois o regime é em mL). Criança: 10 mL/kg (Tratado SAESP), com especialista para escalonar; não alternar tetos durante o cálculo.",
    },
  ],
  referencias: ["manual-20", "saesp-tratado", "asra-2020-last", "qrh-3-10"],
  relacionados: [
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" },
  ],
};

export const HIPERCALEMIA: Protocolo = {
  id: "hipercalemia",
  titulo: "Hipercalemia",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["potássio alto", "hiperpotassemia", "K alto"],
  sinais: ["onda T apiculada", "QRS largo", "bradicardia", "arritmia", "potássio alto", "sinusoide", "depois da succinilcolina"],
  resumo: "ECG alterado ou instabilidade: cálcio para proteger o coração, insulina com glicose para deslocar o potássio e nefrologia cedo; o cálcio não reduz o K.",
  reconhecer: [
    "Potássio elevado, sobretudo 6,5 mmol/L ou mais, subida rápida, alterações de ECG ou instabilidade.",
    "ECG normal não exclui risco; repetir a amostra se suspeita de hemólise, sem atrasar o tratamento grave.",
  ],
  agirAgora: [
    { texto: "Monitorizar e suspender a administração evitável de potássio; rever a causa.",
      detalhe: "Não interromper a transfusão salvadora apenas por ser sangue estocado." },
    { texto: "Alteração de ECG ou instabilidade: cálcio.", detalhe: "Em paralelo, insulina com glicose e medidas de deslocamento intracelular." },
    { texto: "Acionar a nefrologia cedo se doença renal grave, diálise ou refratariedade.",
      detalhe: "As medidas de deslocamento não eliminam o potássio." },
    { texto: "Reavaliar ECG, potássio e glicemia; antecipar rebote e hipoglicemia. Corrigir a causa." },
  ],
  medicamentos: [
    {
      id: "cloreto-de-calcio-hipercalemia", farmaco: "Cloreto de cálcio 10%", indicacao: "ECG alterado ou instabilidade — especialmente peri-PCR",
      populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      velocidade: "Em 5 minutos.", repeticao: "Repetir guiado pelo ECG.",
      cuidados: ["Protege o miocárdio e não reduz o potássio.", "Nunca misturar cálcio e bicarbonato na mesma solução."],
      par: "cloreto-de-calcio-hipercalemia-ped",
      referencias: ["manual-21", "ukka-2023-hipercalemia"],
    },
    {
      id: "gluconato-hipercalemia", farmaco: "Gluconato de cálcio 10%", indicacao: "Alternativa, em acesso apropriado",
      populacao: "adulto", via: "IV",
      dose: { usual: 3, unidade: "g", por: "fixa" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      velocidade: "Em 10 minutos.", repeticao: "Repetir guiado pelo ECG.",
      cuidados: ["Protege o miocárdio e não reduz o potássio."],
      par: "gluconato-hipercalemia-ped",
      referencias: ["ukka-2023-hipercalemia", "mhra-2023-gluconato"],
    },
    {
      id: "cloreto-de-calcio-hipercalemia-ped", farmaco: "Cloreto de cálcio 10%", indicacao: "ECG alterado ou instabilidade",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 20, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 1, unidade: "g" }, apresentacoes: [CLORETO_DE_CALCIO_10],
      cuidados: ["Monitorizar.", "Protege o miocárdio e não reduz o potássio."],
      par: "cloreto-de-calcio-hipercalemia",
      referencias: ["manual-21"],
    },
    {
      id: "gluconato-hipercalemia-ped", farmaco: "Gluconato de cálcio 10%", indicacao: "Alternativa",
      populacao: "pediatrico", via: "IV ou IO",
      dose: { usual: 100, unidade: "mg", por: "kg" }, tetoAbsoluto: { valor: 3, unidade: "g" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      cuidados: ["Monitorizar."],
      par: "gluconato-hipercalemia",
      referencias: ["manual-21"],
    },
    {
      id: "insulina-hipercalemia", farmaco: "Insulina regular", indicacao: "Com 25 g de glicose", populacao: "adulto", via: "IV",
      dose: { usual: 10, unidade: "UI", por: "fixa" }, apresentacoes: [INSULINA_1], altoRisco: true,
      cuidados: ["Alta vigilância: conferir o preparo e fazer dupla checagem."],
      par: "insulina-hipercalemia-ped",
      referencias: ["manual-21", "ukka-2023-hipercalemia"],
    },
    {
      id: "insulina-hipercalemia-ped", farmaco: "Insulina regular", indicacao: "Associada à glicose", populacao: "pediatrico", via: "IV",
      dose: { usual: 0.1, unidade: "UI", por: "kg" }, tetoAbsoluto: { valor: 10, unidade: "UI" }, apresentacoes: [INSULINA_1], altoRisco: true,
      cuidados: ["Alta vigilância: conferir o preparo e fazer dupla checagem."],
      par: "insulina-hipercalemia",
      referencias: ["manual-21"],
    },
    {
      id: "glicose-hipercalemia", farmaco: "Glicose", indicacao: "Junto com a insulina", populacao: "adulto", via: "IV",
      dose: { usual: 25, unidade: "g", por: "fixa" }, apresentacoes: [GLICOSE_50],
      cuidados: ["Formulação e acesso seguros."],
      par: "glicose-hipercalemia-ped",
      referencias: ["manual-21", "ukka-2023-hipercalemia"],
    },
    {
      id: "glicose-hipercalemia-ped", farmaco: "Glicose", indicacao: "Junto com a insulina", populacao: "pediatrico", via: "IV",
      dose: { usual: 0.5, unidade: "g", por: "kg" }, tetoAbsoluto: { valor: 25, unidade: "g" }, apresentacoes: [GLICOSE_10, GLICOSE_50],
      cuidados: ["Preferir a diluição adequada à idade e ao acesso: a 10%, 5 mL/kg."],
      par: "glicose-hipercalemia",
      referencias: ["manual-21"],
    },
    {
      id: "salbutamol-hipercalemia", farmaco: "Salbutamol", indicacao: "Adjuvante, não monoterapia", populacao: "adulto", via: "Inalatória",
      dose: { min: 10, max: 20, unidade: "mg", por: "fixa" }, apresentacoes: [SALBUTAMOL_NEBULIZACAO],
      referencias: ["ukka-2023-hipercalemia"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Bicarbonato não é rotina; avaliar a acidose e a indicação.",
    "Insulina a 1 UI/mL: a dose em UI é o volume em mL.",
    "Criança: doses da base do Manual, com validação pediátrica por idade e acesso; o regime da criança não vem da UKKA, que é do adulto. Salbutamol por regime pediátrico específico, sem extrapolar a dose adulta.",
  ],
  pensarEm: [
    "Insuficiência renal, acidose, succinilcolina em paciente de risco, rabdomiólise ou hipertermia maligna, reperfusão, fármacos e transfusão.",
  ],
  depois: [
    "Adulto: glicemia em 0, 30, 60, 90, 120, 180, 240, 300 e 360 minutos depois da insulina.",
    "Adulto: potássio ao menos em 1, 2, 4, 6 e 24 horas, mais cedo se instável.",
    "Criança: vigilância individualizada e intensiva.",
    "Diálise urgente quando indicada.",
  ],
  divergencias: [
    {
      tema: "Gluconato de cálcio no adulto",
      posicoes: [
        { texto: "15 a 30 mL a 10%.", referencia: "manual-21" },
        { texto: "30 mL a 10% na hipercalemia grave: doses menores ficam abaixo do necessário.", referencia: "mhra-2023-gluconato" },
      ],
      escolha: "O protocolo usa 30 mL (3 g) em 10 minutos.",
    },
    {
      tema: "Glicose com a insulina no adulto",
      posicoes: [{ texto: "10 unidades, com 25 a 50 mL de glicose a 50%.", referencia: "manual-21" }],
      escolha: "O protocolo usa 25 g de glicose (50 mL a 50%), com a monitorização da UKKA 2023.",
    },
  ],
  referencias: ["manual-21", "ukka-2023-hipercalemia", "mhra-2023-gluconato"],
  relacionados: [
    { protocolo: "hipertermia-maligna", texto: "Hipertermia maligna" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
  ],
};

export const HIPERTERMIA_MALIGNA: Protocolo = {
  id: "hipertermia-maligna",
  titulo: "Hipertermia maligna",
  categoria: "medicamentos",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["HM", "crise de hipertermia maligna", "dantroleno", "dantrolene"],
  sinais: ["EtCO2 subindo", "espasmo de masseter", "trismo", "taquicardia", "arritmia", "rigidez", "temperatura subindo",
    "acidose", "potássio alto", "urina escura", "CK alta"],
  resumo: "Suspender os desencadeantes, hiperventilar com O2 a 100% e dantroleno 2,5 mg/kg rápido, repetido até a resposta; resfriar acima de 39 °C.",
  reconhecer: [
    "EtCO2 inexplicavelmente crescente, rigidez ou espasmo de masseter, taquicardia e acidose; a febre pode ser tardia.",
    "Desencadeantes: halogenados e succinilcolina.",
  ],
  agirAgora: [
    { texto: "Chamar ajuda e a caixa de hipertermia maligna; equipe dedicada ao dantroleno." },
    { texto: "Suspender halogenados e succinilcolina; retirar ou desativar o vaporizador.",
      detalhe: "Encerrar a cirurgia se possível, ou manter anestesia não desencadeante." },
    { texto: "O2 a 100%, fluxo de 10 L/min ou mais e hiperventilação.", detalhe: "Carvão ativado quando disponível, sem atrasar o fármaco." },
    { texto: "Dantroleno rápido; repetir conforme a resposta.", detalhe: "Sem espera obrigatória de 10 a 15 minutos." },
    { texto: "Temperatura central acima de 39 °C ou subida rápida: resfriar.", detalhe: "Parar o resfriamento ao cair abaixo de 38 °C." },
    { texto: "Tratar hipercalemia, acidose e arritmia; monitorizar temperatura, gases, potássio, CK, coagulação e diurese. UTI." },
  ],
  medicamentos: [
    {
      id: "dantroleno-inicial", farmaco: "Dantroleno", indicacao: "Dose inicial", populacao: "todas", via: "IV",
      dose: { usual: 2.5, unidade: "mg", por: "kg" }, apresentacoes: [DANTROLENO_20, DANTROLENO_250],
      repeticao: "Repetir até a resposta, revendo o diagnóstico se refratária.",
      referencias: ["manual-22", "mhaus-crise"],
    },
    {
      id: "dantroleno-manutencao", farmaco: "Dantroleno", indicacao: "Manutenção", populacao: "todas", via: "IV",
      dose: { usual: 1, unidade: "mg", por: "kg" }, apresentacoes: [DANTROLENO_20, DANTROLENO_250],
      repeticao: "A cada 4 a 6 horas por pelo menos 24 horas; reavaliar.",
      referencias: ["mhaus-dantroleno"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Formulação de 250 mg em 5 mL: a mesma massa prescrita, apenas se essa apresentação estiver disponível; não usar diluente nem preparo de outro produto.",
    "Monitorar o volume e o manitol das formulações.",
    "Evitar bloqueadores de canal de cálcio com o dantroleno; o cálcio para a hipercalemia não é bloqueador de canal de cálcio.",
    "Corrigir acidose e potássio antes de antiarrítmicos, quando possível.",
  ],
  pensarEm: [
    "Reinalação, hipoventilação, insuflação de CO2, sepse, tireotoxicose, síndrome neuroléptica maligna e aquecimento excessivo.",
  ],
  depois: [
    "UTI por 24 horas ou mais, com manutenção e vigilância de recrudescência e rabdomiólise.",
    "Encaminhar a investigação, orientar a família e documentar o alerta de desencadeantes.",
  ],
  divergencias: [
    {
      tema: "Repetição do dantroleno",
      posicoes: [{ texto: "2,5 mg/kg, repetindo a cada 10 a 15 minutos até a crise passar.", referencia: "manual-22" }],
      escolha: "O protocolo repete conforme a resposta, sem espera obrigatória de 10 a 15 minutos (MHAUS).",
    },
  ],
  referencias: ["manual-22", "saesp-tratado", "mhaus-crise", "mhaus-dantroleno"],
  relacionados: [
    { protocolo: "hipercalemia", texto: "Hipercalemia" },
    { protocolo: "aumento-etco2", texto: "Aumento do CO2 expirado" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
  ],
};
