/**
 * REANIMAÇÃO NEONATAL — o recém-nascido na sala de parto.
 *
 * Sequência do Manual de Crises (protocolo 19, lido no livro) e as doses e
 * metas das diretrizes 2022 da Sociedade Brasileira de Pediatria para o
 * recém-nascido de 34 semanas ou mais (texto completo lido). Onde diferem —
 * saturação alvo por minuto e frequência da ventilação — as posições ficam em
 * `divergencias`. O texto é do AVANEST.
 */

import type { ApresentacaoDoProtocolo, Protocolo } from "../tipos.ts";

/** A SBP usa a mesma diluição para a veia e para a cânula: muda a seringa (1 mL e 5 mL) e a dose. */
const ADRENALINA_100_RN: ApresentacaoDoProtocolo = {
  rotulo: "1 mg em 10 mL — 100 mcg/mL", quantidade: 100, unidade: "mcg", mL: 1, vias: ["IV", "Tubo"],
  preparo: "1 mL da ampola de 1 mg/mL + 9 mL de SF 0,9%",
};

export const REANIMACAO_NEONATAL: Protocolo = {
  id: "reanimacao-neonatal",
  titulo: "Reanimação neonatal",
  categoria: "pediatria",
  populacoes: ["neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["recém-nascido", "RN", "reanimação do recém-nascido", "suporte de vida neonatal", "sala de parto"],
  sinais: ["apneia", "respiração irregular", "hipotônico", "bradicardia", "FC abaixo de 100", "FC abaixo de 60", "cianose", "nascimento"],
  resumo: "Minuto de ouro: aquecer, abrir a via aérea e ventilar em ar ambiente; FC abaixo de 60 com ventilação adequada, massagem 3:1 com O2 a 100%; adrenalina e volume se não responder.",
  reconhecer: [
    "Ao nascer: tônus, respiração e frequência cardíaca. A cor não é confiável; palidez sugere acidose ou anemia.",
    "A frequência cardíaca guia cada passo; a SpO2 pré-ductal (mão direita) guia o oxigênio.",
    "Ventilação e massagem bem-feitas bastam para quase todos: medicação é rara.",
    "Este protocolo segue a diretriz para 34 semanas ou mais; o prematuro abaixo de 34 semanas tem diretriz própria da SBP.",
  ],
  agirAgora: [
    { texto: "Ligar o cronômetro; secar, aquecer e cobrir o bebê.",
      detalhe: "Sala a 23–25 °C; manter a temperatura entre 36,5 e 37,5 °C." },
    { texto: "Avaliar tônus, respiração e frequência cardíaca." },
    { texto: "Hipotônico, respiração irregular ou apneia: abrir a via aérea e ventilar com pressão positiva em ar ambiente no primeiro minuto.",
      detalhe: "Cabeça em posição neutra. Primeiras insuflações longas (2–3 s, 15–30 cmH2O, Manual); depois cerca de 25 cmH2O com PEEP de 5 (SBP)." },
    { texto: "FC sem subir ou tórax sem expandir: pedir ajuda, oxímetro na mão direita e monitor cardíaco." },
    { texto: "Corrigir a ventilação antes de subir o O2.",
      detalhe: "Reposicionar a cabeça, tração da mandíbula, cânula de Guedel; ver a faringe, aspirar com delicadeza (a aspiração nasofaríngea causa bradicardia); máscara laríngea ou intubação." },
    { texto: "Ajustar o O2 pela SpO2 alvo para os minutos de vida; evitar hiperóxia." },
    { texto: "Ventilação adequada e FC abaixo de 60: massagem cardíaca coordenada, 3:1, com O2 a 100%.",
      detalhe: "120 eventos por minuto: 90 compressões e 30 ventilações, sem comprimir e ventilar ao mesmo tempo." },
    { texto: "Reavaliar a cada 30 a 60 segundos; FC ainda abaixo de 60: adrenalina pela veia umbilical (ou intraóssea).",
      detalhe: "Sem acesso: uma dose pela cânula traqueal enquanto se obtém o acesso." },
    { texto: "Hipovolemia ou perda de sangue: SF 10 mL/kg em 5 a 10 minutos; repetir se preciso." },
    { texto: "Avisar a UTI neonatal e preparar a conversa com a família." },
  ],
  medicamentos: [
    {
      id: "adrenalina-rn-iv", farmaco: "Adrenalina", indicacao: "FC abaixo de 60 apesar de ventilação e massagem",
      populacao: "pediatrico", via: "IV (veia umbilical) ou IO",
      dose: { min: 10, usual: 20, max: 30, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_100_RN], altoRisco: true,
      repeticao: "A cada 3 a 5 minutos. Seringa de 1 mL: 0,2 mL/kg na prática (SBP). Nunca acima de 100 mcg/kg por qualquer via.",
      referencias: ["sbp-2022-rn", "manual-19"],
    },
    {
      id: "adrenalina-rn-tubo", farmaco: "Adrenalina", indicacao: "Uma vez, enquanto não há acesso venoso",
      populacao: "pediatrico", via: "Tubo traqueal",
      dose: { usual: 100, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_100_RN], altoRisco: true,
      repeticao: "Uso único; a eficácia é questionável. Seringa de 5 mL: 1 mL/kg.",
      cuidados: ["Cinco vezes a dose da veia: a seringa da cânula não vai para o acesso."],
      referencias: ["sbp-2022-rn"],
    },
  ],
  volumes: [
    { id: "expansor-rn", rotulo: "Soro fisiológico 0,9%", grupo: "Expansor de volume", indicacao: "Hipovolemia ou perda de sangue", populacao: "pediatrico",
      porKg: { min: 10 }, repeticao: "Em 5 a 10 minutos; repetir se indicado. Concentrado de hemácias O negativo só na suspeita de anemia fetal grave.",
      referencias: ["sbp-2022-rn", "manual-19"] },
  ],
  pensarEm: [
    "Ventilação ineficaz é a causa mais comum de não responder: máscara, posição, pressão, cânula.",
    "Pneumotórax.",
    "Hipovolemia: descolamento, prolapso de cordão, perda fetal.",
    "Obstrução da via aérea: secreção espessa, mecônio, malformação.",
  ],
  depois: [
    "Bicarbonato e naloxona não são recomendados na sala de parto.",
    "Depois da reanimação: evitar hiperóxia; EtCO2, glicemia e temperatura normais; evitar temperatura acima de 38 °C.",
    "Hipotermia terapêutica para a encefalopatia hipóxico-isquêmica: decidir na UTI neonatal (o Manual fala em iniciar até 6 horas de vida), mantendo a normotermia no transporte.",
    "Registrar os horários: nascimento, início da ventilação, massagem, cada dose e a resposta.",
  ],
  divergencias: [
    {
      tema: "SpO2 pré-ductal alvo",
      posicoes: [
        { texto: "Aceitável: 60% aos 2 min, 70% aos 3, 80% aos 4, 85% aos 5 e 90% aos 10 minutos.", referencia: "manual-19" },
        { texto: "Alvo: 70–80% até 5 min, 80–90% de 5 a 10 min e 85–95% depois de 10 minutos.", referencia: "sbp-2022-rn" },
      ],
      escolha: "As duas tabelas estão aqui; a da SBP é a brasileira e dá faixas com teto, contra a hiperóxia.",
    },
    {
      tema: "Frequência da ventilação",
      posicoes: [
        { texto: "Depois que a FC sobe, 30 a 40 por minuto.", referencia: "manual-19" },
        { texto: "40 a 60 movimentos por minuto.", referencia: "sbp-2022-rn" },
      ],
      escolha: "O protocolo não fixa número no passo; o revisor escolhe.",
    },
    {
      tema: "Dose de adrenalina",
      posicoes: [
        { texto: "10 mcg/kg, podendo subir para 30 mcg/kg (a frente do cartão diz “10–30 mcg”, sem o por kg).", referencia: "manual-19" },
        { texto: "0,01 a 0,03 mg/kg EV; na prática, 0,02 mg/kg (0,2 mL/kg da diluição 1 mg/10 mL).", referencia: "sbp-2022-rn" },
      ],
      escolha: "O protocolo calcula 10, 20 e 30 mcg/kg, com 20 em destaque (SBP). O “10–30 mcg” sem kg parece erro de impressão.",
    },
  ],
  referencias: ["sbp-2022-rn", "manual-19"],
  relacionados: [
    { protocolo: "colapso-materno", texto: "Colapso materno" },
    { protocolo: "sav-pediatrico", texto: "Suporte avançado de vida pediátrico" },
  ],
};
