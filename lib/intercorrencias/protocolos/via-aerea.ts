/**
 * A VIA AÉREA DIFÍCIL NÃO PREVISTA — cartões 10 a 12 da minuta de validação de
 * 15/10/2026: ventilação com máscara difícil, intubação difícil e não ventilo,
 * não intubo (não intubo, não oxigeno).
 *
 * Base: Manual de Crises (abas 09 a 11). Complemento adulto: DAS 2025, que não
 * fundamenta extrapolação pediátrica. A técnica e os limites definitivos
 * correspondem ao algoritmo de via aérea adotado pelo serviço. O texto é do
 * AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { SUGAMADEX_100 } from "./comum.ts";

export const VENTILACAO_MASCARA: Protocolo = {
  id: "ventilacao-mascara-dificil",
  titulo: "Dificuldade de ventilação com máscara",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["não ventila", "máscara difícil", "ventilação difícil", "falha de ventilação sob máscara"],
  sinais: ["não ventila", "não consigo ventilar", "tórax não expande", "sem curva de capnografia", "bolsa não esvazia",
    "vazamento na máscara", "dessaturação"],
  resumo: "Separar vedação, obstrução e falha do sistema; cada tentativa com uma mudança útil e, sem ventilação eficaz, supraglótico — sem número fixo de tentativas enquanto a oxigenação piora.",
  reconhecer: [
    "Excursão torácica ou volume insuficientes, vazamento importante, resistência, capnograma inadequado ou dessaturação.",
    "Distinguir vedação, obstrução e falha do sistema.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, O2 a 100%, alto fluxo e vigilância da SpO2 e do tempo." },
    { texto: "Confirmar o circuito; se houver dúvida, ressuscitador autoinflável com fonte confiável." },
    { texto: "Otimizar a posição conforme o paciente, vedação a duas mãos, tração mandibular e cânula adequada; aspirar se necessário." },
    { texto: "Corrigir plano e tônus; tratar o laringoespasmo.", detalhe: "Cada tentativa deve ter uma mudança útil." },
    { texto: "Sem ventilação eficaz: supraglótico apropriado e operador experiente.",
      detalhe: "Não cumprir número fixo de tentativas enquanto a oxigenação piora." },
    { texto: "Oxigenação restabelecida: parar e decidir entre despertar, intubação alternativa ou continuidade segura.",
      detalhe: "Não intubo e não oxigeno: protocolo de não ventilo, não intubo." },
  ],
  medicamentos: [
    {
      id: "sugamadex-mascara", farmaco: "Sugamadex", indicacao: "Reversão imediata depois do rocurônio, no contexto aprovado",
      populacao: "adulto", via: "IV",
      dose: { usual: 16, unidade: "mg", por: "kg" }, apresentacoes: [SUGAMADEX_100],
      cuidados: [
        "Não é tratamento garantido do não intubo, não oxigeno.",
        "Não atrasar a oxigenação nem o acesso frontal.",
        "Não extrapolar a indicação pediátrica sem conferir a bula.",
      ],
      referencias: ["das-2025"],
    },
  ],
  volumes: [],
  notasDeDose: ["Fármacos conforme a causa e o plano de via aérea."],
  pensarEm: [
    "Obstrução por partes moles, laringoespasmo, secreções, broncoespasmo, equipamento e rigidez torácica.",
  ],
  depois: [
    "Documentar a técnica eficaz, a dificuldade e o plano futuro.",
    "Informar o paciente, entregar o registro e planejar a extubação e a recuperação.",
  ],
  divergencias: [],
  referencias: ["manual-09", "das-2025"],
  relacionados: [
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
    { protocolo: "nao-ventilo-nao-intubo", texto: "Não ventilo, não intubo" },
    { protocolo: "laringoespasmo", texto: "Laringoespasmo" },
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
  ],
};

export const INTUBACAO_DIFICIL: Protocolo = {
  id: "intubacao-dificil",
  titulo: "Intubação difícil não prevista",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["via aérea difícil", "não intubo", "intubação difícil", "falha de intubação", "Cormack"],
  sinais: ["não intubo", "não vejo a glote", "tubo não passa", "várias tentativas", "dessaturação"],
  resumo: "Reoxigenar entre as tentativas, só tentar de novo com uma mudança útil e, na falha, supraglótico de segunda geração; oxigenação e trauma decidem o escalonamento.",
  reconhecer: [
    "Falha de intubação depois de tentativa otimizada, ou dificuldade inesperada.",
    "Oxigenação e trauma, além do número de tentativas, determinam o escalonamento.",
  ],
  agirAgora: [
    { texto: "Declarar a dificuldade, pedir ajuda e manter a oferta de O2." },
    { texto: "Reoxigenar por máscara; otimizar posição, anestesia, bloqueio, aspiração e dispositivo ou operador." },
    { texto: "Próxima tentativa somente com uma mudança que aumente a chance de sucesso.",
      detalhe: "Videolaringoscópio e bougie conforme a competência." },
    { texto: "Falha: declarar e usar supraglótico, de preferência de segunda geração.", detalhe: "Limites máximos não são metas a cumprir." },
    { texto: "Oxigena com máscara ou supraglótico: parar e decidir entre despertar ou abordagem alternativa.",
      detalhe: "Não intubar às cegas através do supraglótico." },
    { texto: "Falha de oxigenação apesar das melhores tentativas: declarar não intubo, não oxigeno e executar o resgate.",
      detalhe: "Não esperar dessaturação extrema." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Hipnose e bloqueio conforme o plano individual.",
    "Reversão do bloqueio não assegura via aérea pérvia.",
    "Nenhuma dose substitui o algoritmo de oxigenação.",
  ],
  pensarEm: [
    "Posição, anatomia, edema, secreção ou sangue, dispositivo inadequado, bloqueio insuficiente e limitação cervical.",
  ],
  depois: [
    "Capnografia sustentada confirma e acompanha o tubo; planejar a extubação e a recuperação.",
    "Registrar tentativas, dispositivos e visão; orientar o paciente por escrito.",
  ],
  divergencias: [
    {
      tema: "Número de tentativas de intubação",
      posicoes: [{ texto: "Até 3 tentativas otimizadas.", referencia: "manual-10" }],
      escolha: "O protocolo trata o número como limite, e não como meta: a oxigenação e o trauma decidem antes.",
    },
  ],
  referencias: ["manual-10", "das-2025"],
  relacionados: [
    { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" },
    { protocolo: "nao-ventilo-nao-intubo", texto: "Não ventilo, não intubo" },
    { protocolo: "broncoaspiracao", texto: "Broncoaspiração" },
  ],
};

export const NAO_VENTILO_NAO_INTUBO: Protocolo = {
  id: "nao-ventilo-nao-intubo",
  titulo: "Não ventilo, não intubo",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["não intubo, não oxigeno", "CICO", "NINO", "cricotireoidostomia", "cricotireoidotomia", "via aérea cirúrgica", "acesso frontal do pescoço"],
  sinais: ["não ventila", "não intubo", "SpO2 caindo", "sem curva de capnografia", "dessaturação grave"],
  resumo: "Adulto: declarar não intubo, não oxigeno e fazer o acesso frontal treinado (bisturi, bougie e tubo), sem esperar SpO2 extrema. Criança pequena tem algoritmo próprio.",
  reconhecer: [
    "Impossibilidade de manter a oxigenação por tubo, supraglótico e máscara depois de tentativas otimizadas.",
    "Não esperar SpO2 extremamente baixa.",
    "Este protocolo é do adulto: a criança pequena exige algoritmo próprio, sem extrapolar material ou técnica do adulto.",
  ],
  agirAgora: [
    { texto: "Declarar não intubo, não oxigeno; chamar ajuda e o material de acesso frontal de emergência." },
    { texto: "Garantir bloqueio adequado, continuar a oferta de O2 pela via superior e posicionar o pescoço, se permitido." },
    { texto: "Executar o acesso frontal por técnica padronizada e treinada.",
      detalhe: "Na estratégia adulta bisturi–bougie–tubo: abrir a membrana identificada e passar o bougie e o tubo com cuff, conforme o treinamento." },
    { texto: "Membrana não palpável: abordagem aberta, com identificação anatômica.", detalhe: "Não fazer punção às cegas repetida." },
    { texto: "Ventilar, confirmar com capnografia e fixar.", detalhe: "Falha: verificar posição e obstrução e pedir apoio cirúrgico imediato." },
  ],
  medicamentos: [],
  volumes: [],
  notasDeDose: [
    "Não há medicamento que substitua o acesso de resgate.",
    "Fluxo, pressão e tempos de ventilação por cateter não são receita universal: há risco de barotrauma, e a técnica depende do equipamento e da saída expiratória.",
  ],
  pensarEm: [
    "Laringoespasmo, edema ou trauma, obstrução, falha de equipamento e rigidez.",
    "Confirmar que o problema exige acesso frontal e não é apenas o circuito.",
  ],
  depois: [
    "UTI, avaliação de lesões e via aérea definitiva.",
    "Registrar a cronologia, informar o paciente e revisar o evento com a equipe.",
  ],
  divergencias: [
    {
      tema: "Técnica de acesso pelo pescoço",
      posicoes: [
        { texto: "Punção com cateter e técnica cirúrgica; as instituições diferem no apoio a uma ou às duas.", referencia: "manual-11" },
        { texto: "Bisturi–bougie–tubo no adulto.", referencia: "das-2025" },
      ],
      escolha: "O protocolo mostra a técnica bisturi–bougie–tubo e retira a minutagem de ventilação por cateter, que não é receita universal.",
    },
  ],
  referencias: ["manual-11", "das-2025"],
  relacionados: [
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
    { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" },
  ],
};
