/**
 * EMBOLIA GASOSA VENOSA — adulto, gestante e criança.
 *
 * Condutas do Manual de Crises (protocolo 08, lido no livro) e do QRH 3-5 da
 * Association of Anaesthetists (aberto e lido), que dá o volume de
 * cristaloide. O protocolo 08 manda usar adrenalina, mas não dá dose: a
 * solução e o início vêm da tabela do próprio Manual (protocolo 07), e isso
 * está dito no cartão para o revisor confirmar. O texto é do AVANEST.
 */

import type { Protocolo } from "../tipos.ts";
import { ADRENALINA_60 } from "./comum.ts";

const SEM_DOSE_NO_08 = "O protocolo 08 do Manual não dá dose: solução e início da tabela do protocolo 07.";

export const EMBOLIA_GASOSA: Protocolo = {
  id: "embolia-gasosa-venosa",
  titulo: "Embolia gasosa venosa",
  categoria: "cardiovascular",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["embolia aérea", "embolia gasosa", "embolia por CO2", "embolia gasosa paradoxal"],
  sinais: ["EtCO2 caindo", "queda súbita do EtCO2", "SpO2 caindo", "hipotensão súbita", "PVC subindo", "sopro em roda de moinho",
    "craniotomia sentada", "fossa posterior", "laparoscopia", "colapso"],
  resumo: "Parar a entrada de gás, O2 a 100% sem óxido nitroso, Trendelenburg e decúbito lateral esquerdo, aspirar o cateter central, volume e adrenalina; RCP se parar.",
  reconhecer: [
    "Queda súbita do EtCO2 e da SpO2, com hipotensão e taquicardia, durante procedimento de risco.",
    "Também: pressão venosa central e da artéria pulmonar subindo, broncoespasmo, edema pulmonar, colapso cardiovascular.",
    "Ar no ecocardiograma transtorácico ou transesofágico; às vezes, sopro “em roda de moinho”.",
    "Embolia paradoxal: o forame oval patente existe em 10 a 30% das pessoas, e o gás pode chegar às coronárias e ao cérebro — meio mililitro de ar na coronária basta para fibrilação ventricular.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda, avisar a equipe e anotar a hora." },
    { texto: "O2 a 100%; desligar o óxido nitroso." },
    { texto: "Parar a entrada de gás.",
      detalhe: "Inundar o campo com soro e cobrir com compressas úmidas; ocluir o vaso; parar a insuflação; despressurizar as infusões; cera no osso; campo cirúrgico abaixo do coração." },
    { texto: "Trendelenburg e decúbito lateral esquerdo, se possível." },
    { texto: "Cateter venoso central já no lugar: aspirar o ar.",
      detalhe: "Passar um cateter central na emergência só para isso não tem base em evidência." },
    { texto: "Comprometimento hemodinâmico importante: intubar, se ainda não intubado, e ventilar com O2 a 100%.",
      detalhe: "PEEP só para sustentar a oxigenação: ela pode favorecer a embolia paradoxal e piorar o retorno venoso, e retirá-la de repente aumenta a entrada de gás." },
    { texto: "Volume rápido e paciente bem hidratado." },
    { texto: "Adrenalina para o suporte hemodinâmico." },
    { texto: "Sem pulso: RCP já, e o protocolo de PCR.",
      detalhe: "A massagem cardíaca ajuda a fragmentar e dispersar o gás nas câmaras." },
    { texto: "Depois da reanimação: UTI, e considerar oxigênio hiperbárico." },
  ],
  medicamentos: [
    {
      id: "adrenalina-infusao-embolia-adulto", farmaco: "Adrenalina", indicacao: "Suporte hemodinâmico — infusão",
      populacao: "adulto", via: "IV, infusão contínua",
      dose: { usual: 300, unidade: "mcg", por: "h" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      velocidade: `Começar com 5 mL/h (adulto de 70 kg; 5 mcg/min) e titular pela resposta. ${SEM_DOSE_NO_08}`,
      par: "adrenalina-infusao-embolia-ped", referencias: ["manual-08", "manual-07"],
    },
    {
      id: "adrenalina-infusao-embolia-ped", farmaco: "Adrenalina", indicacao: "Suporte hemodinâmico — infusão",
      populacao: "pediatrico", via: "IV, infusão contínua",
      dose: { min: 0.05, max: 0.5, unidade: "mcg", por: "kg/min" }, apresentacoes: [ADRENALINA_60], altoRisco: true,
      velocidade: SEM_DOSE_NO_08,
      par: "adrenalina-infusao-embolia-adulto", referencias: ["manual-08", "manual-07"],
    },
  ],
  volumes: [
    { id: "cristaloide-embolia-adulto", indicacao: "Em alta velocidade", populacao: "adulto", fixo: { min: 500, max: 1000 },
      referencias: ["qrh-3-5", "manual-08"] },
    { id: "cristaloide-embolia-ped", indicacao: "Em alta velocidade", populacao: "pediatrico", porKg: { min: 20 },
      referencias: ["qrh-3-5", "manual-08"] },
  ],
  pensarEm: [
    "Onde acontece: craniotomia sentada e fossa posterior, coluna, ombro, laparoscopia (embolia por CO2), cesariana, prolapso uterino.",
    "Do lado da anestesia: cateter venoso central, infusão pressurizada, equipo mal preenchido, punção de veia peridural não percebida.",
    "Do paciente: trauma (contuso ou penetrante) e hipovolemia.",
    "Outras embolias: trombo, gordura, líquido amniótico.",
    "Pneumotórax hipertensivo, anafilaxia, broncoespasmo, edema pulmonar, sangramento, choque cardiogênico.",
    "Desconexão do circuito ou falha do capnógrafo também derrubam o EtCO2.",
  ],
  depois: [
    "UTI depois de reanimado.",
    "Oxigênio hiperbárico até 6 horas depois do evento (talvez mais), sobretudo na embolia paradoxal grande.",
    "Exame neurológico ao despertar: a embolia paradoxal pode atingir o cérebro.",
    "Registrar na ficha a hora, o procedimento em curso, as condutas e a evolução.",
    "Prevenção na próxima: posicionar para reduzir o gradiente de pressão, manter hidratado, evitar óxido nitroso e combinar com a equipe as manobras de risco; nos procedimentos de alto risco, capnografia, cateter central, Doppler precordial ou ecocardiograma transesofágico.",
  ],
  divergencias: [
    {
      tema: "Dose de adrenalina",
      posicoes: [
        { texto: "“Use adrenalina para suporte hemodinâmico”, sem dose.", referencia: "manual-08" },
        { texto: "Adrenalina 3 mg em 50 mL, começando em 5 mL/h no adulto de 70 kg; 0,05 a 0,5 mcg/kg/min na criança (tabela da reação transfusional).", referencia: "manual-07" },
        { texto: "Inotrópico “pode ser necessário”, sem fármaco nem dose.", referencia: "qrh-3-5" },
      ],
      escolha: "O protocolo usa a tabela de adrenalina do próprio Manual (protocolo 07). O revisor confirma ou indica outra dose.",
    },
    {
      tema: "“PA elevada” entre os sinais",
      posicoes: [
        { texto: "Lista “PVC elevada” e “PA elevada” entre os sinais durante a anestesia.", referencia: "manual-08" },
      ],
      escolha: "Lido como pressão da artéria pulmonar elevada: a pressão arterial sistêmica costuma cair (hipotensão também está na lista). O revisor confirma.",
    },
  ],
  referencias: ["manual-08", "qrh-3-5", "manual-07"],
  relacionados: [
    { protocolo: "pcr-aesp-assistolia", texto: "PCR — AESP/assistolia" },
    { protocolo: "pcr-fv-tv", texto: "PCR — FV/TV sem pulso" },
  ],
};
