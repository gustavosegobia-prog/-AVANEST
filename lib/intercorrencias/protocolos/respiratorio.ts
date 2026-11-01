/**
 * RESPIRATÓRIO E VIA AÉREA — a revisão de 01/11/2026, protocolos 09 a 15.
 *
 * Origem: "AVANEST — Revisão respiratória e via aérea", texto clínico enviado
 * pelo responsável médico em 01/11/2026, redigido sobre o Manual de Crises
 * (abas 09 a 15), a SBA 2024, a DAS 2025 e o QRH da Association of
 * Anaesthetists. O texto de cada passo é o do documento; nada foi resumido.
 *
 * Estado: CORRIGIDO — AGUARDANDO VALIDAÇÃO MÉDICA. Os sete entram como
 * rascunho (protocolos/rascunhos.ts): quem usa continua com a versão 2,
 * aprovada em 15/10/2026; só a prévia do responsável médico abre esta. Nenhum
 * é aprovado aqui. Aprovado um deles, ele toma o lugar da versão 2 no arquivo
 * de origem e sai da lista de rascunhos, junto com o registro em aprovacao.ts.
 *
 * Doses: as mesmas apresentações da versão 2 (protocolos/comum.ts), sem
 * concentração presumida. A dose IM da succinilcolina não vale para IO; o
 * broncodilatador inalado não vira dose IV; o salbutamol IV da criança sai da
 * calculadora até um protocolo pediátrico próprio ser validado.
 */

import type { DoseDoProtocolo, Passo, Protocolo } from "../tipos.ts";
import { INTUBACAO_DIFICIL, NAO_VENTILO_NAO_INTUBO, VENTILACAO_MASCARA } from "./via-aerea.ts";
import { LARINGOESPASMO } from "./laringoespasmo.ts";
import { PRESSAO_VIAS_AEREAS } from "./pressao-vias-aereas.ts";
import { BRONCOESPASMO } from "./broncoespasmo.ts";
import { BRONCOASPIRACAO } from "./broncoaspiracao.ts";
import { SALBUTAMOL_NEBULIZACAO } from "./comum.ts";

const REVISAO = "2026-11-01";

/** Uma dose da versão 2, com as mudanças desta; sem ela, erro (o rascunho não pode perder a dose). */
function dose(p: Protocolo, id: string, mudancas: Partial<DoseDoProtocolo> = {}): DoseDoProtocolo {
  const d = p.medicamentos.find((m) => m.id === id);
  if (!d) throw new Error(`${p.id}: dose ${id} não existe`);
  return { ...d, ...mudancas };
}

const CICO = { protocolo: "nao-ventilo-nao-intubo", texto: "Não intubo, não oxigeno — CICO" };

// ---------------------------------------------------------------------------
// 09 — Dificuldade de ventilação com máscara
// ---------------------------------------------------------------------------
export const VENTILACAO_MASCARA_V3: Protocolo = {
  ...VENTILACAO_MASCARA,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "Prioridade absoluta: oxigenar. Ajuda, O2 a 100%, sistema, posição, vedação a duas pessoas e cânulas; sem ventilação eficaz, supraglótico; sem oxigenação, CICO.",
  reconhecer: [
    "Incapacidade de estabelecer ventilação alveolar adequada com máscara facial: expansão torácica ausente ou reduzida, volume expirado insuficiente, vazamento importante, capnografia inadequada ou queda progressiva da SpO2.",
    "Distinguir obstrução anatômica, vedação inadequada, laringoespasmo e falha do sistema de ventilação.",
    "Prioridade absoluta: restabelecer a oxigenação.",
    "Algoritmo principal do adulto: crianças exigem adaptações específicas.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda e comunique a dificuldade.",
      detalhe: "Avise a equipe, peça um operador experiente e prepare equipamento alternativo de via aérea." },
    { texto: "Administre oxigênio a 100%.",
      detalhe: "Confirme o fornecimento de oxigênio, a FiO2 medida, o fluxo de gases e o funcionamento do circuito." },
    { texto: "Verifique rapidamente o sistema ventilatório.",
      detalhe: "Avalie conexões, válvulas, circuito, bolsa reservatório e máscara. Se houver dúvida sobre o aparelho, utilize ressuscitador autoinflável conectado diretamente a fonte de oxigênio confiável." },
    { texto: "Otimize o posicionamento do paciente.",
      detalhe: "Realize elevação do mento ou tração mandibular. Utilize alinhamento adequado da cabeça e do pescoço, respeitando contraindicações à mobilização cervical. Em pacientes obesos, considere posição de rampa e cabeça elevada." },
    { texto: "Melhore a vedação da máscara.",
      detalhe: "Empregue técnica com duas pessoas: uma mantém a vedação facial com as duas mãos enquanto outro profissional comprime a bolsa." },
    { texto: "Utilize dispositivos auxiliares.",
      detalhe: "Considere cânula orofaríngea ou nasofaríngea adequada à anatomia e às contraindicações. Aspire secreções quando necessário." },
    { texto: "Avalie a profundidade anestésica e o bloqueio neuromuscular.",
      detalhe: "Considere obstrução por fechamento glótico, tônus inadequado ou laringoespasmo. Corrija a causa identificada.",
      abre: { protocolo: "laringoespasmo", texto: "Laringoespasmo" } },
    { texto: "Se a ventilação permanecer ineficaz, utilize dispositivo supraglótico de resgate.",
      detalhe: "Preferir dispositivo de segunda geração, quando apropriado e disponível. A quantidade de tentativas é um limite máximo, não uma obrigação: não insistir enquanto a oxigenação se deteriora." },
    { texto: "Se a oxigenação for restabelecida, interrompa as tentativas e reavalie o plano.",
      detalhe: "Decida com a equipe entre despertar o paciente, utilizar técnica alternativa de intubação ou continuar somente quando houver condições apropriadas de segurança.",
      abre: { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" } },
    { texto: "Se não for possível oxigenar, declare CICO.",
      detalhe: "Ative imediatamente o protocolo \"Não intubo, não oxigeno\" e prepare o acesso cervical anterior de emergência no adulto.",
      abre: CICO },
  ],
  medicamentos: [
    dose(VENTILACAO_MASCARA, "sugamadex-mascara", {
      indicacao: "Reversão imediata de bloqueio profundo após rocurônio, conforme indicação aprovada",
      cuidados: [
        "Situação específica: não é tratamento garantido para CICO.",
        "Não atrasar o resgate da oxigenação nem o acesso frontal.",
        "Não extrapolar a indicação pediátrica sem conferir a bula.",
      ],
    }),
  ],
  notasDeDose: [
    "Não existe dose farmacológica universal para dificuldade de ventilação com máscara.",
    "Sedativos, hipnóticos e bloqueadores neuromusculares devem ser escolhidos conforme a causa e a situação clínica.",
  ],
  pensarEm: [
    "Obstrução por tecidos moles, laringoespasmo, secreções, broncoespasmo, aspiração, rigidez torácica, equipamento defeituoso, máscara inadequada e bloqueio neuromuscular insuficiente.",
  ],
  depois: [
    "Documentar a dificuldade, a técnica que funcionou, os dispositivos utilizados e o plano recomendado para anestesias futuras.",
    "Informar o paciente e registrar alerta de via aérea difícil quando pertinente.",
  ],
  referencias: ["manual-09", "das-2025", "sba-2024-via-aerea"],
  relacionados: [
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
    CICO,
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
  ],
};

// ---------------------------------------------------------------------------
// 10 — Intubação difícil não prevista
// ---------------------------------------------------------------------------
export const INTUBACAO_DIFICIL_V3: Protocolo = {
  ...INTUBACAO_DIFICIL,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  // A DAS 2025 é do adulto; a criança pede protocolo próprio. A gestante continua como na versão 2.
  populacoes: ["adulto", "gestante"],
  resumo: "Oxigenar antes do tubo. Plano A com a melhor técnica e tentativas limitadas; falhou, supraglótico (B); falhou, máscara final (C); sem oxigenação, CICO e acesso frontal (D).",
  reconhecer: [
    "Dificuldade inesperada para intubação traqueal após indução anestésica, apesar de tentativas otimizadas.",
    "Considerar limitações anatômicas, visibilidade glótica inadequada, dificuldade na passagem do tubo e alterações fisiológicas.",
    "A oxigenação deve ser priorizada em relação à obtenção do tubo traqueal.",
    "Algoritmo do adulto: em crianças, utilizar protocolo específico.",
  ],
  agirAgora: [
    { texto: "Declare a dificuldade e peça ajuda.",
      detalhe: "Comunique a toda a equipe que existe uma via aérea difícil não prevista." },
    { texto: "Restabeleça ou mantenha a oxigenação.",
      detalhe: "Utilize máscara facial, oxigênio a 100% e monitorização contínua com SpO2 e capnografia." },
    { texto: "Otimize as condições para a intubação.",
      detalhe: "Verifique posicionamento, aspiração, profundidade anestésica, bloqueio neuromuscular e equipamento." },
    { texto: "Utilize a melhor técnica disponível — Plano A.",
      detalhe: "Preferir videolaringoscopia quando disponível e dominada pelo operador. Considere introdutor, estilete ou broncoscópio conforme o dispositivo e a dificuldade." },
    { texto: "Limite as tentativas de intubação.",
      detalhe: "Na estratégia DAS 2025 para adultos, o limite é de até três tentativas, com possibilidade de uma tentativa adicional por profissional mais experiente. Esse limite não significa que todas devam ser realizadas: interrompa antes se houver deterioração. Cada nova tentativa deve incorporar uma mudança que aumente a probabilidade de sucesso." },
    { texto: "Se houver falha da intubação, declare a falha e avance ao Plano B.",
      detalhe: "Utilize dispositivo supraglótico, preferencialmente de segunda geração. Limite as inserções a até três tentativas, somente enquanto houver segurança clínica." },
    { texto: "Se a ventilação com supraglótico funcionar, pare, pense e comunique.",
      detalhe: "Confirme a ventilação com capnografia. A opção padrão, quando possível, é interromper a anestesia e despertar o paciente. Em situações específicas, após avaliação experiente, pode-se considerar intubação guiada por broncoscopia através do supraglótico. Não realizar intubação às cegas através do dispositivo." },
    { texto: "Se o supraglótico falhar, avance ao Plano C.",
      detalhe: "Realize uma tentativa final otimizada de ventilação com máscara facial, com duas pessoas, cânulas auxiliares, posicionamento e bloqueio adequados. Abra o kit de acesso cervical de emergência.",
      abre: { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" } },
    { texto: "Se não for possível oxigenar, declare CICO.",
      detalhe: "Não espere dessaturação extrema para reconhecer a falha. Inicie imediatamente o Plano D, de acesso frontal de emergência.",
      abre: CICO },
    { texto: "Após estabelecer a via aérea, confirme a ventilação e planeje o restante do atendimento.",
      detalhe: "Confirme CO2 expirado sustentado, fixe o dispositivo e avalie a necessidade de continuar ou suspender a cirurgia." },
  ],
  notasDeDose: [
    "Hipnóticos e bloqueadores neuromusculares devem ser individualizados.",
    "A presença de bloqueio neuromuscular adequado deve ser confirmada ou otimizada conforme o contexto e o algoritmo escolhido.",
    "A reversão do bloqueio não garante permeabilidade da via aérea nem substitui o resgate de oxigenação.",
  ],
  pensarEm: [
    "Videolaringoscópio inadequado, posicionamento ruim, trauma de via aérea, edema, sangue, secreções, bloqueio insuficiente, limitação cervical e falha de equipamento.",
  ],
  depois: [
    "Registrar o número e o tipo das tentativas.",
    "Registrar os dispositivos e as técnicas utilizados.",
    "Registrar a melhor visualização glótica obtida.",
    "Registrar as complicações.",
    "Registrar o método definitivo de obtenção da via aérea.",
    "Registrar o plano de extubação.",
    "Comunicar a dificuldade ao paciente e à equipe responsável por procedimentos futuros.",
  ],
  divergencias: [
    {
      tema: "Número de tentativas de intubação",
      posicoes: [
        { texto: "Até 3 tentativas otimizadas.", referencia: "manual-10" },
        { texto: "Até 3 tentativas, com uma adicional por profissional mais experiente; supraglótico com até 3 inserções.", referencia: "das-2025" },
      ],
      escolha: "O protocolo segue a DAS 2025 e trata o número como limite, e não como meta: a oxigenação e o trauma decidem antes.",
    },
  ],
  referencias: ["das-2025", "sba-2024-via-aerea", "manual-10"],
  relacionados: [
    CICO,
    { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};

// ---------------------------------------------------------------------------
// 11 — Não intubo, não oxigeno (CICO)
// ---------------------------------------------------------------------------
// O id continua o da versão 2 (a aprovação e os favoritos apontam para ele);
// o título passa a "Não intubo, não oxigeno — CICO". O ramo pediátrico é
// separado e não traz técnica: só impede a do adulto e diz o que é exigido.
const ADULTO = "A. Adulto — Plano D (DAS 2025)";
const CRIANCA = "B. Criança — ramo separado";
const adulto = (x: Omit<Passo, "so" | "caminho">): Passo => ({ ...x, so: ["adulto", "gestante"], caminho: ADULTO });
const crianca = (x: Omit<Passo, "so" | "caminho">): Passo => ({ ...x, so: ["pediatrico", "neonatal"], caminho: CRIANCA });

export const NAO_INTUBO_NAO_OXIGENO_V3: Protocolo = {
  ...NAO_VENTILO_NAO_INTUBO,
  titulo: "Não intubo, não oxigeno — CICO",
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  populacoes: ["adulto", "gestante", "pediatrico"],
  sinonimos: [...new Set(["não ventilo, não intubo", ...NAO_VENTILO_NAO_INTUBO.sinonimos])],
  resumo: "Declarar CICO sem esperar SpO2 extrema e fazer o acesso frontal do adulto: bisturi, bougie e tubo 6,0 com cuff, confirmado na capnografia. Criança pequena: ramo separado, sem a técnica do adulto.",
  reconhecer: [
    "Situação crítica na qual não é possível manter oxigenação adequada por intubação traqueal, dispositivo supraglótico ou ventilação com máscara, após estratégias de resgate apropriadas.",
    "Não aguardar queda extrema de SpO2 ou parada cardíaca.",
    "Algoritmo do adulto. A criança pequena tem ramo separado: não aplicar a técnica nem o tubo do adulto.",
  ],
  agirAgora: [
    adulto({ texto: "Declare imediatamente CICO.",
      detalhe: "Comunique claramente a emergência e peça ajuda especializada." }),
    adulto({ texto: "Inicie o preparo para o acesso frontal de emergência.",
      detalhe: "Distribua funções entre o operador, o assistente, o profissional responsável pela oxigenação e a equipe de apoio." }),
    adulto({ texto: "Continue oferecendo oxigênio pela via superior quando possível.",
      detalhe: "Não permita que essas tentativas atrasem o acesso definitivo." }),
    adulto({ texto: "Garanta bloqueio neuromuscular adequado.",
      detalhe: "O acesso frontal de emergência no adulto deve ser realizado com bloqueio neuromuscular apropriado." }),
    adulto({ texto: "Posicione o pescoço e identifique a anatomia.",
      detalhe: "Realize extensão cervical máxima quando viável e não contraindicada. Identifique a linha média, a laringe e a membrana cricotireóidea." }),
    adulto({ texto: "Execute o acesso frontal de emergência — Plano D.",
      detalhe: "Na estratégia adulta DAS 2025, utilize a técnica treinada de bisturi, bougie e tubo traqueal. Quando a membrana não for claramente palpável, a incisão cutânea vertical mediana permite dissecção e identificação das estruturas antes da abertura da membrana." }),
    adulto({ texto: "Estabeleça a passagem traqueal e insira o tubo.",
      detalhe: "Após identificação e abertura adequada da membrana cricotireóidea, introduza o bougie no sentido traqueal e avance tubo com cuff apropriado. O conjunto adulto DAS utiliza tubo traqueal de 6,0 mm." }),
    adulto({ texto: "Confirme a ventilação imediatamente.",
      detalhe: "Insufle o cuff, ventile com oxigênio a 100% e confirme a ventilação com capnografia de onda sustentada." }),
    adulto({ texto: "Fixe o tubo e estabilize o paciente.",
      detalhe: "Avalie oxigenação, ventilação, circulação e possíveis complicações." }),
    adulto({ texto: "Se a primeira abordagem falhar, acione resgate cirúrgico imediato.",
      detalhe: "Revise a posição e a identificação anatômica. A equipe experiente deve considerar ampliação da exposição e estratégias de resgate adequadas." }),
    crianca({ texto: "Declare CICO e peça ajuda especializada.",
      detalhe: "Comunique claramente a emergência e chame o profissional mais experiente em via aérea pediátrica." }),
    crianca({ texto: "Continue oferecendo oxigênio pela via superior quando possível.",
      detalhe: "Não permita que essas tentativas atrasem o resgate." }),
    crianca({ texto: "Não aplique a técnica nem o tubo do adulto.",
      detalhe: "Na criança pequena, o acesso frontal exige diretriz, materiais e técnica apropriados à idade, definidos pelo serviço. Este cartão ainda não traz a técnica pediátrica." }),
  ],
  material: [
    "Bisturi com lâmina nº 10.",
    "Bougie apropriado.",
    "Tubo traqueal com cuff 6,0 mm no adulto, conforme técnica DAS.",
    "Seringa para o cuff.",
    "Sistema de ventilação e capnografia.",
    "Aspirador.",
    "Equipamento de resgate cirúrgico.",
  ],
  alertas: [
    "Não aplicar essa técnica nem o tubo do adulto automaticamente em crianças pequenas: o ramo pediátrico exige diretriz, materiais e técnica apropriados à idade.",
    "Não utilizar como instrução universal a ventilação por cateter estreito com fluxos e tempos fixos: técnicas de insuflação exigem equipamento, treinamento e possibilidade de saída expiratória, com risco de barotrauma.",
    "A cricotireoidotomia é procedimento invasivo de emergência que exige treinamento prático e protocolo institucional.",
  ],
  notasDeDose: ["Não há medicamento que substitua o acesso de resgate."],
  pensarEm: [
    "Falha de intubação, supraglótico e máscara; obstrução anatômica, edema, trauma, laringoespasmo, sangue e secreções.",
  ],
  depois: [
    "Encaminhar para cuidados críticos, avaliar lesões laríngeas e traqueais, planejar a via aérea definitiva e documentar integralmente o evento.",
    "Realizar revisão do atendimento e oferecer apoio à equipe envolvida.",
  ],
  divergencias: [
    {
      tema: "Técnica de acesso pelo pescoço",
      posicoes: [
        { texto: "Punção com cateter e técnica cirúrgica; as instituições diferem no apoio a uma ou às duas.", referencia: "manual-11" },
        { texto: "Bisturi, bougie e tubo 6,0 com cuff no adulto; incisão vertical mediana quando a membrana não é palpável.", referencia: "das-2025" },
      ],
      escolha: "O protocolo segue a técnica bisturi–bougie–tubo do adulto e não traz ventilação por cateter com fluxos e tempos fixos, que não é receita universal.",
    },
  ],
  referencias: ["das-2025", "sba-2024-via-aerea", "manual-11"],
  relacionados: [
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
    { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" },
    { protocolo: "depois-da-crise", texto: "Depois da crise" },
  ],
};

// ---------------------------------------------------------------------------
// 12 — Laringoespasmo
// ---------------------------------------------------------------------------
const CONTRAINDICACOES_SUCCINILCOLINA =
  "Checar risco de hiperpotassemia, doenças neuromusculares, suscetibilidade à hipertermia maligna e outras contraindicações.";

export const LARINGOESPASMO_V3: Protocolo = {
  ...LARINGOESPASMO,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "O2 a 100%, parar o estímulo, aspirar e abrir a via aérea com CPAP; persistindo, aprofundar com propofol e, na obstrução ou deterioração, bloqueador. Sem oxigenação, CICO.",
  reconhecer: [
    "Fechamento reflexo glótico, parcial ou completo, associado a manipulação de vias aéreas, secreções, estímulo cirúrgico ou plano anestésico inadequado.",
    "Estridor inspiratório na obstrução parcial.",
    "Ausência de fluxo aéreo na obstrução completa.",
    "Movimento toracoabdominal paradoxal.",
    "Dificuldade de ventilação com máscara.",
    "Queda de SpO2 e alterações hemodinâmicas.",
    "O silêncio respiratório não exclui obstrução grave.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda e administre oxigênio a 100%." },
    { texto: "Interrompa imediatamente o estímulo desencadeante.",
      detalhe: "Suspenda a manipulação da via aérea e outras intervenções precipitantes quando possível." },
    { texto: "Remova fatores obstrutivos visíveis.",
      detalhe: "Aspire secreções e material da orofaringe sob visão adequada." },
    { texto: "Execute manobras de abertura da via aérea.",
      detalhe: "Utilize tração mandibular e ventilação com máscara bem vedada, aplicando CPAP ou pressão positiva cuidadosamente quando apropriado." },
    { texto: "Se o espasmo persistir, considere aprofundamento anestésico.",
      detalhe: "Em paciente com estabilidade suficiente, o propofol pode ser utilizado em dose titulada." },
    { texto: "Em obstrução persistente ou deterioração, administre bloqueador neuromuscular apropriado.",
      detalhe: "Não prolongue manobras ineficazes durante hipóxia grave." },
    { texto: "Restabeleça a ventilação e confirme a resposta.",
      detalhe: "Avalie excursão torácica, capnografia, SpO2 e hemodinâmica." },
    { texto: "Considere intubação traqueal quando necessária.",
      detalhe: "Indicações incluem obstrução persistente, necessidade de proteção da via aérea ou risco significativo de recorrência. Se não for possível oxigenar, ative imediatamente o protocolo CICO.",
      abre: CICO },
    { texto: "Avalie complicações após a resolução.",
      detalhe: "Investigue edema pulmonar por pressão negativa, broncoaspiração e alterações hemodinâmicas.",
      abre: { protocolo: "broncoaspiracao", texto: "Broncoaspiração" } },
  ],
  medicamentos: [
    dose(LARINGOESPASMO, "propofol-laringoespasmo", {
      indicacao: "Aprofundamento em paciente selecionado, com estabilidade suficiente",
      cuidados: ["Titular conforme a pressão arterial e o contexto clínico."],
    }),
    dose(LARINGOESPASMO, "succinilcolina-iv-laringoespasmo", {
      indicacao: "Alívio do laringoespasmo",
      cuidados: [
        "Dose para aliviar o espasmo, conforme o protocolo adotado: não confundir com a dose utilizada especificamente para intubação traqueal.",
        CONTRAINDICACOES_SUCCINILCOLINA,
      ],
    }),
    dose(LARINGOESPASMO, "succinilcolina-im-laringoespasmo", {
      indicacao: "Sem acesso vascular apropriado",
      cuidados: [
        "Conferir a dose máxima, as contraindicações e a apresentação institucional.",
        "Não aplicar automaticamente esta dose à via IO.",
        CONTRAINDICACOES_SUCCINILCOLINA,
      ],
    }),
  ],
  notasDeDose: [
    "Atenção: não aplicar automaticamente a dose IM de 4 mg/kg à via IO.",
    "Se houver bradicardia importante com comprometimento, tratar a hipóxia imediatamente e seguir o algoritmo de bradicardia apropriado à idade.",
  ],
  pensarEm: [
    "Corpo estranho, edema laríngeo, anafilaxia, paralisia de pregas vocais, secreções, broncoespasmo e obstrução do tubo.",
  ],
  depois: [
    "Manter observação respiratória.",
    "Considerar edema pulmonar por pressão negativa diante de hipoxemia persistente, estertores, secreção espumosa ou infiltrados pulmonares.",
    "Registrar o evento, os medicamentos e a resposta.",
  ],
  relacionados: [
    CICO,
    { protocolo: "bradicardia", texto: "Bradicardia grave" },
    { protocolo: "bradicardia-pediatrica", texto: "Bradicardia pediátrica" },
    { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};

// ---------------------------------------------------------------------------
// 13 — Pressão elevada das vias aéreas
// ---------------------------------------------------------------------------
export const PRESSAO_VIAS_AEREAS_V3: Protocolo = {
  ...PRESSAO_VIAS_AEREAS,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "O2 a 100% e ventilação manual; separar sistema, tubo e paciente. Hiperinsuflação com colapso pede expiração; pneumotórax hipertensivo instável, descompressão sem esperar radiografia.",
  reconhecer: [
    "Aumento de pressão no ventilador, dificuldade de ventilação manual, redução do volume expirado, alteração da capnografia ou elevação da pressão de pico.",
    "Diferenciar aumento de resistência das vias aéreas de redução da complacência pulmonar ou torácica.",
    "Pico elevado com platô relativamente preservado sugere aumento de resistência. Pico e platô elevados sugerem redução de complacência, considerando as condições de medição.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda quando houver comprometimento e administre oxigênio a 100%.",
      detalhe: "Avalie simultaneamente SpO2, EtCO2, pressão arterial e perfusão." },
    { texto: "Passe à ventilação manual para avaliação rápida.",
      detalhe: "Avalie a resistência e a complacência percebidas. Não prolongue ventilação com pressões excessivas." },
    { texto: "Inspecione o sistema ventilatório.",
      detalhe: "Verifique circuito, válvulas, conexões, filtros, dobraduras e obstruções. Se houver suspeita de falha do sistema, utilize ressuscitador diretamente conectado à via aérea, com oxigênio confiável." },
    { texto: "Verifique a posição e a permeabilidade do tubo traqueal.",
      detalhe: "Avalie profundidade, mordedura, secreções, obstrução e intubação seletiva. Utilize cateter de aspiração quando apropriado.",
      abre: { protocolo: "intubacao-esofagica-seletiva", texto: "Intubação esofágica ou seletiva" } },
    { texto: "Avalie possível hiperinsuflação dinâmica.",
      detalhe: "Verifique expiração incompleta, auto-PEEP e aprisionamento aéreo. Em colapso hemodinâmico por suspeita de hiperinsuflação, pode ser necessária desconexão breve para permitir a expiração, seguida de correção dos parâmetros ventilatórios." },
    { texto: "Avalie causas pulmonares e torácicas.",
      detalhe: "Considere broncoespasmo, pneumotórax hipertensivo, edema pulmonar, broncoaspiração e alterações de complacência.",
      abre: { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" } },
    { texto: "Trate imediatamente causas críticas.",
      detalhe: "Na suspeita clínica de pneumotórax hipertensivo com instabilidade, realize descompressão urgente por profissional habilitado, sem esperar radiografia.",
      abre: { protocolo: "pneumotorax-hipertensivo", texto: "Pneumotórax hipertensivo" } },
    { texto: "Reavalie fatores cirúrgicos e anestésicos.",
      detalhe: "Considere pneumoperitônio, posicionamento, compressão externa, bloqueio inadequado ou rigidez torácica." },
    { texto: "Reavalie a ventilação após a intervenção.",
      detalhe: "Confira volume expirado, capnograma, pressão de pico, pressão de platô quando disponível, oxigenação e estabilidade hemodinâmica." },
  ],
  notasDeDose: [
    "Não existe medicamento universal para pressão elevada das vias aéreas.",
    "Usar os protocolos correspondentes: broncoespasmo grave, laringoespasmo, anafilaxia, pneumotórax hipertensivo e obstrução de via aérea.",
  ],
  pensarEm: [
    "Obstrução do tubo, tubo seletivo, broncoespasmo, laringoespasmo, rigidez torácica, auto-PEEP, pneumotórax, edema pulmonar, falha de circuito e compressão externa.",
  ],
  depois: [
    "Monitorizar pressões respiratórias, volumes, gasometria e imagem quando indicadas.",
    "Registrar a causa identificada e a intervenção eficaz.",
  ],
  relacionados: [
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "pneumotorax-hipertensivo", texto: "Pneumotórax hipertensivo" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};

// ---------------------------------------------------------------------------
// 14 — Broncoespasmo grave
// ---------------------------------------------------------------------------
// Doses: as da versão 2 (QRH 3-4, v3 de 2023), com duas mudanças. Entra o
// aerossol dosimetrado do adulto (6 a 8 jatos de 100 mcg, sem volume: é
// contado em jatos) e a nebulização de 2,5 a 5 mg da criança de 5 anos ou
// mais. Sai da calculadora o salbutamol IV da criança (bolus e infusão): o
// texto pede um protocolo pediátrico específico, validado, antes de habilitar.
export const BRONCOESPASMO_V3: Protocolo = {
  ...BRONCOESPASMO,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "O2 a 100%, excluir obstrução mecânica, salbutamol inalado e ipratrópio, expiração longa; refratário, magnésio e broncodilatador IV monitorizado. Suspeita de anafilaxia: protocolo próprio, com adrenalina.",
  reconhecer: [
    "Broncoconstrição intensa com dificuldade de ventilação, aumento de resistência, prolongamento expiratório, alteração obstrutiva da capnografia, redução do volume corrente ou instabilidade hemodinâmica.",
    "Sibilos podem estar presentes. Na obstrução extrema, pode ocorrer tórax silencioso.",
    "Considerar anafilaxia como diagnóstico diferencial crítico, mesmo sem manifestações cutâneas.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda.",
      detalhe: "Informe a equipe e interrompa estímulos desencadeantes quando possível." },
    { texto: "Administre oxigênio a 100%.",
      detalhe: "Garanta oferta e ventilação adequadas." },
    { texto: "Exclua obstrução mecânica.",
      detalhe: "Verifique tubo traqueal, seletividade, conexões, filtros, secreções e problemas do circuito.",
      abre: { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" } },
    { texto: "Considere aprofundamento anestésico.",
      detalhe: "Em paciente hemodinamicamente estável, corrija anestesia superficial e remova estímulos irritativos." },
    { texto: "Administre salbutamol inalatório.",
      detalhe: "Utilize aerossol dosimetrado por adaptador ou nebulização integrada ao circuito, assegurando que o medicamento alcance a via aérea." },
    { texto: "Considere associação de ipratrópio.",
      detalhe: "Especialmente no broncoespasmo importante ou com resposta insuficiente ao beta-agonista inalado." },
    { texto: "Ajuste a ventilação.",
      detalhe: "Reduza o aprisionamento aéreo, prolongue o tempo expiratório e avalie auto-PEEP. Evite frequência respiratória ou pressão excessiva. Hipercapnia permissiva pode ser considerada em situações apropriadas, desde que respeitadas contraindicações e repercussões hemodinâmicas." },
    { texto: "Se houver resposta insuficiente, considere medicamentos adicionais.",
      detalhe: "Magnésio IV, broncodilatadores IV e outros adjuvantes podem ser utilizados em contexto monitorizado e com avaliação especializada." },
    { texto: "Avalie anafilaxia e instabilidade hemodinâmica.",
      detalhe: "Se houver suspeita de anafilaxia, abra o protocolo específico, com adrenalina apropriada. A adrenalina IV no broncoespasmo isolado não deve ser apresentada como primeira linha universal.",
      abre: { protocolo: "anafilaxia", texto: "Anafilaxia" } },
    { texto: "Reavalie continuamente e considere suporte intensivo.",
      detalhe: "Monitore pressões das vias aéreas, curvas do ventilador, EtCO2, SpO2, gasometria e hemodinâmica." },
  ],
  medicamentos: [
    {
      id: "salbutamol-aerossol-adulto", farmaco: "Salbutamol", indicacao: "Aerossol dosimetrado, por adaptador no circuito",
      populacao: "adulto", via: "Inalatória",
      dose: { min: 600, max: 800, unidade: "mcg", por: "fixa" }, apresentacoes: [],
      semVolume: "6 a 8 jatos de 100 mcg",
      repeticao: "Conforme a resposta e o protocolo.",
      cuidados: ["Número de jatos conforme o dispositivo e a gravidade.", "Dose inalatória: não converter para a via IV."],
      referencias: ["manual-14", "qrh-3-4"],
    },
    dose(BRONCOESPASMO, "salbutamol-neb-adulto", {
      repeticao: "Conforme a resposta e o protocolo.",
      cuidados: ["Solução para nebulização: não é a apresentação injetável."],
    }),
    dose(BRONCOESPASMO, "ipratropio-adulto"),
    dose(BRONCOESPASMO, "salbutamol-iv-adulto", {
      indicacao: "Segunda linha — bolus em situação selecionada",
      cuidados: ["Com monitorização.", "Monitorar arritmia, potássio, glicose e lactato com β2 IV.", "Usar apenas a apresentação injetável."],
    }),
    dose(BRONCOESPASMO, "salbutamol-infusao-adulto", {
      indicacao: "Segunda linha — infusão, titulada",
      cuidados: ["Titular com monitorização.", "Monitorar arritmia, potássio, glicose e lactato com β2 IV.", "Usar apenas a apresentação injetável."],
    }),
    dose(BRONCOESPASMO, "magnesio-broncoespasmo-adulto", { indicacao: "Quando indicado", velocidade: "Em aproximadamente 20 minutos." }),
    dose(BRONCOESPASMO, "hidrocortisona-adulto", {
      indicacao: "Adjuvante, em indicação apropriada",
      cuidados: ["Até 200 mg, de acordo com o protocolo e o contexto.", "Não produz reversão imediata do broncoespasmo."],
    }),
    dose(BRONCOESPASMO, "salbutamol-neb-ped"),
    {
      id: "salbutamol-neb-ped-maior", farmaco: "Salbutamol", indicacao: "Nebulizado — 5 anos ou mais", populacao: "pediatrico", via: "Inalatória",
      idadeAnos: { min: 5 },
      dose: { min: 2.5, max: 5, unidade: "mg", por: "fixa" }, apresentacoes: [SALBUTAMOL_NEBULIZACAO],
      cuidados: ["Conforme a idade, a gravidade e o protocolo."],
      referencias: ["qrh-3-4"],
    },
    dose(BRONCOESPASMO, "ipratropio-ped", { idadeAnos: { min: 2, max: 12 } }),
    dose(BRONCOESPASMO, "magnesio-broncoespasmo-ped", { indicacao: "Quando indicado", velocidade: "Em aproximadamente 20 minutos." }),
    dose(BRONCOESPASMO, "hidrocortisona-ped"),
  ],
  alertas: [
    "Utilizar exclusivamente apresentação própria para administração IV quando a via for intravenosa.",
    "Não confundir solução para nebulização com solução injetável.",
  ],
  notasDeDose: [
    "Salbutamol IV na criança: exige protocolo pediátrico específico. A referência de infusão de 0,5 a 1 mcg/kg/min, até 20 mcg/min, deve ser validada para a indicação, a idade e a monitorização antes de habilitar a calculadora.",
    "Monitorar potássio, glicose, lactato, frequência cardíaca e arritmias quando utilizar beta-agonistas sistêmicos.",
    "Não utilizar desconexão periódica do circuito como rotina: reservar a medida para suspeita relevante de hiperinsuflação dinâmica, com monitorização.",
    "Magnésio a 10%: a dose em mg dividida por 100 dá o volume em mL.",
    "Aminofilina não integra a primeira linha deste protocolo.",
    "Adrenalina, ketamina e outros medicamentos de resgate exigem indicação e dose validadas separadamente.",
  ],
  pensarEm: [
    "Anafilaxia, aspiração, obstrução mecânica, intubação seletiva, pneumotórax, auto-PEEP, edema pulmonar e ventilação inadequada.",
  ],
  depois: [
    "Monitorização respiratória e hemodinâmica.",
    "Avaliar a necessidade de UTI.",
    "Investigar o fator desencadeante.",
  ],
  divergencias: BRONCOESPASMO.divergencias.map((d) => (/criança/.test(d.tema) ? {
    ...d,
    escolha: "A calculadora pediátrica do salbutamol IV fica desabilitada até um protocolo pediátrico específico ser validado; as duas posições ficam registradas.",
  } : d)),
  relacionados: [
    { protocolo: "anafilaxia", texto: "Anafilaxia" },
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};

// ---------------------------------------------------------------------------
// 15 — Broncoaspiração
// ---------------------------------------------------------------------------
export const BRONCOASPIRACAO_V3: Protocolo = {
  ...BRONCOASPIRACAO,
  versao: 3,
  atualizadoEm: REVISAO,
  revisadoEm: REVISAO,
  resumo: "Evitar mais aspiração, aspirar sob visão, proteger a via aérea sem tirar o tubo bem posicionado e oxigenar; antibiótico e corticoide não são rotina, e a alta não segue regra fixa.",
  reconhecer: [
    "Aspiração de conteúdo gástrico, secreções ou material particulado para as vias aéreas durante anestesia ou procedimento.",
    "Pode ocorrer regurgitação observada, hipoxemia, tosse, broncoespasmo, aumento de pressão das vias aéreas ou deterioração respiratória tardia.",
    "Distinguir pneumonite química por aspiração de pneumonia bacteriana aspirativa.",
  ],
  agirAgora: [
    { texto: "Solicite ajuda e comunique a ocorrência.",
      detalhe: "Interrompa a manipulação ou o procedimento quando viável e avise a equipe cirúrgica." },
    { texto: "Evite aspiração adicional.",
      detalhe: "Considere posicionamento lateral e redução da elevação da cabeça quando apropriado e seguro, sem comprometer a oxigenação ou o manejo da via aérea." },
    { texto: "Aspire imediatamente o material visível da orofaringe.",
      detalhe: "Utilize aspiração sob visão adequada." },
    { texto: "Proteja a via aérea.",
      detalhe: "Considere intubação traqueal com cuff quando indicada e ainda não realizada. Se já existir tubo corretamente posicionado com cuff, não o retire automaticamente." },
    { texto: "Administre oxigênio e suporte ventilatório.",
      detalhe: "Corrija a hipoxemia. Se ocorrer insuficiência respiratória, utilize ventilação e suporte apropriados. Não prolongue a aspiração quando isso atrasar a oxigenação necessária.",
      abre: { protocolo: "dessaturacao", texto: "Dessaturação súbita" } },
    { texto: "Avalie aspiração traqueobrônquica e broncoscopia.",
      detalhe: "Considere broncoscopia para material particulado, obstrução ou necessidade diagnóstica. Não realize lavagem pulmonar indiscriminadamente." },
    { texto: "Avalie a descompressão gástrica e a continuidade da cirurgia.",
      detalhe: "Quando apropriado e após proteção da via aérea, considere sonda gástrica. A decisão de continuar ou interromper o procedimento deve considerar estabilidade, gravidade e urgência da cirurgia." },
    { texto: "Estabeleça monitorização e plano de acompanhamento.",
      detalhe: "Avalie a evolução respiratória, a oxigenação, a necessidade de ventilação prolongada e a indicação de UTI." },
  ],
  notasDeDose: [
    "Broncodilatadores: utilizar quando houver broncoespasmo clinicamente relevante.",
    "Antibióticos: não iniciar profilaticamente de rotina em pneumonite química inicial sem evidência de infecção; considerar quando houver suspeita clínica de pneumonia bacteriana ou outras indicações específicas.",
    "Corticosteroides: não administrar rotineiramente apenas para tratar pneumonite química aspirativa; podem ser utilizados por outra indicação clínica independente.",
    "Suporte respiratório: ajustar oxigênio, ventilação e PEEP conforme a situação clínica, a resposta e a proteção pulmonar.",
  ],
  pensarEm: [
    "Pneumonite química, pneumonia aspirativa, broncoespasmo, atelectasia, edema pulmonar, obstrução por material particulado e síndrome do desconforto respiratório agudo.",
  ],
  depois: [
    "Realizar avaliação clínica e respiratória seriada.",
    "Solicitar gasometria e imagem pulmonar quando indicadas.",
    "Não utilizar ausência de sintomas por apenas duas horas ou radiografia inicial normal como critérios universais de alta.",
    "Definir recuperação anestésica, internação ou terapia intensiva de acordo com a evolução.",
    "Registrar o evento, comunicar o paciente e revisar medidas preventivas para procedimentos futuros.",
  ],
  referencias: ["manual-15", "ahrq-aspiracao"],
  relacionados: [
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
    { protocolo: "dessaturacao", texto: "Dessaturação súbita" },
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
  ],
};

/** Os sete, na ordem do Manual (09 a 15). */
export const RESPIRATORIO_V3: readonly Protocolo[] = [
  VENTILACAO_MASCARA_V3, INTUBACAO_DIFICIL_V3, NAO_INTUBO_NAO_OXIGENO_V3, LARINGOESPASMO_V3,
  PRESSAO_VIAS_AEREAS_V3, BRONCOESPASMO_V3, BRONCOASPIRACAO_V3,
];
