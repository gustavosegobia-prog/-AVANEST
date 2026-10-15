/**
 * BRONCOASPIRAÇÃO — qualquer idade.
 *
 * Sequência do Manual de Crises (protocolo 15, lido no livro) e quadro A do
 * QRH 3-4 da Association of Anaesthetists (aberto e lido). Não tem dose:
 * corticoide e antibiótico não entram no tratamento imediato. O texto é do
 * AVANEST.
 */

import type { Protocolo } from "../tipos.ts";

export const BRONCOASPIRACAO: Protocolo = {
  id: "broncoaspiracao",
  titulo: "Broncoaspiração",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico", "neonatal"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["aspiração", "aspiração pulmonar", "regurgitação", "vômito", "Mendelson"],
  sinais: ["vômito", "regurgitação", "conteúdo gástrico na faringe", "secreção no tubo", "dessaturação", "broncoespasmo", "pressão alta"],
  resumo: "Cabeça para baixo e de lado, aspirar a faringe, intubar e aspirar a árvore brônquica antes de ventilar com pressão, se a SpO2 permitir; esvaziar o estômago antes de despertar.",
  reconhecer: [
    "Conteúdo gástrico na faringe, na máscara ou no tubo.",
    "Depois: dessaturação, broncoespasmo, pressão alta na via aérea, estertores.",
    "No NAP4, mais da metade das mortes por via aérea na anestesia foram por broncoaspiração.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, avisar o cirurgião e dividir as funções.",
      detalhe: "Agir rápido (virar o paciente, por exemplo) limita o quanto é aspirado." },
    { texto: "Cabeça para baixo e considerar o decúbito lateral esquerdo.",
      detalhe: "A posição depende da cirurgia e do que é possível na mesa." },
    { texto: "Retirar os dispositivos e aspirar a faringe." },
    { texto: "Intubar e aspirar a árvore brônquica.",
      detalhe: "Pressão cricoide pode ser usada durante a intubação, mas não durante vômito ativo." },
    { texto: "Ventilar com O2 a 100% e depois titular para SpO2 normal.",
      detalhe: "Fazer os passos anteriores antes de ventilar com pressão, se a SpO2 permitir." },
    { texto: "Aspiração grave: só seguir com a cirurgia se for de emergência." },
    { texto: "Sonda gástrica e esvaziar o estômago antes de despertar." },
    { texto: "Avaliar a necessidade de UTI." },
  ],
  medicamentos: [],
  volumes: [],
  pensarEm: [
    "Do paciente: jejum inadequado, esvaziamento gástrico lento, esfíncter esofágico inferior incompetente (emergência, gestação, diabetes, obesidade, hérnia de hiato, refluxo).",
    "Da cirurgia: trato digestivo alto, posição de litotomia ou cabeça baixa, laparoscopia, colecistectomia.",
    "Da anestesia: plano superficial, supraglótico, ventilação com pressão positiva, via aérea difícil, cirurgia longa.",
    "Bloqueio neuromuscular residual reduz o tônus do esfíncter esofágico superior: risco também na recuperação.",
  ],
  depois: [
    "Aspiração leve, paciente sem sintomas em 2 horas, com radiografia de tórax e SpO2 normais: pode dispensar a UTI.",
    "Material particulado indica aspiração mais grave: UTI no pós-operatório.",
    "Corticoide e antibiótico não estão indicados no tratamento imediato; antibiótico só se aparecer pneumonia.",
    "Radiografia de tórax e o nível de cuidado pós-operatório conforme a evolução.",
    "Registrar na ficha o episódio, o material aspirado e as condutas.",
  ],
  divergencias: [],
  referencias: ["manual-15", "qrh-3-4"],
  relacionados: [
    { protocolo: "pressao-vias-aereas", texto: "Pressão elevada das vias aéreas" },
    { protocolo: "broncoespasmo-grave", texto: "Broncoespasmo grave" },
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
  ],
};
