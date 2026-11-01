/**
 * CARDIOVASCULAR — os 10 protocolos da minuta “AVANEST — Implementação dos 10
 * protocolos cardiovasculares” (01/11/2026), aprovada pelo responsável médico
 * no mesmo dia (lib/intercorrencias/aprovacao.ts).
 *
 * O texto clínico é o da minuta, integral: Reconhecer, Agir agora (cada etapa
 * numerada, na ordem clínica, com o título da etapa no passo e a explicação no
 * detalhe), Doses, Pensar em, Depois e Referências. A minuta é uma versão
 * clínica redigida para o AVANEST, e não a transcrição de um livro.
 *
 * As doses reaproveitam os cadastros da versão 2 (pcr.ts, isquemia.ts,
 * hemorragia.ts, embolia-gasosa.ts, diagnostico.ts): a mesma apresentação, o
 * mesmo teto, o mesmo alerta de alto risco e os mesmos pares adulto/criança,
 * já cobertos pelos testes da calculadora. O que a minuta muda na dose — a
 * indicação, a repetição, o cuidado — é escrito aqui por cima. A versão 2
 * continua nos arquivos de origem: é o “texto anterior” do relatório.
 *
 * Mantido da versão 2 sem estar na minuta (dito no relatório da revisão): o
 * resumo do topo de cada cartão; as divergências já documentadas; o magnésio
 * da torsades; o cloreto de cálcio pediátrico da hemorragia; e os passos que
 * valem só para uma população, como a minuta manda ("separar adultos, crianças
 * e gestantes quando houver diferenças de tratamento"). Esses passos vêm DEPOIS
 * das etapas numeradas da minuta e só aparecem para a população deles: para o
 * adulto, a numeração é exatamente a da minuta.
 */

/** Os passos de uma população só, da versão 2: vêm depois das etapas da minuta. */
const passosSo = (p: Protocolo, quem: string) => p.agirAgora.filter((x) => x.so?.includes(quem as never));

import type { DoseDoProtocolo, Protocolo, VolumeDoProtocolo } from "../tipos.ts";
import { PCR_AESP as PCR_AESP_V2, PCR_FV_TV as PCR_FV_TV_V2 } from "./pcr.ts";
import { ISQUEMIA as ISQUEMIA_V2 } from "./isquemia.ts";
import { HEMORRAGIA as HEMORRAGIA_V2 } from "./hemorragia.ts";
import { EMBOLIA_GASOSA as EMBOLIA_GASOSA_V2 } from "./embolia-gasosa.ts";
import {
  BRADICARDIA as BRADICARDIA_V2, HIPERTENSAO as HIPERTENSAO_V2, HIPOTENSAO as HIPOTENSAO_V2, TAQUIARRITMIA as TAQUIARRITMIA_V2,
} from "./diagnostico.ts";

const REVISAO = "2026-11-01";

/** A dose da versão 2, pelo id: a minuta muda o texto, e não a apresentação nem o teto. */
function dose(p: Protocolo, id: string, mudancas: Partial<DoseDoProtocolo> = {}): DoseDoProtocolo {
  const d = p.medicamentos.find((m) => m.id === id);
  if (!d) throw new Error(`${p.id}: dose ${id} não existe na versão 2`);
  return { ...d, ...mudancas };
}
function volume(p: Protocolo, id: string, mudancas: Partial<VolumeDoProtocolo> = {}): VolumeDoProtocolo {
  const v = p.volumes.find((x) => x.id === id);
  if (!v) throw new Error(`${p.id}: volume ${id} não existe na versão 2`);
  return { ...v, ...mudancas };
}

/** Gestante na PCR: o atalho forte para o protocolo dela, quando a paciente é gestante. */
const VEJA_GESTANTE = {
  protocolo: "colapso-materno", quando: ["gestante" as const],
  texto: "Gestante: deslocamento uterino e parto ressuscitativo — Colapso materno e PCR na gestante.",
};

// ---------------------------------------------------------------------------
// 01 — PCR: FV/TV sem pulso
// ---------------------------------------------------------------------------
export const PCR_FV_TV: Protocolo = {
  ...PCR_FV_TV_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Ausência de pulso central associada à fibrilação ventricular ou taquicardia ventricular sem pulso.",
    "Queda abrupta de EtCO₂, desaparecimento da onda arterial invasiva e perda da circulação reforçam a suspeita.",
    "Verificar rapidamente artefatos e conexões, sem atrasar compressões ou desfibrilação.",
  ],
  agirAgora: [
    { texto: "Confirme a parada cardíaca.",
      detalhe: "Avalie responsividade, pulso central e ritmo cardíaco em até 10 segundos. Na ausência de pulso, inicie imediatamente a ressuscitação." },
    { texto: "Inicie RCP de alta qualidade.",
      detalhe: "Realize 100–120 compressões por minuto, profundidade de 5–6 cm, retorno completo do tórax e interrupções mínimas. Administre oxigênio a 100%. Sem via aérea avançada, utilize relação 30:2. Com via aérea avançada, mantenha compressões contínuas e 10 ventilações por minuto." },
    { texto: "Solicite ajuda e organize a equipe.",
      detalhe: "Anuncie a PCR, solicite desfibrilador e carrinho de emergência, distribua funções e estabeleça comunicação objetiva." },
    { texto: "Prepare a desfibrilação.",
      detalhe: "Confirme FV/TV sem pulso, coloque as pás e interrompa a administração de anestésicos depressores quando apropriado. Realize o primeiro choque assim que possível. Bifásico: energia conforme fabricante, geralmente 120–200 J inicialmente; se desconhecida, utilizar a energia máxima disponível. Monofásico: 360 J." },
    { texto: "Reinicie imediatamente a RCP.",
      detalhe: "Após o primeiro choque, retome compressões sem verificar pulso imediatamente. Mantenha o ciclo por 2 minutos. Obtenha acesso IV, utilizando IO se necessário." },
    { texto: "Reavalie o ritmo e procure causas reversíveis.",
      detalhe: "Após 2 minutos, faça uma pausa mínima para reavaliar. Se persistir FV/TV, realize o segundo choque. Retome imediatamente a RCP e continue investigando os 5Hs e 5Ts." },
    { texto: "Administre adrenalina após o segundo choque.",
      detalhe: "Dose: 1 mg IV/IO, repetida a cada 3–5 minutos durante a PCR. Mantenha compressões, oxigenação e capnografia." },
    { texto: "Realize o terceiro choque e administre antiarrítmico.",
      detalhe: "Após novo ciclo de 2 minutos, se FV/TV persistir, realize o terceiro choque e retome a RCP imediatamente. Administre amiodarona 300 mg IV/IO ou lidocaína como alternativa." },
    { texto: "Continue os ciclos de ressuscitação.",
      detalhe: "Reavalie o ritmo a cada 2 minutos, com pausas mínimas. Realize novos choques sempre que o ritmo permanecer chocável. Mantenha a adrenalina a cada 3–5 minutos. Corrija causas reversíveis e avalie a qualidade da RCP utilizando EtCO₂ e outros parâmetros disponíveis." },
    { texto: "Considere a segunda dose do antiarrítmico.",
      detalhe: "Se persistir FV/TV refratária, considere amiodarona 150 mg IV/IO como segunda dose ou dose adicional de lidocaína conforme o algoritmo. Não há obrigatoriedade de administrar a segunda dose exatamente no quinto ciclo." },
    { texto: "Acione recursos avançados e cuidados pós-PCR.",
      detalhe: "Considere tratamento de causa coronariana, suporte circulatório e ECPR/ECMO em pacientes selecionados, conforme recursos e critérios institucionais. Após retorno da circulação espontânea, inicie cuidados pós-PCR." },
    ...passosSo(PCR_FV_TV_V2, "gestante"),
  ],
  medicamentos: [
    dose(PCR_FV_TV_V2, "adrenalina-pcr", {
      indicacao: "Após o segundo choque",
      repeticao: "A cada 3–5 minutos durante a PCR.",
      cuidados: ["Solução de 0,1 mg/mL: 10 mL por dose.", "Conferir apresentação e concentração antes de administrar."],
    }),
    dose(PCR_FV_TV_V2, "amiodarona-pcr-300", { indicacao: "Primeira dose — terceiro choque com FV/TV persistente" }),
    dose(PCR_FV_TV_V2, "amiodarona-pcr-150", { indicacao: "Segunda dose — FV/TV refratária" }),
    dose(PCR_FV_TV_V2, "lidocaina-pcr", {
      indicacao: "Alternativa à amiodarona — primeira dose",
      cuidados: ["Calcular o volume pela dose e pela concentração verificadas."],
    }),
    dose(PCR_FV_TV_V2, "lidocaina-pcr-2", { indicacao: "Alternativa — segunda dose" }),
  ],
  volumes: [volume(PCR_FV_TV_V2, "choque-bifasico"), volume(PCR_FV_TV_V2, "choque-monofasico")],
  notasDeDose: [
    "Desfibrilação pediátrica: não utilizar doses adultas. No protocolo pediátrico: primeiro choque 2 J/kg, segundo 4 J/kg e posteriores pelo menos 4 J/kg, máximo de 10 J/kg ou o limite adulto.",
  ],
  pensarEm: [
    "Hipóxia, hipovolemia, acidose, alterações do potássio, hipotermia, pneumotórax hipertensivo, tamponamento, tóxicos e trombose pulmonar ou coronariana.",
    "Considerar causas anestésicas: anafilaxia, toxicidade sistêmica por anestésicos locais, bloqueio neuraxial alto e hemorragia oculta.",
    "Não administrar bicarbonato, cálcio ou magnésio rotineiramente sem indicação específica.",
  ],
  depois: [
    "Tratar a causa.",
    "Manter PAM de pelo menos 65 mmHg, individualizando.",
    "Ajustar oxigênio para SpO₂ de 90–98% após obtenção de medida confiável.",
    "Ajustar ventilação para normocapnia quando apropriado.",
    "Realizar ECG de 12 derivações e exames.",
    "Em pacientes que não obedecem a comandos, considerar estratégia protocolizada de controle de temperatura entre 32 e 37,5 °C.",
    "Encaminhar para unidade de cuidados apropriada.",
  ],
  referencias: ["aha-2025-acls-pcr", "aha-2025-pos-pcr", "manual-01"],
};

// ---------------------------------------------------------------------------
// 02 — PCR: AESP/assistolia
// ---------------------------------------------------------------------------
export const PCR_AESP: Protocolo = {
  ...PCR_AESP_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Ausência de pulso associada à atividade elétrica sem pulso ou assistolia.",
    "Na AESP existe atividade elétrica organizada sem circulação efetiva. Na assistolia não há atividade ventricular identificável.",
    "Confirmar rapidamente eletrodos e derivações quando necessário, sem atrasar a RCP.",
  ],
  agirAgora: [
    { texto: "Confirme ausência de pulso.",
      detalhe: "Verifique rapidamente a condição clínica. Não ultrapasse 10 segundos de avaliação de pulso." },
    { texto: "Inicie imediatamente a RCP.",
      detalhe: "Compressões de 100–120/min, profundidade de 5–6 cm e retorno completo. Administre O₂ a 100% e garanta ventilação adequada." },
    { texto: "Acione ajuda e organize a equipe.",
      detalhe: "Solicite carrinho de emergência e obtenha acesso IV ou IO." },
    { texto: "Administre adrenalina o mais precocemente possível.",
      detalhe: "Dose: 1 mg IV/IO, repetida a cada 3–5 minutos. Não aguardar o segundo ciclo para iniciar adrenalina na AESP/assistolia." },
    { texto: "Interrompa possíveis fatores precipitantes.",
      detalhe: "Considere estímulo vagal intenso, pneumoperitônio, tração cirúrgica, hipóxia, bloqueio anestésico alto ou evento medicamentoso." },
    { texto: "Investigue e corrija causas reversíveis.",
      detalhe: "Avalie os 5Hs e 5Ts, priorizando causas prováveis no contexto perioperatório. Trate imediatamente hipovolemia, hipoxemia, pneumotórax hipertensivo e outros diagnósticos reversíveis identificados." },
    { texto: "Reavalie o ritmo a cada 2 minutos.",
      detalhe: "Minimize interrupções. Utilize EtCO₂ para avaliar a qualidade das compressões. Ultrassom pode ajudar quando realizado sem prolongar pausas." },
    { texto: "Se ocorrer FV/TV, mude imediatamente para o algoritmo chocável.",
      detalhe: "Realize a desfibrilação indicada e siga o protocolo 01. Se houver retorno da circulação, inicie cuidados pós-PCR." },
    { texto: "Acione suporte avançado conforme a causa e o contexto.",
      detalhe: "Considere intervenções específicas e recursos institucionais. Avalie decisões sobre continuidade da ressuscitação conforme critérios clínicos e éticos aplicáveis." },
  ],
  medicamentos: [
    dose(PCR_AESP_V2, "adrenalina-pcr-aesp", {
      indicacao: "O mais precocemente possível",
      repeticao: "A cada 3–5 minutos.",
      cuidados: ["Concentração 0,1 mg/mL: 10 mL por dose.", "Conferir apresentação e concentração antes de administrar."],
    }),
  ],
  notasDeDose: [
    "Não utilizar atropina ou marca-passo como tratamento rotineiro de assistolia estabelecida.",
    "Bicarbonato e cálcio somente nas indicações específicas.",
  ],
  pensarEm: [
    "Hipovolemia e hemorragia, hipóxia, distúrbios metabólicos, intoxicação medicamentosa, embolia pulmonar, tamponamento, pneumotórax hipertensivo, anafilaxia, raquianestesia alta e toxicidade por anestésico local.",
  ],
  depois: [
    "Tratar a causa desencadeante, manter a perfusão, realizar ECG e exames, registrar tempos e doses administradas e encaminhar ao cuidado pós-PCR.",
  ],
  referencias: ["aha-2025-als", "aha-2025-acls-pcr", "manual-02"],
  veja: [...(PCR_AESP_V2.veja ?? []), VEJA_GESTANTE],
};

// ---------------------------------------------------------------------------
// 03 — Isquemia miocárdica intraoperatória
// ---------------------------------------------------------------------------
export const ISQUEMIA: Protocolo = {
  ...ISQUEMIA_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Alterações novas e persistentes do segmento ST, arritmias, instabilidade hemodinâmica ou anormalidades segmentares da contratilidade ventricular.",
    "Considerar isquemia por doença coronariana aguda ou desequilíbrio entre oferta e demanda de oxigênio.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda e comunique o cirurgião.",
      detalhe: "Avalie a possibilidade de reduzir temporariamente o estímulo cirúrgico. Mantenha o desfibrilador disponível." },
    { texto: "Avalie oxigenação e ventilação.",
      detalhe: "Corrija hipoxemia e hipercapnia, garantindo ventilação adequada. Administre oxigênio suplementar quando indicado para corrigir hipoxemia." },
    { texto: "Confirme as alterações eletrocardiográficas.",
      detalhe: "Confira eletrodos e derivações, obtenha ECG de 12 derivações quando possível e avalie o padrão das alterações." },
    { texto: "Avalie a perfusão coronariana.",
      detalhe: "Investigue hipotensão, taquicardia, sangramento, anemia, hipóxia e disfunção ventricular." },
    { texto: "Corrija hipotensão.",
      detalhe: "Mantenha perfusão adequada e individualize metas hemodinâmicas. Considere monitorização arterial invasiva." },
    { texto: "Corrija fatores que elevam a demanda de oxigênio.",
      detalhe: "Trate dor, anestesia insuficiente, taquicardia, febre e outros fatores desencadeantes." },
    { texto: "Considere betabloqueador apenas quando indicado.",
      detalhe: "A titulação pode ser apropriada para taquicardia relevante, desde que não exista choque, baixo débito ou outra contraindicação." },
    { texto: "Considere nitroglicerina quando apropriada.",
      detalhe: "Avalie pressão arterial, suspeita de infarto de ventrículo direito, dependência de pré-carga e possíveis interações medicamentosas." },
    { texto: "Avalie função ventricular e distúrbios de movimento.",
      detalhe: "Utilize ecocardiografia quando disponível e pertinente." },
    { texto: "Investigue síndrome coronariana aguda.",
      detalhe: "Em caso de supra de ST persistente ou instabilidade importante, solicite avaliação cardiológica urgente e discuta reperfusão." },
    { texto: "Avalie terapia antitrombótica conforme o contexto cirúrgico.",
      detalhe: "Decidir com cardiologia e cirurgia, ponderando o risco hemorrágico." },
    { texto: "Planeje acompanhamento pós-operatório intensivo quando necessário.",
      detalhe: "Solicite ECG e troponina seriados conforme indicação." },
  ],
  medicamentos: [
    dose(ISQUEMIA_V2, "metoprolol-isquemia", {
      indicacao: "Adulto selecionado com taquicardia relevante — dose inicial",
      repeticao: "Reavaliar antes de repetir.",
      cuidados: ["Não utilizar em choque, bradicardia relevante ou bloqueio AV significativo."],
    }),
    dose(ISQUEMIA_V2, "nitroglicerina-isquemia", {
      indicacao: "Quando apropriada — início, depois titular",
      velocidade: "Início de 5 mcg/min, titulando segundo resposta e pressão arterial. No preparo de 200 mcg/mL, 5 mcg/min = 1,5 mL/h.",
    }),
  ],
  notasDeDose: ["Não utilizar hematócrito de 30% como gatilho transfusional universal."],
  pensarEm: [
    "Hipotensão, anemia, hipovolemia, baixo débito, taquicardia, hipóxia, espasmo coronariano, trombose e alterações eletrolíticas.",
  ],
  depois: [
    "ECG seriado, troponina quando indicada, ecocardiografia, avaliação cardiológica e monitorização pós-operatória apropriada.",
  ],
  referencias: ["acc-aha-2024-perioperatorio", "manual-04", "manual-34"],
};

// ---------------------------------------------------------------------------
// 04 — Hemorragia maciça
// ---------------------------------------------------------------------------
export const HEMORRAGIA: Protocolo = {
  ...HEMORRAGIA_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Sangramento rápido ou persistente associado a hipoperfusão, instabilidade hemodinâmica ou previsão de necessidade de transfusão importante.",
    "A hemoglobina inicialmente normal não exclui hemorragia grave.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda imediatamente.",
      detalhe: "Avise equipe cirúrgica, anestesia, hemoterapia e demais profissionais necessários." },
    { texto: "Ative o protocolo institucional de transfusão maciça.",
      detalhe: "Não espere a perda de uma volemia completa ou alterações laboratoriais tardias." },
    { texto: "Identifique e controle a fonte do sangramento.",
      detalhe: "Priorize compressão, hemostasia cirúrgica, tamponamento e intervenções definitivas." },
    { texto: "Garanta acessos venosos adequados.",
      detalhe: "Utilize acessos calibrosos e dispositivos de infusão rápida quando necessários." },
    { texto: "Inicie ressuscitação hemostática.",
      detalhe: "Administre hemocomponentes de acordo com a gravidade, a disponibilidade e o protocolo institucional." },
    { texto: "Mantenha oxigenação e perfusão.",
      detalhe: "Individualize metas pressóricas. Não aplique hipotensão permissiva universalmente, especialmente em gestantes ou pacientes com TCE." },
    { texto: "Previna hipotermia.",
      detalhe: "Aqueça paciente, ambiente e fluidos administrados quando indicado." },
    { texto: "Avalie coagulação e metabolismo.",
      detalhe: "Solicite hemoglobina, plaquetas, fibrinogênio, INR/TTPa, gasometria, lactato, cálcio ionizado e outros exames pertinentes." },
    { texto: "Utilize TEG ou ROTEM, se disponíveis.",
      detalhe: "Oriente a reposição direcionada de hemocomponentes e fatores de coagulação." },
    { texto: "Considere ácido tranexâmico quando indicado.",
      detalhe: "A indicação, a dose e a janela terapêutica dependem da etiologia. Não aplicar o mesmo regime a todas as cirurgias." },
    { texto: "Corrija hipocalcemia e outras alterações.",
      detalhe: "Monitore cálcio ionizado, potássio, pH e temperatura." },
    { texto: "Continue monitorização e reavaliação.",
      detalhe: "Avalie perdas acumuladas, velocidade do sangramento, resposta às intervenções e necessidade de controle definitivo." },
    ...passosSo(HEMORRAGIA_V2, "gestante"),
  ],
  medicamentos: [
    dose(HEMORRAGIA_V2, "cloreto-de-calcio-hemorragia-adulto", {
      indicacao: "Hipocalcemia significativa — dose adulta de referência, quando indicada",
      repeticao: "Reavaliar o cálcio ionizado antes de novas doses.",
      cuidados: ["Administrar com acesso seguro e monitorização: extravasamento causa necrose."],
    }),
    dose(HEMORRAGIA_V2, "cloreto-de-calcio-hemorragia-ped"),
    dose(HEMORRAGIA_V2, "tranexamico-trauma-bolus", {
      indicacao: "Trauma com indicação, dentro da janela terapêutica — primeira dose",
      cuidados: ["Em cirurgia eletiva, obstetrícia e outras situações, usar protocolo específico. Este regime não é universal."],
    }),
    dose(HEMORRAGIA_V2, "tranexamico-trauma-infusao", { indicacao: "Trauma — seguida da segunda dose em 8 horas" }),
  ],
  volumes: [volume(HEMORRAGIA_V2, "plasma", {
    rotulo: "Plasma fresco congelado",
    indicacao: "Regime de referência quando indicado: cerca de 15 mL/kg, sujeito ao protocolo e à situação clínica",
  })],
  notasDeDose: [
    "Plaquetas — adultos: dose terapêutica conforme unidade por aférese ou pool institucional. Pediatria: regime específico pelo produto e peso.",
    "Fibrinogênio: avaliar deficiência pelo método de Clauss ou por testes viscoelásticos. Em hemorragia não obstétrica, considerar reposição diante de fibrinogênio ≤1,5 g/L ou deficiência equivalente, conforme diretriz aplicável. Em hemorragia obstétrica, considerar alvo de pelo menos 2 g/L.",
    "Não administrar complexo protrombínico ou fator VIIa como etapa automática.",
  ],
  pensarEm: [
    "Hemorragia oculta, coagulopatia, hipotermia, hipocalcemia, acidose, anticoagulantes, fibrinólise excessiva e reação transfusional.",
  ],
  depois: [
    "Monitorar função renal, eletrólitos, sangramento residual, temperatura, coagulopatia e possíveis complicações transfusionais.",
  ],
  referencias: ["manual-05", "saesp-tratado", "esaic-2022-sangramento"],
};

// ---------------------------------------------------------------------------
// 05 — Embolia gasosa venosa
// ---------------------------------------------------------------------------
export const EMBOLIA_GASOSA: Protocolo = {
  ...EMBOLIA_GASOSA_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Queda súbita do EtCO₂, hipotensão, hipoxemia e instabilidade durante procedimento com possibilidade de entrada de gás na circulação.",
    "Podem ocorrer aumento de pressão pulmonar, falência ventricular direita e parada cardíaca.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda e comunique imediatamente a cirurgia.",
      detalhe: "Suspeite de embolia gasosa e interrompa o procedimento desencadeante quando possível." },
    { texto: "Administre oxigênio a 100%.", detalhe: "Suspenda imediatamente o óxido nitroso." },
    { texto: "Interrompa a entrada de gás.",
      detalhe: "Pare a insuflação, revise conexões e linhas pressurizadas, solicite oclusão ou inundação do campo operatório quando apropriado." },
    { texto: "Garanta ventilação e circulação.",
      detalhe: "Avalie oxigenação, capnografia, pressão arterial e sinais de falência ventricular direita." },
    { texto: "Considere posicionamento individualizado.",
      detalhe: "Decúbito lateral esquerdo e Trendelenburg não devem ser ordens automáticas. Evite qualquer posição que comprometa ventilação, RCP ou perfusão cerebral." },
    { texto: "Considere aspiração pelo cateter venoso central existente.",
      detalhe: "Se houver cateter já adequadamente posicionado, pode-se tentar aspiração. Não atrase intervenções essenciais para inserir um cateter exclusivamente com essa finalidade." },
    { texto: "Trate instabilidade hemodinâmica.",
      detalhe: "Utilize suporte vasopressor e reposição volêmica cuidadosamente titulada conforme o mecanismo hemodinâmico." },
    { texto: "Se houver PCR, inicie RCP imediatamente.",
      detalhe: "Siga o algoritmo adequado ao ritmo e trate a causa." },
    { texto: "Avalie ecocardiografia quando disponível.",
      detalhe: "Considere comprometimento do ventrículo direito e diagnósticos diferenciais." },
    { texto: "Considere avaliação hiperbárica.",
      detalhe: "Quando houver suspeita de embolia arterial, acometimento neurológico ou repercussão significativa, entre em contato precocemente com serviço especializado. Não descartar a avaliação apenas porque se passaram mais de 6 horas." },
  ],
  notasDeDose: [
    "Não existe medicamento específico que elimine imediatamente o gás intravascular.",
    "Vasoativos e reposição de volume devem ser individualizados conforme a situação hemodinâmica.",
    "Na PCR, utilizar as doses do algoritmo de ressuscitação apropriado.",
  ],
  pensarEm: [
    "Embolia por ar ou CO₂, tromboembolismo pulmonar, pneumotórax hipertensivo, tamponamento, anafilaxia e falha de capnografia.",
  ],
  depois: [
    "Monitorização intensiva, avaliação neurológica, acompanhamento cardiorrespiratório e investigação da fonte de entrada de gás.",
  ],
  referencias: ["manual-08", "aha-2025-acls-pcr", "echm-2017-hiperbarica"],
};

// ---------------------------------------------------------------------------
// 06 — Crise hipertensiva
// ---------------------------------------------------------------------------
export const HIPERTENSAO: Protocolo = {
  ...HIPERTENSAO_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Elevação importante da pressão arterial durante anestesia ou período perioperatório.",
    "Diferenciar hipertensão transitória por estímulo ou erro de medição de emergência hipertensiva associada à lesão aguda de órgão-alvo.",
  ],
  agirAgora: [
    { texto: "Confirme a pressão arterial.", detalhe: "Verifique manguito, transdutor, nivelamento e qualidade da medida." },
    { texto: "Avalie o paciente e procure lesão de órgão-alvo.",
      detalhe: "Considere isquemia miocárdica, edema pulmonar, dissecção de aorta, comprometimento neurológico e outras emergências." },
    { texto: "Avalie plano anestésico e analgesia.", detalhe: "Corrija anestesia superficial e dor quando presentes." },
    { texto: "Investigue causas respiratórias.", detalhe: "Corrija hipoxemia e hipercapnia." },
    { texto: "Revise causas farmacológicas e cirúrgicas.",
      detalhe: "Investigue catecolaminas, vasopressores, erros de preparo, estímulo cirúrgico, bexiga distendida e outras causas." },
    { texto: "Defina a necessidade de tratamento intravenoso.",
      detalhe: "Em hipertensão importante persistente ou emergência hipertensiva, considere agente titulável adequado ao contexto." },
    { texto: "Individualize a meta de redução pressórica.",
      detalhe: "A velocidade e a magnitude dependem do diagnóstico. Não realizar redução abrupta universal." },
    { texto: "Escolha o medicamento conforme frequência cardíaca e função cardiovascular.",
      detalhe: "Considere esmolol, nitroglicerina, nitroprussiato ou outros medicamentos quando indicados e não contraindicados." },
    { texto: "Em suspeita de feocromocitoma, evite bloqueio beta isolado antes de controle alfa apropriado." },
    { texto: "Reavalie resposta e complicações.", detalhe: "Monitorize perfusão, pressão arterial, ECG e estado clínico." },
  ],
  medicamentos: [
    dose(HIPERTENSAO_V2, "esmolol-bolus-hipertensao", {
      indicacao: "Adulto selecionado, quando indicado — bolus",
      velocidade: "Em aproximadamente 1 minuto.",
      cuidados: ["Conferir contraindicações e limites do protocolo institucional.", "Monitorar bradicardia e baixo débito."],
    }),
    dose(HIPERTENSAO_V2, "esmolol-infusao-hipertensao", {
      indicacao: "Infusão inicial de referência, titulada conforme resposta",
      cuidados: ["Conferir contraindicações e limites do protocolo institucional.", "Monitorar bradicardia e baixo débito."],
    }),
    dose(HIPERTENSAO_V2, "nitroglicerina-hipertensao", {
      indicacao: "Quando houver indicação cardiovascular apropriada — início, depois titular",
      velocidade: "Início de 5 mcg/min, titulando segundo resposta e pressão.",
    }),
    dose(HIPERTENSAO_V2, "hidralazina-hipertensao", {
      indicacao: "Adulto — dose inicial",
      velocidade: "IV lentamente.",
      repeticao: "Reavaliar antes de nova dose: efeito menos rapidamente titulável que outros agentes.",
    }),
  ],
  notasDeDose: [
    "Nitroprussiato: usar somente com prescrição, monitorização e concentração validadas. Avaliar risco de toxicidade, função renal e hepática, dose e duração.",
    "Não utilizar propofol em bolus como tratamento universal da crise hipertensiva.",
    "Criança: prescrição pelo formulário pediátrico do serviço; não usar a tabela adulta por extrapolação.",
  ],
  pensarEm: [
    "Anestesia insuficiente, dor, hipercapnia, hipoxemia, feocromocitoma, pré-eclâmpsia, isquemia miocárdica, dissecção de aorta, hipertensão intracraniana e erro medicamentoso.",
  ],
  depois: ["Investigar a causa, reavaliar órgãos-alvo e definir a necessidade de UTI ou acompanhamento monitorizado."],
  referencias: ["saesp-tratado", "manual-27", "manual-34", "acc-aha-2024-perioperatorio"],
};

// ---------------------------------------------------------------------------
// 07 — Hipotensão grave
// ---------------------------------------------------------------------------
export const HIPOTENSAO: Protocolo = {
  ...HIPOTENSAO_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Redução importante da pressão arterial com repercussão circulatória ou sinais de hipoperfusão.",
    "Possíveis sinais: alterações da consciência, redução de EtCO₂, oligúria, alterações de ECG e instabilidade progressiva.",
  ],
  agirAgora: [
    { texto: "Avalie pulso, pressão e ritmo cardíaco.", detalhe: "Sem pulso, iniciar o protocolo de PCR." },
    { texto: "Solicite ajuda.", detalhe: "Comunique a instabilidade grave e organize o atendimento." },
    { texto: "Avalie oxigenação e ventilação.", detalhe: "Investigue hipóxia, pressão intratorácica elevada e alterações ventilatórias." },
    { texto: "Revise os medicamentos e fatores anestésicos.",
      detalhe: "Considere excesso de anestésicos, bloqueio neuraxial, vasodilatação e erros de administração." },
    { texto: "Avalie sangramento e perda volêmica.",
      detalhe: "Investigue perdas evidentes ou ocultas. Se hemorragia grave, ativar o protocolo específico." },
    { texto: "Avalie frequência e ritmo cardíacos.",
      detalhe: "Bradicardia grave, taquiarritmias ou isquemia podem exigir tratamento específico." },
    { texto: "Considere o mecanismo circulatório.",
      detalhe: "Diferencie hipovolemia, vasoplegia, disfunção ventricular e choque obstrutivo." },
    { texto: "Inicie tratamento hemodinâmico apropriado.",
      detalhe: "Considere fluidos, vasoativos e inotrópicos segundo o mecanismo e a perfusão." },
    { texto: "Reavalie a resposta.",
      detalhe: "Não administrar grandes volumes automaticamente em pacientes com disfunção cardíaca ou choque obstrutivo." },
    { texto: "Considere monitorização avançada.", detalhe: "Linha arterial, gasometria, lactato e ecocardiografia quando indicados." },
    { texto: "Identifique e trate a causa definitiva.",
      detalhe: "Considere anafilaxia, bloqueio alto, embolia pulmonar, tamponamento, pneumotórax hipertensivo, hemorragia e falência ventricular." },
  ],
  medicamentos: [
    dose(HIPOTENSAO_V2, "efedrina-hipotensao", { indicacao: "Adulto — bolus titulado conforme resposta" }),
    dose(HIPOTENSAO_V2, "fenilefrina-hipotensao", { indicacao: "Adulto — bolus titulado conforme resposta" }),
    dose(HIPOTENSAO_V2, "noradrenalina-hipotensao", {
      indicacao: "Exemplo de início, titulando conforme perfusão e condição clínica",
      cuidados: [
        "Dose em noradrenalina base.",
        "Taxa da bomba (mL/h) = dose (mcg/kg/min) × peso (kg) × 60 ÷ concentração (mcg/mL).",
      ],
    }),
    dose(HIPOTENSAO_V2, "adrenalina-bolus-hipotensao", {
      indicacao: "Adulto selecionado com pulso e hipotensão grave — bolus cuidadosamente titulado",
      cuidados: ["Conforme o mecanismo e com monitorização.", "Não confundir com adrenalina 1 mg utilizada na PCR."],
    }),
  ],
  notasDeDose: [
    "Dobutamina: considerar em situações selecionadas de baixo débito, com avaliação de contratilidade e perfusão. Dose e preparo pelo protocolo institucional validado.",
    "Esses bolus não são uma sequência obrigatória.",
    "Criança: prescrição por kg e pelo contexto; bradicardia grave pediátrica segue o protocolo de bradicardia.",
  ],
  pensarEm: [
    "Hemorragia, anafilaxia, raquianestesia alta, bloqueio regional extenso, vasoplegia, choque cardiogênico, embolia pulmonar, tamponamento e pneumotórax hipertensivo.",
    "Não interpretar taquicardia isolada como confirmação de hipovolemia nem PVC isolada como medida confiável de responsividade a volume.",
  ],
  depois: ["Reavaliar perfusão, causa desencadeante, necessidade de suporte contínuo e transferência para unidade monitorizada."],
  referencias: ["saesp-tratado", "manual-28", "manual-34", "qrh-2-4", "acc-aha-2024-perioperatorio"],
  relacionados: [...(HIPOTENSAO_V2.relacionados ?? []), { protocolo: "embolia-pulmonar", texto: "Embolia pulmonar aguda" }],
};

// ---------------------------------------------------------------------------
// 08 — Taquiarritmia instável
// ---------------------------------------------------------------------------
export const TAQUIARRITMIA: Protocolo = {
  ...TAQUIARRITMIA_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Taquiarritmia associada a hipotensão, choque, alteração de consciência, dor isquêmica ou insuficiência cardíaca aguda.",
    "Confirmar que a taquiarritmia é responsável pela instabilidade, e não apenas resposta compensatória a outra emergência.",
  ],
  agirAgora: [
    { texto: "Avalie pulso e instabilidade.", detalhe: "Se não houver pulso, iniciar o algoritmo de PCR." },
    { texto: "Solicite ajuda e prepare o cardioversor/desfibrilador.", detalhe: "Monitorize ECG, pressão arterial e oximetria." },
    { texto: "Garanta acesso IV e suporte respiratório.",
      detalhe: "Administre oxigênio quando necessário e prepare materiais de via aérea." },
    { texto: "Identifique o padrão do ritmo.", detalhe: "Avalie QRS estreito ou largo, regularidade e suspeita de pré-excitação." },
    { texto: "Se a arritmia causar instabilidade, realize cardioversão imediata.",
      detalhe: "Sedação quando viável, sem atrasar a intervenção." },
    { texto: "Selecione a energia conforme a AHA 2025.",
      detalhe: "Fibrilação atrial: 200 J sincronizados. Flutter atrial: 200 J sincronizados. Taquicardia regular de QRS estreito: 100 J sincronizados. TV monomórfica com pulso: 100 J sincronizados. TV polimórfica: choque não sincronizado de alta energia. Conferir orientações do fabricante e escalonamento de energia." },
    { texto: "Confirme a sincronização antes de cada choque quando indicada.",
      detalhe: "Se a sincronização falhar e o paciente estiver criticamente instável, não retardar o choque apropriado." },
    { texto: "Reavalie imediatamente o ritmo e a perfusão após a intervenção.", detalhe: "Repita o tratamento quando indicado." },
    { texto: "Se estiver estável, trate conforme o ritmo identificado.",
      detalhe: "Evite antiarrítmicos sem identificar o tipo de taquiarritmia." },
    { texto: "Exclua fibrilação atrial pré-excitada antes de utilizar bloqueadores nodais.",
      detalhe: "Não utilizar amiodarona IV nem bloqueadores do nó AV na fibrilação atrial pré-excitada." },
    { texto: "Investigue causas desencadeantes.",
      detalhe: "Corrija hipóxia, distúrbios eletrolíticos, isquemia, hipovolemia e excesso de catecolaminas." },
  ],
  medicamentos: [
    dose(TAQUIARRITMIA_V2, "adenosina-6", {
      indicacao: "Adulto — primeira dose, apenas nos ritmos apropriados",
      velocidade: "Bolus rápido, seguido de flush.",
      cuidados: ["Não administrar em taquicardia irregular de QRS largo ou suspeita de FA pré-excitada."],
    }),
    dose(TAQUIARRITMIA_V2, "adenosina-12", { indicacao: "Adulto — segunda dose, se indicada", velocidade: "Bolus rápido, seguido de flush." }),
    dose(TAQUIARRITMIA_V2, "adenosina-ped-1", { indicacao: "Criança — primeira dose (algoritmo pediátrico específico)" }),
    dose(TAQUIARRITMIA_V2, "adenosina-ped-2", { indicacao: "Criança — segunda dose" }),
    dose(TAQUIARRITMIA_V2, "magnesio-torsades"),
    dose(TAQUIARRITMIA_V2, "magnesio-torsades-ped"),
  ],
  volumes: [
    volume(TAQUIARRITMIA_V2, "cardioversao-fa", { rotulo: "Cardioversão sincronizada — fibrilação atrial ou flutter atrial" }),
    volume(TAQUIARRITMIA_V2, "cardioversao-estreita", { rotulo: "Cardioversão sincronizada — QRS estreito regular ou TV monomórfica com pulso" }),
    {
      id: "desfibrilacao-tv-polimorfica", rotulo: "TV polimórfica — choque não sincronizado", grupo: "Cardioversão",
      indicacao: "Alta energia: a de desfibrilação do aparelho; conferir o fabricante (se desconhecida, a energia máxima)",
      populacao: "adulto", unidade: "J", fixo: { min: 120, max: 200 }, referencias: ["aha-2025-cardioversao", "aha-2025-acls-pcr"],
    },
    volume(TAQUIARRITMIA_V2, "cardioversao-ped"),
    volume(TAQUIARRITMIA_V2, "cardioversao-ped-2"),
  ],
  notasDeDose: [
    "Amiodarona com pulso: as doses não são iguais às doses em bolus utilizadas na PCR. Separar indicação, duração de infusão e população antes de liberar a calculadora.",
  ],
  pensarEm: [
    "Taquicardia sinusal compensatória, isquemia, hipovolemia, distúrbios eletrolíticos, fármacos, via acessória, toxicidade e insuficiência cardíaca.",
  ],
  depois: ["Obter ECG de 12 derivações, eletrólitos e avaliação cardiológica. Registrar ritmo, energia, sincronização e resposta."],
  referencias: ["aha-2025-als", "aha-2025-cardioversao", "aha-2025-pals-taquiarritmia", "saesp-tratado", "manual-29", "manual-34"],
};

// ---------------------------------------------------------------------------
// 09 — Bradicardia grave
// ---------------------------------------------------------------------------
export const BRADICARDIA: Protocolo = {
  ...BRADICARDIA_V2,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  reconhecer: [
    "Bradicardia com hipotensão, choque, sinais de hipoperfusão, dor torácica isquêmica ou alteração do estado mental.",
    "A frequência cardíaca isolada não determina necessidade de tratamento.",
  ],
  agirAgora: [
    { texto: "Avalie pulso e perfusão.", detalhe: "Se não houver pulso, inicie o protocolo de PCR." },
    { texto: "Solicite ajuda e monitorize o paciente.", detalhe: "ECG contínuo, pressão arterial, oximetria e acesso venoso." },
    { texto: "Garanta oxigenação e ventilação adequadas.", detalhe: "Corrija hipóxia e problemas ventilatórios." },
    { texto: "Interrompa estímulos vagais e revise medicamentos.",
      detalhe: "Considere tração cirúrgica, bloqueio neuraxial, opioides e outras causas farmacológicas." },
    { texto: "Se o adulto apresentar bradicardia sintomática, considere atropina.", detalhe: "Dose: 1 mg IV." },
    { texto: "Reavalie a resposta.", detalhe: "Se indicado, repetir atropina a cada 3–5 minutos, máximo 3 mg." },
    { texto: "Prepare marca-passo transcutâneo quando necessário.",
      detalhe: "Não retardar a estimulação em bloqueio AV avançado com instabilidade." },
    { texto: "Considere infusão de adrenalina ou dopamina.", detalhe: "Selecionar e titular segundo perfusão e resposta clínica." },
    { texto: "Investigue causas reversíveis.", detalhe: "Considere isquemia, hipercalemia, hipóxia, intoxicações e hipotermia." },
    { texto: "Considere marca-passo transvenoso.", detalhe: "Acione a cardiologia quando necessário." },
    { texto: "Reavalie continuamente e organize transferência apropriada." },
    ...passosSo(BRADICARDIA_V2, "pediatrico"),
  ],
  medicamentos: [
    dose(BRADICARDIA_V2, "atropina-bradicardia-adulto", {
      indicacao: "Adulto com bradicardia sintomática",
      repeticao: "A cada 3–5 minutos; máximo total de 3 mg.",
    }),
    dose(BRADICARDIA_V2, "adrenalina-infusao-bradicardia", {
      indicacao: "Adulto — infusão, titular conforme resposta",
      cuidados: ["No preparo de 60 mcg/mL, 2–10 mcg/min = 2–10 mL/h.", "Não confundir com o bolus de 1 mg da PCR."],
    }),
    dose(BRADICARDIA_V2, "dopamina-bradicardia", { indicacao: "Adulto — titular segundo perfusão" }),
    dose(BRADICARDIA_V2, "adrenalina-bradicardia-ped", {
      indicacao: "Criança — FC abaixo de 60/min com comprometimento persistente, quando indicada",
    }),
    dose(BRADICARDIA_V2, "atropina-bradicardia-ped", {
      indicacao: "Criança — aumento do tônus vagal ou bloqueio AV primário",
    }),
  ],
  notasDeDose: [
    "Pediatria: FC abaixo de 60/min com comprometimento persistente apesar de oxigenação e ventilação adequadas exige avaliação para início de RCP conforme o PALS.",
    "Pediatria: utilizar o algoritmo pediátrico completo; não extrapolar doses de adulto.",
    "Não usar 1 mcg/kg de adrenalina como substituto da dose pediátrica de 10 mcg/kg.",
    "Na intoxicação, usar protocolo específico, com apoio especializado.",
  ],
  pensarEm: [
    "Hipóxia, estímulo vagal, bloqueio neuraxial alto, infarto, distúrbios eletrolíticos, betabloqueadores, bloqueadores de canais de cálcio e distúrbios de condução.",
  ],
  depois: ["Monitorização ECG, avaliação cardiológica, eletrólitos, investigação da causa e necessidade de estimulação definitiva."],
  referencias: ["aha-2025-acls-bradicardia", "aha-2025-pals-bradicardia", "saesp-tratado", "manual-30"],
  veja: [
    ...(BRADICARDIA_V2.veja ?? []),
    { protocolo: "bradicardia-pediatrica", quando: ["pediatrico"],
      texto: "Criança: o algoritmo pediátrico completo — Bradicardia pediátrica." },
  ],
};

// ---------------------------------------------------------------------------
// 10 — Embolia pulmonar aguda (novo; substitui o “em preparação”)
// ---------------------------------------------------------------------------
export const EMBOLIA_PULMONAR: Protocolo = {
  id: "embolia-pulmonar",
  titulo: "Embolia pulmonar aguda",
  categoria: "cardiovascular",
  populacoes: ["adulto"],
  versao: 1,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  bibliografiaGeral: false,
  sinonimos: ["embolia pulmonar", "TEP", "tromboembolismo pulmonar", "TEP maciço", "TEP de alto risco"],
  sinais: ["EtCO2 caindo", "hipoxemia", "dessaturação", "taquicardia", "hipotensão", "choque", "disfunção de VD", "PCR sem causa"],
  resumo: "Hipoxemia, hipotensão, queda súbita do EtCO₂ ou disfunção de ventrículo direito sem outra explicação: suporte, ecocardiograma, classificar a gravidade, anticoagular quando indicado e discutir reperfusão no choque ou na falência cardiopulmonar.",
  reconhecer: [
    "Suspeitar de embolia pulmonar em paciente com hipoxemia, taquicardia, hipotensão, queda súbita do EtCO₂, sinais de disfunção ventricular direita, choque ou PCR sem outra explicação evidente.",
    "No intraoperatório, considerar especial atenção a procedimentos de maior risco tromboembólico.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda imediatamente.", detalhe: "Comunique a suspeita e organize o atendimento multidisciplinar." },
    { texto: "Avalie circulação e respiração.", detalhe: "Verifique pressão arterial, pulso, oxigenação e perfusão." },
    { texto: "Administre suporte respiratório apropriado.",
      detalhe: "Corrija hipoxemia e evite intervenções ventilatórias que agravem desnecessariamente a falência ventricular direita." },
    { texto: "Avalie sinais de choque e disfunção ventricular direita.",
      detalhe: "Investigue hipotensão persistente, baixo débito e sinais ecocardiográficos de sobrecarga do ventrículo direito." },
    { texto: "Utilize ecocardiografia à beira-leito quando indicada.",
      detalhe: "Em pacientes instáveis, o exame pode ajudar a identificar sobrecarga ventricular direita e diagnósticos diferenciais." },
    { texto: "Solicite angiotomografia pulmonar quando houver estabilidade suficiente.",
      detalhe: "Não transportar um paciente criticamente instável sem planejamento e suporte adequados." },
    { texto: "Classifique a gravidade conforme a AHA/ACC 2026.",
      detalhe: "Categoria A: subclínica/assintomática. Categoria B: sintomática, baixa gravidade clínica. Categoria C: sintomática, escore clínico elevado, com subcategorias conforme disfunção ventricular direita e biomarcadores. Categoria D: falência cardiopulmonar incipiente. Categoria E: falência cardiopulmonar, incluindo choque persistente ou PCR." },
    { texto: "Inicie anticoagulação terapêutica quando indicada.",
      detalhe: "Avalie o risco hemorrágico, o momento cirúrgico, contraindicações e a necessidade de intervenções imediatas. A escolha entre heparina de baixo peso molecular e heparina não fracionada deve considerar a recomendação geral da diretriz e o contexto de procedimento, reversibilidade e estratégias intervencionistas." },
    { texto: "Em embolia com choque ou falência cardiopulmonar, discuta reperfusão urgente.",
      detalhe: "Considerar, conforme gravidade e disponibilidade: trombólise sistêmica, trombólise dirigida por cateter, trombectomia mecânica ou embolectomia cirúrgica. Não aplicar trombólise a todos os pacientes automaticamente." },
    { texto: "Considere suporte circulatório avançado.",
      detalhe: "Vasoativos, tratamento da falência ventricular direita e, em pacientes selecionados, ECMO." },
    { texto: "Se ocorrer PCR, inicie ressuscitação imediatamente.",
      detalhe: "Siga o algoritmo correspondente ao ritmo e trate a suspeita de TEP como possível causa reversível." },
    { texto: "Acione equipe de resposta à embolia pulmonar quando disponível.",
      detalhe: "Considerar PERT, cardiologia, cirurgia cardiovascular, terapia intensiva e radiologia intervencionista." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Anticoagulação: as doses devem ser cadastradas conforme o anticoagulante selecionado, peso, função renal, situação cirúrgica e protocolo institucional. Não inserir uma única dose universal de heparina para todos os pacientes.",
    "Trombólise: apresentar protocolos específicos apenas após validação da indicação, medicamento, dose, contraindicações e risco hemorrágico. Não liberar cálculo automático sem confirmar elegibilidade.",
    "Vasoativos: suporte individualizado conforme perfusão e disfunção ventricular direita, com concentrações institucionais verificadas.",
  ],
  pensarEm: [
    "Embolia gasosa, pneumotórax hipertensivo, tamponamento cardíaco, infarto de ventrículo direito, hemorragia, anafilaxia e outras causas de choque.",
  ],
  depois: [
    "Monitorização intensiva, anticoagulação e duração conforme causa e risco, avaliação de complicações, acompanhamento cardiopulmonar e plano de prevenção secundária.",
  ],
  divergencias: [],
  referencias: ["aha-acc-2026-tep", "aha-2025-als"],
  relacionados: [
    { protocolo: "embolia-gasosa-venosa", texto: "Embolia gasosa venosa" },
    { protocolo: "hipotensao", texto: "Hipotensão grave" },
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
  ],
};
