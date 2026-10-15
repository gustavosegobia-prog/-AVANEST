/**
 * APOIO — cartões 30 a 34 da minuta de validação de 15/10/2026: crise sem
 * diagnóstico (os 10 Ts), depois da crise, o colega afetado e as duas
 * verificações (aparelho e pré-indução).
 *
 * Base: Manual de Crises (abas 23, 24, 35 e 36). Os 10 Ts são auxílio
 * cognitivo do Manual, e não classificação oficial de diretriz. Notificação,
 * aspectos legais e saúde ocupacional seguem as normas brasileiras e o fluxo
 * da instituição; a verificação do aparelho completa-se com o manual do
 * fabricante do aparelho usado. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";

export const DEZ_TS: Protocolo = {
  id: "evento-sem-diagnostico",
  titulo: "Crise sem diagnóstico — os 10 Ts",
  categoria: "apoio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["10 Ts", "dez Ts", "evento terminal", "colapso sem causa", "não sei o que é"],
  sinais: ["colapso", "parada", "hipotensão sem causa", "dessaturação sem causa", "piora súbita"],
  resumo: "Crise grave e o diagnóstico não aparece: alguém lê os dez Ts em voz alta enquanto os outros sustentam oxigenação e perfusão.",
  reconhecer: [
    "Crise grave sem causa esclarecida.",
    "A lista é perioperatória e não substitui a RCP nem o tratamento em curso.",
  ],
  agirAgora: [
    { texto: "Designar alguém para ler em voz alta, enquanto os outros sustentam oxigenação e perfusão." },
    { texto: "Tubos: posição, permeabilidade, circuito e ventilação." },
    { texto: "Torrencial: hemorragia evidente ou oculta." },
    { texto: "Triptase: lembrar a anafilaxia; tratar antes de colher." },
    { texto: "Terminal: evento cardíaco primário ou ritmo." },
    { texto: "Tamponamento: cardíaco, cirúrgico ou traumático." },
    { texto: "Tensão: pneumotórax hipertensivo." },
    { texto: "Trombo: embolia coronária ou pulmonar, gás, gordura ou líquido amniótico." },
    { texto: "Tóxico: erro de fármaco, toxicidade por anestésico local, eletrólitos e metabolismo." },
    { texto: "Total: bloqueio neuraxial alto ou total." },
    { texto: "Tumor: causa intracraniana ou pressão intracraniana; não exige tumor conhecido." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Não há dose própria: abrir imediatamente o protocolo da causa.",
    "Se PCR, os fármacos do algoritmo do ritmo, com as adaptações da causa.",
  ],
  pensarEm: [
    "Rever também hipóxia, hipovolemia, acidose, glicemia, potássio e temperatura.",
    "A contagem de letras não é classificação universal de diretriz.",
  ],
  depois: ["Documentar as hipóteses descartadas e o diagnóstico final; revisar com a equipe."],
  divergencias: [],
  referencias: ["manual-23"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "hemorragia-macica", texto: "Hemorragia maciça" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "embolia-gasosa-venosa", texto: "Embolia gasosa venosa" },
    { protocolo: "toxicidade-anestesico-local", texto: "Toxicidade por anestésico local" },
    { protocolo: "bloqueio-neuroaxial-alto", texto: "Bloqueio raquidiano alto ou total" },
  ],
};

export const DEPOIS_DA_CRISE: Protocolo = {
  id: "depois-da-crise",
  titulo: "Depois da crise",
  categoria: "apoio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["resultado da crise", "pós-crise", "óbito na sala", "comunicação com a família", "debriefing"],
  sinais: ["óbito", "lesão", "evento adverso"],
  resumo: "Cuidar do paciente, da família e da equipe: continuidade e passagem estruturada, registro sem alterar o original, comunicação honesta, apoio e análise do evento.",
  reconhecer: [
    "Toda crise grave requer cuidado continuado do paciente, comunicação e apoio à equipe, mesmo sem dano aparente.",
  ],
  agirAgora: [
    { texto: "Garantir a continuidade e a passagem estruturada para a recuperação ou a UTI; chamar um colega para ajudar." },
    { texto: "Preservar prontuário, fármacos, dispositivos e registros relevantes, conforme a governança da instituição." },
    { texto: "Registrar fatos, horários, intervenções e resposta, sem alterar retrospectivamente os registros originais." },
    { texto: "Comunicar o paciente e a família de forma honesta, coordenada e respeitosa." },
    { texto: "Oferecer apoio e debriefing operacional; avaliar a aptidão da equipe para continuar.",
      detalhe: "Sem impor afastamento de duração fixa." },
    { texto: "Notificar nos canais aplicáveis e organizar a análise do evento." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: ["Não se aplica. Continuar os tratamentos específicos e evitar interrupções na transferência."],
  pensarEm: ["Complicação tardia, recorrência, falha de comunicação, fadiga e sofrimento do profissional."],
  depois: [
    "Acompanhar o paciente e a equipe e implementar melhorias.",
    "Separar o apoio psicológico voluntário da investigação de segurança; proteger a confidencialidade.",
    "Notificação e aspectos legais seguem as normas brasileiras e o fluxo da instituição.",
  ],
  divergencias: [],
  referencias: ["manual-24"],
  relacionados: [{ protocolo: "colega-afetado", texto: "O colega afetado" }],
};

export const COLEGA_AFETADO: Protocolo = {
  id: "colega-afetado",
  titulo: "O colega afetado",
  categoria: "apoio",
  populacoes: ["adulto"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["colega com problema", "dependência química", "uso de substâncias", "burnout", "saúde do médico"],
  sinais: ["colega", "substância", "conduta"],
  resumo: "Risco imediato: substituir no atendimento e assistir o colega. Depois, conversa reservada, com fatos e respeito, e o fluxo da instituição.",
  reconhecer: [
    "Sofrimento, alteração de desempenho, intoxicação ou condição que possa comprometer a segurança.",
    "Não equiparar sofrimento mental, dependência e má conduta.",
  ],
  agirAgora: [
    { texto: "Se houver risco imediato, garantir a substituição no atendimento e a assistência ao colega." },
    { texto: "Abordar com respeito e fatos observáveis; evitar acusação ou diagnóstico improvisado." },
    { texto: "Organizar uma conversa reservada com a pessoa apropriada e o apoio profissional disponível." },
    { texto: "Avaliar urgência, risco e necessidade de encaminhamento.", detalhe: "Não deixar a pessoa em situação de risco sem assistência." },
    { texto: "Conhecer os fluxos institucionais e os deveres profissionais, preservando a confidencialidade na extensão permitida." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: ["Não se aplica; não prescrever sedação nem outro tratamento empírico como resposta administrativa."],
  pensarEm: [
    "Doença clínica ou neurológica, privação de sono, luto, depressão, uso de substâncias e conflito no trabalho; a avaliação profissional define o diagnóstico.",
  ],
  depois: [
    "Acompanhar o encaminhamento, o retorno seguro e as necessidades da equipe.",
    "Separar o cuidado clínico da apuração disciplinar, quando houver.",
    "A aplicação na instituição requer o fluxo local de saúde ocupacional e de ética.",
  ],
  divergencias: [],
  referencias: ["manual-24"],
  relacionados: [{ protocolo: "depois-da-crise", texto: "Depois da crise" }],
};

export const VERIFICACAO_APARELHO: Protocolo = {
  id: "verificacao-aparelho",
  titulo: "Verificação do aparelho de anestesia",
  categoria: "apoio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["checagem do aparelho", "checklist do aparelho", "teste do aparelho"],
  sinais: ["início do dia", "antes do caso"],
  resumo: "Antes da lista, antes de cada paciente e depois de mudanças no sistema: teste do fabricante, gases, monitores, circuito, vaporizadores, aspiração e o material de resgate.",
  reconhecer: [
    "Antes da lista, antes de cada paciente e depois de alterações relevantes no sistema.",
    "O autoteste não substitui todas as verificações exigidas pelo fabricante.",
  ],
  agirAgora: [
    { texto: "Confirmar a manutenção e a liberação e concluir o teste do fabricante." },
    { texto: "Verificar a alimentação elétrica, a bateria, o O2 da rede e a reserva.",
      detalhe: "Pressões conforme o equipamento e a rede, sem adotar 400 a 500 kPa como faixa universal." },
    { texto: "Analisador de O2, oxímetro, capnografia e alarmes funcionando e ajustados." },
    { texto: "Conferir circuito, conexões, válvulas, vazamentos, absorvedor, ventilador e modo manual." },
    { texto: "Vaporizadores corretos, montados e travados, sem vazamento; sistema de exaustão adequado." },
    { texto: "Testar a aspiração e garantir o ressuscitador autoinflável e uma fonte de O2 alternativa." },
    { texto: "Material de via aérea e de resgate e fármacos disponíveis.",
      detalhe: "Falha não resolvida: retirar o aparelho de uso e substituir." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Não se aplica. Conferir vaporizador e agente e as seringas separadamente.",
    "Não testar o equipamento conectado ao paciente quando houver risco.",
  ],
  pensarEm: ["Falha de energia ou de gás, circuito mal montado, válvula ou filtro, vaporizador, exaustão e alarmes desativados."],
  depois: [
    "Registrar a checagem ou a falha e repetir os testes relevantes depois de troca, montagem ou manutenção.",
    "A lista final deve ser específica do modelo: complementar com o manual do fabricante do aparelho usado.",
  ],
  divergencias: [
    {
      tema: "Pressão da rede de gases",
      posicoes: [{ texto: "Outros gases conectados; pressões da rede entre 400 e 500 kPa.", referencia: "manual-35" }],
      escolha: "O protocolo confere as pressões pelo equipamento e pela rede da instituição, sem adotar 400 a 500 kPa como faixa universal.",
    },
  ],
  referencias: ["manual-35"],
  relacionados: [{ protocolo: "verificacao-pre-inducao", texto: "Verificação pré-indução" }],
};

export const PRE_INDUCAO: Protocolo = {
  id: "verificacao-pre-inducao",
  titulo: "Verificação pré-indução",
  categoria: "apoio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["checklist pré-indução", "antes da indução", "pausa", "time-out"],
  sinais: ["antes da indução", "antes do bloqueio"],
  resumo: "Uma pausa antes de induzir ou bloquear: paciente e procedimento, riscos, equipamento, plano e contingência, fármaco conferido e pré-oxigenação eficaz.",
  reconhecer: ["Pausa antes da indução ou do bloqueio, adaptada à urgência e ao risco."],
  agirAgora: [
    { texto: "Confirmar paciente, procedimento, lado, consentimento e avaliação pré-anestésica." },
    { texto: "Rever alergias, jejum e risco de aspiração, comorbidades, acesso, peso em kg e exames pertinentes." },
    { texto: "Equipamento e monitorização testados; limites e alarmes ajustados." },
    { texto: "Comunicar o plano, o risco, as funções e a contingência; saber como chamar ajuda." },
    { texto: "Preparar a via aérea principal e a de resgate; sangue, se pertinente; dantroleno e lipídio onde indicados." },
    { texto: "Conferir fármaco, dose, diluição, via e rótulo antes de cada injeção." },
    { texto: "Pré-oxigenar e avaliar a eficácia conforme a técnica e a monitorização.",
      detalhe: "A curva de CO2 na máscara não é medida única de pré-oxigenação." },
    { texto: "Depois da indução: confirmar continuamente ventilação e via aérea, circulação, oxigenação, anestesia e CO2." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Planejar por paciente e indicação, com o peso apropriado e os limites.",
    "Não calcular silenciosamente por peso estimado; dupla checagem dos fármacos de alta vigilância.",
  ],
  pensarEm: ["Via aérea difícil, aspiração, hemorragia, anafilaxia, instabilidade, acesso insuficiente e erro de medicação."],
  depois: [
    "Registrar a checagem e atualizar o plano se a condição mudar; manter a comunicação aberta durante todo o caso.",
    "Complementar com a lista de cirurgia segura e os protocolos da instituição.",
  ],
  divergencias: [],
  referencias: ["manual-36"],
  relacionados: [{ protocolo: "verificacao-aparelho", texto: "Verificação do aparelho de anestesia" }],
};
