/**
 * OBSTETRÍCIA — cartões 25 a 27 da minuta de validação de 15/10/2026:
 * bloqueio raquidiano alto ou total, hemorragia pós-parto e colapso materno.
 *
 * Base: Manual de Crises (abas 16 a 18) e Tratado SAESP (cap. 131,
 * hemorragia obstétrica; cap. 203, reanimação materna). Atualizações: QRH
 * 3-11 (bloqueio alto), OMS 2017 (ácido tranexâmico na HPP), AHA 2025 (PCR na
 * gestante) e Ministério da Saúde 2022 (magnésio). A dose de ocitocina de
 * TRATAMENTO é pendência de homologação com a obstetrícia: nenhum bolus
 * universal é inventado aqui. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import {
  ADRENALINA_10, ATROPINA_05, EFEDRINA_5, FENILEFRINA_100, GLUCONATO_DE_CALCIO_10, MAGNESIO_20MG, MAGNESIO_50,
  METILERGOMETRINA_02, TRANEXAMICO_50,
} from "./comum.ts";

export const RAQUI_TOTAL: Protocolo = {
  id: "bloqueio-neuroaxial-alto",
  titulo: "Bloqueio raquidiano alto ou total",
  categoria: "obstetricia",
  populacoes: ["adulto", "gestante"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["raqui total", "raqui alta", "bloqueio neuroaxial alto", "peridural total", "injeção subaracnóidea acidental"],
  sinais: ["hipotensão", "bradicardia", "dispneia", "não consegue falar", "mãos dormentes", "fraqueza nos braços", "apneia",
    "perda da consciência", "depois da raqui", "depois da peridural"],
  resumo: "Parar o neuroeixo, O2, ventilação e vasopressor em paralelo; via aérea com hipnose ajustada à hemodinâmica e suporte até o bloqueio regredir, sem consciência durante a paralisia.",
  reconhecer: [
    "Bloqueio ascendente, fraqueza de mãos e braços, dificuldade de falar ou de ventilar, hipotensão e bradicardia; pode evoluir para apneia e inconsciência.",
    "Paralisia não garante inconsciência.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda e interromper a administração neuraxial. Comunicar-se com o paciente." },
    { texto: "O2, ventilação, vasopressor e reposição indicada, em paralelo." },
    { texto: "Gestante: aliviar a compressão aortocava.", so: ["gestante"] },
    { texto: "Evitar cabeça baixa como manobra automática para elevar a PA." },
    { texto: "Comprometimento ventilatório ou da consciência: garantir a via aérea com hipnose individualizada à hemodinâmica.",
      detalhe: "Não usar “apenas relaxante” por rotina." },
    { texto: "Bradicardia: atropina e escalonamento; sem pulso, PCR." },
    { texto: "Gestante com indicação de parto ressuscitativo: protocolo de colapso materno.", so: ["gestante"] },
    { texto: "Suporte até a regressão do bloqueio; evitar consciência durante a paralisia." },
  ],
  medicamentos: [
    {
      id: "atropina-raqui", farmaco: "Atropina", indicacao: "Bradicardia instável", populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "mg", por: "fixa" }, apresentacoes: [ATROPINA_05],
      repeticao: "A cada 3 a 5 minutos; máximo de 3 mg.",
      referencias: ["aha-2025-acls-bradicardia"],
    },
    {
      id: "fenilefrina-raqui", farmaco: "Fenilefrina", indicacao: "Hipotensão — titular", populacao: "adulto", via: "IV",
      dose: { min: 50, max: 100, unidade: "mcg", por: "fixa" }, apresentacoes: [FENILEFRINA_100],
      cuidados: ["Considerar a FC e o débito."],
      referencias: ["manual-16", "qrh-3-11"],
    },
    {
      id: "efedrina-raqui", farmaco: "Efedrina", indicacao: "Hipotensão — reavaliar", populacao: "adulto", via: "IV",
      dose: { usual: 6, unidade: "mg", por: "fixa" }, apresentacoes: [EFEDRINA_5],
      cuidados: ["Conferir a apresentação."],
      referencias: ["manual-16", "qrh-3-11"],
    },
    {
      id: "adrenalina-raqui", farmaco: "Adrenalina", indicacao: "Com pulso e refratariedade — bolus titulados por equipe experiente",
      populacao: "adulto", via: "IV",
      dose: { min: 10, max: 20, unidade: "mcg", por: "fixa" }, apresentacoes: [ADRENALINA_10], altoRisco: true,
      cuidados: ["Com monitorização.", "Na PCR: 1 mg, e não pequeno bolus."],
      referencias: ["qrh-3-11"],
    },
  ],
  volumes: [],
  pensarEm: ["Hemorragia, reação vasovagal, anafilaxia, toxicidade por anestésico local, embolia e compressão aortocava."],
  depois: [
    "Monitorização ou UTI conforme o suporte.",
    "Registrar técnica, dose, nível, evolução e possível consciência. Conversar com o paciente.",
  ],
  divergencias: [
    {
      tema: "Bolus de efedrina",
      posicoes: [{ texto: "12 a 15 mg.", referencia: "manual-16" }],
      escolha: "O protocolo usa 6 mg e reavalia, considerando a FC e o débito.",
    },
  ],
  referencias: ["manual-16", "qrh-3-11", "aha-2025-acls-bradicardia"],
  relacionados: [
    { protocolo: "colapso-materno", texto: "Colapso materno" },
    { protocolo: "bradicardia", texto: "Bradicardia grave" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local" },
  ],
};

export const HEMORRAGIA_POS_PARTO: Protocolo = {
  id: "hemorragia-pos-parto",
  titulo: "Hemorragia pós-parto",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["HPP", "atonia uterina", "hemorragia puerperal", "hemorragia obstétrica"],
  sinais: ["sangramento", "útero amolecido", "atonia", "PA caindo", "taquicardia", "depois do parto", "cesárea"],
  resumo: "Quantificar a perda e agir em paralelo: massagem, uterotônico, ácido tranexâmico precoce, ressuscitação e a fonte (4 Ts); fibrinogênio para 2 g/L ou mais.",
  reconhecer: [
    "Perda acumulada quantificada e/ou repercussão, inclusive sangramento oculto.",
    "Não esperar hipotensão ou queda da Hb para agir.",
  ],
  agirAgora: [
    { texto: "Mobilizar obstetrícia, anestesia e hemoterapia.", detalhe: "Quantificar as perdas; dois acessos, aquecimento e exames." },
    { texto: "Ações simultâneas: massagem ou compressão se atonia, uterotônico, ácido tranexâmico precoce, ressuscitação e avaliação da fonte." },
    { texto: "Investigar os 4 Ts: tônus, trauma, tecido e trombina.", detalhe: "Não atrasar o controle mecânico ou cirúrgico se a farmacologia falha." },
    { texto: "Cristaloide com reavaliação; hemocomponentes sem atraso quando indicados.", detalhe: "Sem teto de 3.500 mL a cumprir." },
    { texto: "Corrigir coagulopatia, fibrinogênio para 2 g/L ou mais, cálcio e temperatura.",
      detalhe: "Balão, cirurgia ou intervenção conforme a causa e os recursos; não adiar a histerectomia salvadora." },
  ],
  medicamentos: [
    {
      id: "metilergometrina-hpp", farmaco: "Metilergometrina", indicacao: "Uterotônico de segunda linha", populacao: "adulto", via: "IM",
      dose: { usual: 0.2, unidade: "mg", por: "fixa" }, apresentacoes: [METILERGOMETRINA_02],
      repeticao: "Segunda dose depois de 20 minutos ou mais, se necessário; as seguintes a cada 4 horas na hemorragia grave; máximo de 1 mg em 24 horas.",
      cuidados: ["Evitar na hipertensão, na pré-eclâmpsia e na doença cardíaca."],
      referencias: ["manual-17", "saesp-tratado"],
    },
    {
      id: "misoprostol-hpp", farmaco: "Misoprostol", indicacao: "Adjuvante — regime SAESP", populacao: "adulto", via: "Retal",
      dose: { usual: 800, unidade: "mcg", por: "fixa" }, apresentacoes: [],
      semVolume: "Em comprimidos de 200 mcg: 4 comprimidos",
      cuidados: ["Não esperar o efeito para escalar o controle.", "Vias oral, retal e sublingual não são equivalentes."],
      referencias: ["saesp-tratado"],
    },
    {
      id: "tranexamico-hpp", farmaco: "Ácido tranexâmico", indicacao: "O mais cedo possível, até 3 horas do nascimento", populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [TRANEXAMICO_50],
      velocidade: "Em 10 minutos, com diluição compatível.",
      repeticao: "Repetir 1 g se persiste depois de 30 minutos ou se recomeça em 24 horas.",
      referencias: ["manual-17", "oms-2017-txa"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Ocitocina: primeira linha. Dose e velocidade conforme o protocolo de TRATAMENTO do serviço, a exposição prévia e a hemodinâmica; regime a homologar com a obstetrícia.",
    "Não copiar o bolus de profilaxia da cesárea como tratamento universal. Manutenção em bomba; evitar bolus IV rápido.",
  ],
  pensarEm: ["Atonia, laceração ou rotura, restos ou acretismo, CIVD e embolia amniótica."],
  depois: [
    "Reavaliar perda, coagulação, perfusão, destino e anemia.",
    "Registrar componentes, intervenções e comunicação.",
  ],
  divergencias: [
    {
      tema: "Uterotônico derivado do ergot",
      posicoes: [{ texto: "“Ergotamina” 500 mcg IM ou EV lento; ou 250 mcg IM ou EV em 5 minutos, até 1 mg.", referencia: "manual-17" }],
      escolha: "A dose do Manual é a da ergometrina (ergotamina é outro fármaco). O protocolo usa a metilergometrina, disponível no Brasil: 0,2 mg IM, até 1 mg em 24 horas.",
    },
    {
      tema: "Infusão de ocitocina",
      posicoes: [{ texto: "Bolus de 5 UI e infusão de 10 UI por hora.", referencia: "manual-17" }],
      escolha: "Pendente de homologação: o protocolo não fixa um bolus universal; o regime de tratamento é o do serviço, com a obstetrícia.",
    },
    {
      tema: "Volume de cristaloide",
      posicoes: [{ texto: "Cristaloide aquecido até 3,5 litros enquanto espera o sangue.", referencia: "manual-17" }],
      escolha: "Sem teto de 3.500 mL a cumprir: cristaloide com reavaliação e hemocomponentes sem atraso quando indicados.",
    },
    {
      tema: "Dose de misoprostol",
      posicoes: [{ texto: "400 a 1.000 mcg retal ou sublingual.", referencia: "manual-17" }],
      escolha: "O protocolo usa o regime SAESP: 800 mcg retal, como adjuvante.",
    },
  ],
  referencias: ["manual-17", "saesp-tratado", "oms-2017-txa"],
  relacionados: [
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "colapso-materno", texto: "Colapso materno" },
  ],
};

export const COLAPSO_MATERNO: Protocolo = {
  id: "colapso-materno",
  titulo: "Colapso materno e PCR na gestante",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["colapso materno", "PCR na gestante", "parada na gestante", "cesárea perimortem", "parto ressuscitativo", "eclâmpsia", "convulsão na gestante"],
  sinais: ["inconsciente", "sem pulso", "convulsão", "hipotensão", "dessaturação", "gestante", "parada"],
  resumo: "RCP de qualidade com deslocamento uterino e parto ressuscitativo preparado desde o reconhecimento; sem retorno, nascimento em até 5 minutos, no local.",
  reconhecer: [
    "Colapso com pulso exige suporte da causa; sem pulso, PCR.",
    "Fundo uterino na altura do umbigo ou acima indica compressão aortocava relevante, independentemente da estimativa imprecisa de semanas.",
  ],
  agirAgora: [
    { texto: "Ativar a equipe materna, o obstetra e a neonatologia; RCP de qualidade e desfibrilação quando indicada." },
    { texto: "Decúbito dorsal para as compressões, com deslocamento manual do útero para a esquerda quando indicado.",
      detalhe: "Via aérea por operador experiente." },
    { texto: "Acesso de preferência acima do diafragma; retirar os monitores fetais. Tratar a causa." },
    { texto: "Preparar o parto ressuscitativo desde o reconhecimento.",
      detalhe: "Se indicado e sem retorno da circulação, nascimento em até 5 minutos, no local, sem atraso para transferência." },
    { texto: "Em infusão de magnésio na PCR: interromper e considerar cálcio conforme o contexto.",
      detalhe: "Reanimação neonatal em paralelo, depois do nascimento." },
  ],
  medicamentos: [
    {
      id: "magnesio-ataque", farmaco: "Sulfato de magnésio", indicacao: "Eclâmpsia com pulso — ataque", populacao: "adulto", via: "IV",
      dose: { usual: 4, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_50],
      velocidade: "Em 20 a 30 minutos.",
      cuidados: ["A 50%, 4 g são 8 mL: diluir para a administração segura."],
      referencias: ["ms-2022-alto-risco"],
    },
    {
      id: "magnesio-manutencao", farmaco: "Sulfato de magnésio", indicacao: "Eclâmpsia — manutenção", populacao: "adulto", via: "IV",
      dose: { min: 1, max: 2, unidade: "g", por: "h" }, apresentacoes: [MAGNESIO_20MG],
      cuidados: ["Ajustar na disfunção renal; monitorar frequência respiratória, reflexos e diurese."],
      referencias: ["ms-2022-alto-risco"],
    },
    {
      id: "magnesio-recorrencia", farmaco: "Sulfato de magnésio", indicacao: "Recorrência da convulsão — adicional, com avaliação", populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_50],
      cuidados: ["Diluir para a administração segura."],
      referencias: ["ms-2022-alto-risco"],
    },
    {
      id: "gluconato-intoxicacao-magnesio", farmaco: "Gluconato de cálcio 10%", indicacao: "Intoxicação por magnésio, com suporte ventilatório",
      populacao: "adulto", via: "IV lento",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      referencias: ["ms-2022-alto-risco"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Na PCR, as mesmas doses e energias do adulto: protocolos de PCR.",
    "Magnésio não substitui o tratamento da hipertensão grave.",
  ],
  pensarEm: ["Hemorragia, anestesia, embolias, cardiopatia, eclâmpsia ou HELLP, sepse, fármacos e as causas gerais de PCR."],
  depois: [
    "UTI e equipe neonatal.",
    "Registrar a cronologia da PCR, do nascimento e do retorno da circulação; apoio à família e revisão da equipe.",
  ],
  divergencias: [
    {
      tema: "Quando fazer o parto ressuscitativo",
      posicoes: [
        { texto: "Gestação acima de 24 semanas e sem retorno da circulação: parto depois de 4 minutos.", referencia: "manual-18" },
        { texto: "Fundo uterino na altura do umbigo ou acima; preparar desde o reconhecimento.", referencia: "aha-2025-pcr-gestante" },
      ],
      escolha: "O protocolo usa a altura do fundo uterino e prepara o parto desde o reconhecimento, com nascimento em até 5 minutos se indicado.",
    },
    {
      tema: "Tempo do ataque de magnésio",
      posicoes: [
        { texto: "Ataque de 4 g em 15 minutos; 1 g/h por 24 horas; 2 g se as convulsões persistirem.", referencia: "manual-18" },
        { texto: "Leitura do cadastro anterior: ataque de 4 g EV em 5 a 10 minutos, manutenção de 1 a 2 g/h, nova convulsão 2 g.", referencia: "ms-2022-alto-risco" },
      ],
      escolha: "O protocolo segue a minuta de 15/10/2026: 4 g em 20 a 30 minutos e 1 a 2 g/h. As fontes diferem no tempo do ataque: conferir com o protocolo obstétrico do serviço.",
    },
  ],
  referencias: ["manual-18", "saesp-tratado", "aha-2025-pcr-gestante", "ms-2022-alto-risco"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
    { protocolo: "hemorragia-pos-parto", texto: "Hemorragia pós-parto" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" },
    { protocolo: "reanimacao-neonatal", texto: "Reanimação neonatal" },
  ],
};
