/**
 * REANIMAÇÃO NEONATAL — cartão 29 da minuta de validação de 15/10/2026.
 *
 * Aplicação: transição ao nascer, recém-nascido de 34 semanas ou mais; abaixo
 * de 34 semanas, a diretriz própria da SBP. Base histórica: Manual de Crises
 * (aba 19). O algoritmo foi substituído pelas Diretrizes 2026 da SBP (seções
 * 7, 9 e 10) — parâmetros de 2026 não são atribuídos à edição de 2022 do
 * Manual. Metas de SpO2 e manejo do cordão: fluxograma completo da SBP. O
 * texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { ADRENALINA_100 } from "./comum.ts";

export const REANIMACAO_NEONATAL: Protocolo = {
  id: "reanimacao-neonatal",
  titulo: "Reanimação neonatal",
  categoria: "pediatria",
  populacoes: ["neonatal"],
  versao: 2,
  atualizadoEm: "2026-10-15",
  sinonimos: ["recém-nascido", "RN", "reanimação do recém-nascido", "suporte de vida neonatal", "sala de parto"],
  sinais: ["apneia", "respiração irregular", "hipotônico", "bradicardia", "FC abaixo de 100", "FC abaixo de 60", "cianose", "nascimento"],
  resumo: "Aquecer, secar e posicionar; VPP em ar ambiente no primeiro minuto. FC abaixo de 60 com ventilação eficaz: intubar, O2 a 100% e massagem 3:1; depois, adrenalina.",
  reconhecer: [
    "Transição ao nascer, recém-nascido de 34 semanas ou mais. Abaixo de 34 semanas: diretriz própria da SBP.",
    "Apneia, respiração irregular ou FC abaixo de 100 depois dos passos iniciais indicam VPP.",
    "Hipotonia isolada exige avaliação, e não compressões automáticas.",
  ],
  agirAgora: [
    { texto: "Acionar a equipe; aquecer, secar e posicionar.", detalhe: "Aspirar somente se houver obstrução." },
    { texto: "Iniciar a VPP até 60 segundos, em ar ambiente, 30 a 60 por minuto.",
      detalhe: "Monitor cardíaco e oximetria no membro superior direito. Corrigir a ventilação ineficaz." },
    { texto: "FC abaixo de 60 apesar de ventilação eficaz: intubar, O2 a 100% e compressões com ventilações em 3:1 (90 e 30 por minuto)." },
    { texto: "Depois de 60 segundos eficazes, persistindo abaixo de 60: adrenalina e investigar hipovolemia." },
  ],
  medicamentos: [
    {
      id: "adrenalina-rn-iv", farmaco: "Adrenalina", indicacao: "FC abaixo de 60 depois de 60 s de ventilação e massagem eficazes",
      populacao: "pediatrico", via: "IV umbilical ou IO",
      dose: { usual: 20, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_100], altoRisco: true,
      repeticao: "A cada 3 a 5 minutos.",
      referencias: ["sbp-2026-rn"],
    },
    {
      id: "adrenalina-rn-traqueal", farmaco: "Adrenalina", indicacao: "Sem acesso — dose única enquanto se obtém o acesso",
      populacao: "pediatrico", via: "Traqueal",
      dose: { usual: 100, unidade: "mcg", por: "kg" }, apresentacoes: [ADRENALINA_100], altoRisco: true,
      referencias: ["sbp-2026-rn"],
    },
  ],
  volumes: [
    { id: "sf-rn", rotulo: "Soro fisiológico 0,9%", indicacao: "Se hipovolemia, em 5 a 10 minutos", populacao: "pediatrico",
      porKg: { min: 10 }, referencias: ["sbp-2026-rn"] },
  ],
  pensarEm: ["Ventilação ineficaz, pneumotórax, obstrução e perda sanguínea."],
  depois: [
    "Normotermia, glicemia e transporte monitorizado; avaliar encefalopatia e conversar com a família.",
    "Sem bicarbonato nem naloxona de rotina.",
    "Metas de SpO2 e manejo do cordão: consultar o fluxograma completo da SBP.",
  ],
  divergencias: [
    {
      tema: "Dose de adrenalina",
      posicoes: [
        { texto: "10 mcg/kg, podendo subir para 30 mcg/kg (a frente do cartão diz “10–30 mcg”, sem o por kg).", referencia: "manual-19" },
        { texto: "20 mcg/kg EV ou IO; traqueal, 100 mcg/kg em dose única.", referencia: "sbp-2026-rn" },
      ],
      escolha: "O protocolo segue as Diretrizes 2026 da SBP; os parâmetros de 2026 não são atribuídos à edição de 2022 do Manual.",
    },
  ],
  referencias: ["manual-19", "sbp-2026-rn", "sbp-2026-rn-pre-termo"],
  relacionados: [
    { protocolo: "colapso-materno", texto: "Colapso materno" },
    { protocolo: "sav-pediatrico", texto: "Suporte avançado de vida pediátrico" },
  ],
};
