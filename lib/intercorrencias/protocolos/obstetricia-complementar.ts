/**
 * OBSTETRÍCIA — cartões 09 a 11 da minuta preliminar “Protocolos de crise”
 * (outubro de 2026, para validação médica): eclâmpsia, embolia amniótica e
 * via aérea difícil na gestante.
 *
 * Base: Tratado SAESP (cap. 130 e os capítulos de via aérea e reanimação
 * materna). Atualizações: NICE NG133 (eclâmpsia), SMFM 2026 (lista de
 * verificação da embolia amniótica), OAA/DAS 2015 (via aérea obstétrica). O
 * tempo do ataque de magnésio difere entre as fontes e do cartão Colapso
 * materno: a divergência fica registrada no cartão. O texto é do AVANEST.
 * Versão 1, sem aprovação registrada até a validação.
 */

import type { Protocolo } from "../tipos.ts";
import { GLUCONATO_DE_CALCIO_10, MAGNESIO_50, MAGNESIO_SAESP_124 } from "./comum.ts";

export const ECLAMPSIA: Protocolo = {
  id: "eclampsia",
  titulo: "Eclâmpsia",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["convulsão na gestante", "convulsão na puérpera", "sulfato de magnésio", "magnésio", "pré-eclâmpsia grave", "HELLP"],
  sinais: ["convulsão", "gestante", "puérpera", "hipertensão", "cefaleia", "escotomas", "rebaixamento"],
  resumo: "Convulsão em gestante ou puérpera com doença hipertensiva: proteger e oxigenar, sulfato de magnésio (4 g de ataque e 1 g/h), tratar a hipertensão grave e programar o parto depois de estabilizar.",
  reconhecer: [
    "Convulsão em gestante ou puérpera com doença hipertensiva da gestação.",
    "Pode ocorrer sem hipertensão grave.",
  ],
  agirAgora: [
    { texto: "Chamar anestesia, obstetrícia e UTI." },
    { texto: "Proteger a paciente e posicionar em decúbito lateral." },
    { texto: "Via aérea, oxigênio e ventilação." },
    { texto: "Sulfato de magnésio: ataque e manutenção.", detalhe: "É o anticonvulsivante da eclâmpsia: não trocar por benzodiazepínico nem fenitoína." },
    { texto: "Hipertensão grave: tratar pelo protocolo obstétrico." },
    { texto: "Exames: hemograma com plaquetas, função renal, enzimas hepáticas, eletrólitos e coagulação." },
    { texto: "Parto depois da estabilização materna." },
  ],
  medicamentos: [
    {
      id: "magnesio-eclampsia-ataque", farmaco: "Sulfato de magnésio", indicacao: "Ataque", populacao: "adulto", via: "IV",
      dose: { usual: 4, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_50],
      velocidade: "Em 10 a 20 minutos.",
      cuidados: ["A 50%, 4 g são 8 mL: diluir conforme o protocolo do serviço."],
      referencias: ["saesp-tratado"],
    },
    {
      id: "magnesio-eclampsia-manutencao", farmaco: "Sulfato de magnésio", indicacao: "Manutenção, em bomba de infusão", populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "h" }, apresentacoes: [MAGNESIO_SAESP_124],
      cuidados: ["Disfunção renal: ajustar e vigiar o magnésio.", "Vigiar frequência respiratória, reflexos, consciência e diurese."],
      referencias: ["saesp-tratado", "nice-ng133"],
    },
    {
      id: "magnesio-eclampsia-recorrencia", farmaco: "Sulfato de magnésio", indicacao: "Nova convulsão — dose adicional", populacao: "adulto", via: "IV",
      dose: { usual: 2, unidade: "g", por: "fixa" }, apresentacoes: [MAGNESIO_50],
      cuidados: ["Diluir para a administração segura."],
      referencias: ["saesp-tratado", "ms-2022-alto-risco"],
    },
    {
      id: "gluconato-eclampsia", farmaco: "Gluconato de cálcio 10%", indicacao: "Intoxicação por magnésio, junto do suporte ventilatório", populacao: "adulto", via: "IV",
      dose: { usual: 1, unidade: "g", por: "fixa" }, apresentacoes: [GLUCONATO_DE_CALCIO_10],
      velocidade: "Em cerca de 10 minutos.",
      referencias: ["saesp-tratado", "ms-2022-alto-risco"],
    },
  ],
  volumes: [],
  notasDeDose: [
    "Intoxicação por magnésio (depressão respiratória, perda dos reflexos, rebaixamento): parar a infusão, suporte ventilatório e gluconato de cálcio.",
    "Magnésio não substitui o tratamento da hipertensão grave.",
  ],
  pensarEm: [
    "Outras causas de convulsão: hipoglicemia, toxicidade por anestésico local, AVC, trombose venosa cerebral e epilepsia.",
  ],
  depois: [
    "Manter o magnésio por pelo menos 24 horas depois da última convulsão ou do parto, o que vier por último.",
    "UTI ou unidade de cuidado materno, com vigilância de frequência respiratória, reflexos, consciência, diurese e função renal.",
  ],
  divergencias: [
    {
      tema: "Tempo do ataque e ritmo da manutenção",
      posicoes: [
        { texto: "4 g em 10 a 20 minutos; manutenção de 1 g/h (24 mL de MgSO4 50% + 100 mL de SG 5%).", referencia: "saesp-tratado" },
        { texto: "4 g EV em 5 a 10 minutos; manutenção de 1 a 2 g/h; nova convulsão, 2 g.", referencia: "ms-2022-alto-risco" },
        { texto: "Regime do Collaborative Eclampsia Trial: ataque de 4 g IV e 1 g/h por 24 horas.", referencia: "nice-ng133" },
      ],
      escolha: "Este cartão segue o Tratado SAESP: 4 g em 10 a 20 minutos e 1 g/h. O cartão Colapso materno ainda traz 20 a 30 minutos e 1 a 2 g/h; até os dois serem alinhados, conferir com o protocolo obstétrico do serviço.",
    },
  ],
  referencias: ["saesp-tratado", "nice-ng133", "ms-2022-alto-risco"],
  relacionados: [
    { protocolo: "hipertensao", texto: "Crise hipertensiva" },
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
    { protocolo: "convulsao-perioperatoria", texto: "Convulsão perioperatória" },
  ],
};

export const EMBOLIA_AMNIOTICA: Protocolo = {
  id: "embolia-amniotica",
  titulo: "Embolia amniótica",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["embolia de líquido amniótico", "EmLA", "síndrome anafilactoide da gravidez", "colapso no parto"],
  sinais: ["colapso", "hipóxia", "dessaturação", "hipotensão", "PCR", "coagulopatia", "sangramento", "parto", "cesárea"],
  resumo: "Colapso cardiorrespiratório no parto ou logo depois: oxigenar, RCP com deslocamento uterino e parto ressuscitativo se sem pulso; suporte do ventrículo direito e protocolo de hemorragia maciça cedo.",
  reconhecer: [
    "Colapso súbito com hipóxia, hipotensão ou PCR durante o trabalho de parto, a cesárea ou logo depois, seguido de coagulopatia.",
    "O diagnóstico é clínico, de exclusão; não esperar exame para tratar.",
  ],
  agirAgora: [
    { texto: "Declarar emergência obstétrica e chamar anestesia, obstetrícia, neonatologia e UTI." },
    { texto: "Oxigenação e via aérea." },
    { texto: "Suporte circulatório; sem pulso, RCP de qualidade." },
    { texto: "Deslocamento uterino para a esquerda enquanto o útero estiver na altura do umbigo ou acima." },
    { texto: "Sem pulso e sem retorno da circulação: histerotomia ressuscitativa (parto) no local." },
    { texto: "Tratar a disfunção de ventrículo direito e a hipertensão pulmonar.", detalhe: "Vasopressor e inotrópico; evitar sobrecarga de volume." },
    { texto: "Ecocardiograma quando disponível, sem atrasar o tratamento." },
    { texto: "Ativar cedo o protocolo de hemorragia maciça." },
    { texto: "Corrigir fibrinogênio, plaquetas, fatores, cálcio e equilíbrio ácido-base." },
    { texto: "Refratária: considerar ECMO, se disponível." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Sem fármaco específico: na PCR, as doses do adulto; hemocomponentes, fibrinogênio e cálcio pelo protocolo de hemorragia maciça.",
    "Evitar excesso de cristaloide com ventrículo direito disfuncionante.",
    "Não usar de rotina combinações de fármacos experimentais.",
  ],
  pensarEm: [
    "Tromboembolia pulmonar, hemorragia, anafilaxia, raqui total, embolia gasosa, infarto, sepse e toxicidade por anestésico local.",
  ],
  depois: [
    "UTI materna e equipe neonatal.",
    "Registrar a cronologia; apoio à família e revisão da equipe.",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "smfm-2026-embolia-amniotica", "aha-2025-pcr-gestante"],
  relacionados: [
    { protocolo: "colapso-materno", texto: "Colapso materno e PCR na gestante" },
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "hemorragia-pos-parto", texto: "Hemorragia pós-parto" },
  ],
};

export const VIA_AEREA_GESTANTE: Protocolo = {
  id: "via-aerea-dificil-gestante",
  titulo: "Via aérea difícil na gestante",
  categoria: "obstetricia",
  populacoes: ["gestante"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["intubação difícil na gestante", "intubação falha obstétrica", "via aérea obstétrica", "cesárea sob anestesia geral"],
  sinais: ["não intubo", "dessaturação", "gestante", "cesárea", "anestesia geral", "laringoscopia difícil"],
  resumo: "Oxigenação materna acima de tudo: no máximo duas tentativas de intubação, aliviar a pressão cricoide, supraglótico de segunda geração cedo e decidir com a obstetrícia entre despertar e prosseguir.",
  reconhecer: [
    "Laringoscopia ou intubação difícil, ou falha de intubação, numa gestante.",
    "A gestante dessatura rápido e tem risco maior de aspiração.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda e declarar a dificuldade em voz alta." },
    { texto: "Manter a oxigenação e a perfusão materna." },
    { texto: "Otimizar posição e pré-oxigenação; ventilar sob máscara entre tentativas; videolaringoscópio." },
    { texto: "Limitar as tentativas de intubação.", detalhe: "No máximo duas (OAA/DAS); cada uma com uma mudança." },
    { texto: "Reavaliar ou aliviar a pressão cricoide se atrapalha a laringoscopia ou a ventilação." },
    { texto: "Falhou a intubação: supraglótico de segunda geração, cedo." },
    { texto: "Oxigenação garantida: decidir com a obstetrícia entre despertar e prosseguir com a cirurgia pela via aérea alternativa." },
    { texto: "Não intubo, não oxigeno: acesso frontal pelo algoritmo institucional, por operador treinado." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Sem dose própria: fármacos conforme o plano de via aérea e a decisão de despertar ou prosseguir.",
    "Ter o plano de falha combinado antes da indução.",
  ],
  pensarEm: ["Edema de via aérea (pré-eclâmpsia), obesidade, mamas volumosas, posição inadequada e pressão cricoide mal aplicada."],
  depois: [
    "Registrar a dificuldade e o que funcionou; orientar a paciente.",
    "Documentar para anestesias futuras (alerta de via aérea difícil).",
  ],
  divergencias: [],
  referencias: ["saesp-tratado", "oaa-das-2015"],
  relacionados: [
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
    { protocolo: "nao-ventilo-nao-intubo", texto: "Não ventilo, não intubo" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};
