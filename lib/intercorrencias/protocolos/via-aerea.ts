/**
 * VIA AÉREA DIFÍCIL — os três protocolos que se encadeiam: dificuldade de
 * ventilação com máscara, intubação difícil não prevista e não ventilo, não
 * intubo (CICO).
 *
 * Sequência do Manual de Crises (protocolos 09, 10 e 11, lidos no livro), que
 * usa a abordagem Vortex (READY, SET, GO), conferida com as diretrizes da
 * Difficult Airway Society de 2015 (texto completo lido). Onde as duas
 * diferem — sobretudo na técnica de acesso pelo pescoço — as posições ficam
 * em `divergencias`. O texto é do AVANEST.
 */

import type { ApresentacaoDoProtocolo, DoseDoProtocolo, Protocolo } from "../tipos.ts";

const SUGAMADEX_100: ApresentacaoDoProtocolo = {
  rotulo: "Frasco de 200 mg em 2 mL — 100 mg/mL", quantidade: 100, unidade: "mg", mL: 1, vias: ["IV"],
};

/** Acordar depois do rocurônio, quando isso faz parte do plano de falha (DAS 2015). */
const sugamadex = (id: string): DoseDoProtocolo => ({
  id, farmaco: "Sugamadex", indicacao: "Acordar o paciente depois de rocurônio, se fizer parte do plano",
  populacao: "adulto", via: "IV",
  dose: { usual: 16, unidade: "mg", por: "kg" }, apresentacoes: [SUGAMADEX_100],
  cuidados: [
    "Reverter o bloqueio não garante via aérea pérvia nem respiração espontânea: anestesia residual, edema e trauma também obstruem.",
    "Ter a dose certa já separada: decidir na hora atrasa o resgate.",
  ],
  referencias: ["das-2015"],
});

const TEMPO = "Uma pessoa anuncia o tempo decorrido e vigia SpO2 e EtCO2: evita a fixação em mais uma tentativa.";

export const VENTILACAO_MASCARA: Protocolo = {
  id: "ventilacao-mascara-dificil",
  titulo: "Dificuldade de ventilação com máscara",
  categoria: "respiratorio",
  populacoes: ["adulto", "gestante", "pediatrico"],
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["não ventila", "máscara difícil", "ventilação difícil", "falha de ventilação sob máscara"],
  sinais: ["não ventila", "não consigo ventilar", "tórax não expande", "sem curva de capnografia", "bolsa não esvazia",
    "vazamento na máscara", "dessaturação"],
  resumo: "Circuito e O2 a 100% primeiro; otimizar a máscara (posição, duas mãos, cânula, plano); sem melhora, supraglótico em até 3 tentativas e preparar o resgate da via aérea.",
  reconhecer: [
    "Tórax que não expande, curva de capnografia ausente ou pequena, SpO2 caindo.",
    "Bolsa cheia, máscara bem vedada, pressão alta e bolsa que não esvazia: é obstrução — pense em laringoespasmo ou em outra causa de pressão alta na via aérea.",
    "Bolsa que esvazia rápido e enche mal, pressão baixa e vazamento pela máscara: é técnica ou plano — siga os passos.",
    "O protocolo supõe aparelho checado e circuito íntegro (pré-oxigenação com curva de EtCO2). Na dúvida, ventile com ressuscitador autoinflável.",
  ],
  agirAgora: [
    { texto: "Conferir o circuito e usar O2 a 100% em alto fluxo.",
      detalhe: "Dúvida no aparelho ou no circuito: tirar e ventilar com ressuscitador autoinflável." },
    { texto: "Pedir ajuda e dividir as funções.", detalhe: TEMPO },
    { texto: "Otimizar a máscara.",
      detalhe: "Pescoço fletido e cabeça estendida; duas mãos com tração da mandíbula e outra pessoa na bolsa; cânula oro ou nasofaríngea do tamanho maior; plano e relaxamento para abrir a boca; limpar hidratante ou lubrificante da pele para a máscara vedar." },
    { texto: "Difícil ou só parcial: parar e pensar nas opções, inclusive acordar o paciente.",
      detalhe: "Acordar é opção quando o plano permite (indução inalatória ou venosa titulada). Depois de dose plena de indução, em geral o compromisso passa a ser garantir a via aérea." },
    { texto: "Garantir plano anestésico suficiente para controlar a via aérea." },
    { texto: "Até 3 inserções de dispositivo supraglótico, mudando tamanho e tipo." },
    { texto: "Voltar à máscara facial enquanto prepara a intubação.",
      detalhe: "Com a anestesia mais profunda, a máscara costuma funcionar melhor do que logo após a indução." },
    { texto: "A máscara falhou de novo: preparar o resgate de não ventilo, não intubo (READY)." },
    { texto: "Confirmar o relaxamento muscular e tentar intubar.",
      detalhe: "Seguir a intubação difícil não prevista, com o material do não ventilo, não intubo aberto e à mão (SET)." },
  ],
  medicamentos: [sugamadex("sugamadex-ventilacao-mascara")],
  volumes: [],
  pensarEm: [
    "Laringoespasmo; obstrução acima da laringe (língua, partes moles, corpo estranho).",
    "Plano superficial ou relaxamento insuficiente.",
    "Falha do aparelho ou do circuito; desconexão.",
    "Broncoespasmo grave, pneumotórax, rigidez da parede torácica.",
  ],
  depois: [
    "Registrar na ficha o que funcionou e o que não funcionou, e marcar no prontuário: via aérea difícil para as próximas anestesias.",
    "Avisar o paciente e entregar o registro por escrito.",
    "Rever o caso com a equipe. O Manual sugere usar a sequência também como exercício regular.",
  ],
  divergencias: [],
  referencias: ["manual-09", "das-2015", "chrimes-2016"],
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
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["via aérea difícil", "não intubo", "intubação difícil", "falha de intubação", "Cormack"],
  sinais: ["não intubo", "não vejo a glote", "tubo não passa", "várias tentativas", "dessaturação"],
  resumo: "Voltar à máscara e oxigenar; no máximo 3 tentativas de intubação otimizadas; falhou, supraglótico em até 3 tentativas; oxigenou, parar e pensar — inclusive acordar.",
  reconhecer: [
    "Laringoscopia sem ver a glote, ou tubo que não passa.",
    "Cada tentativa a mais aumenta edema e sangramento e aproxima o não ventilo, não intubo.",
    "Se a oxigenação voltar em qualquer etapa do resgate com supraglótico: parar e pensar nas opções, inclusive acordar o paciente.",
  ],
  agirAgora: [
    { texto: "Pedir ajuda e dividir as funções.", detalhe: TEMPO },
    { texto: "Voltar à máscara facial, pedir o carrinho de via aérea difícil e pensar nas opções." },
    { texto: "Garantir plano anestésico e relaxamento muscular." },
    { texto: "Vigiar SpO2, EtCO2 e o tempo decorrido até o fim do resgate." },
    { texto: "Otimizar a visão da laringe e usar bougie, introdutor ou estilete.",
      detalhe: "Cabeça estendida e pescoço fletido; ajustar ou soltar a pressão cricoide; manipulação externa da laringe; lâmina longa ou reta; videolaringoscópio." },
    { texto: "No máximo 3 tentativas otimizadas; considerar videolaringoscópio com lâmina hiperangulada ou de baixo perfil.",
      detalhe: "A DAS admite uma quarta tentativa por colega mais experiente." },
    { texto: "Sem sucesso: declarar a falha de intubação e preparar o resgate de não ventilo, não intubo (READY)." },
    { texto: "Até 3 inserções de supraglótico, mudando tamanho ou tipo.",
      detalhe: "Preferir os de segunda geração (DAS). O relaxamento muscular melhora o sucesso da inserção." },
    { texto: "Supraglótico também falhou: material de não ventilo, não intubo aberto e pronto (SET)." },
    { texto: "Com relaxamento completo e FiO2 de 1, falharam supraglótico e máscara otimizada, e a SpO2 cai sem EtCO2: posicionar e iniciar o não ventilo, não intubo (GO)." },
  ],
  medicamentos: [sugamadex("sugamadex-intubacao-dificil")],
  volumes: [],
  pensarEm: [
    "Abordagem Vortex: em cada linha de vida (máscara, supraglótico, tubo), tentar manipulação, ajuste, tamanho ou tipo, aspiração e fluxo de O2, e tônus muscular.",
    "Supraglótico funcionando: quatro caminhos — acordar, intubar pelo supraglótico com fibroscópio, operar com o supraglótico ou, raramente, via aérea cirúrgica.",
    "Estômago cheio: tirar a pressão cricoide para inserir o supraglótico; risco de broncoaspiração.",
  ],
  depois: [
    "Registrar na ficha a técnica, o número de tentativas e o que funcionou; marcar no prontuário a via aérea difícil.",
    "Avisar o paciente e entregar o registro por escrito; orientar a procurar atendimento se surgir dor de garganta intensa, dor no peito ou febre (lesão de via aérea).",
    "Rever o caso com a equipe.",
  ],
  divergencias: [
    {
      tema: "Número de tentativas de intubação",
      posicoes: [
        { texto: "Até 3 tentativas otimizadas.", referencia: "manual-10" },
        { texto: "No máximo 3 laringoscopias; uma quarta por colega mais experiente é admissível (3 + 1).", referencia: "das-2015" },
      ],
      escolha: "O protocolo segue as 3 tentativas e cita a quarta da DAS como exceção.",
    },
  ],
  referencias: ["manual-10", "das-2015", "chrimes-2016"],
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
  versao: 1,
  atualizadoEm: "2026-10-15",
  sinonimos: ["não intubo, não oxigeno", "CICO", "NINO", "cricotireoidostomia", "cricotireoidotomia", "via aérea cirúrgica", "acesso frontal do pescoço"],
  sinais: ["não ventila", "não intubo", "SpO2 caindo", "sem curva de capnografia", "dessaturação grave"],
  resumo: "Máscara, supraglótico e tubo falharam e a SpO2 cai: acesso pelo pescoço já — bisturi, bougie e tubo de 6 mm; a punção com cateter é a alternativa.",
  reconhecer: [
    "Falharam a máscara otimizada, 3 tentativas de supraglótico e a intubação, com relaxamento completo e FiO2 de 1.",
    "SpO2 caindo rápido, sem EtCO2.",
    "O erro mais comum é demorar a decidir: declarar em voz alta.",
    "Técnicas descritas para o adulto.",
  ],
  agirAgora: [
    { texto: "Declarar “não ventilo, não intubo”, pedir ajuda e o material de via aérea cirúrgica.",
      detalhe: "Garantir o relaxamento completo e continuar oferecendo O2 por cima (máscara ou supraglótico)." },
    { texto: "Estender o pescoço: coxim sob os ombros ou cabeça para fora da mesa.",
      detalhe: "A posição de cheirar, boa para intubar, não é boa para a cricotireoidostomia." },
    { texto: "Membrana cricotireóidea palpável: incisão transversal com bisturi de lâmina 10.",
      detalhe: "Girar o bisturi 90° e tracionar lateralmente para abrir." },
    { texto: "Passar o bougie junto à lâmina até a traqueia e, sobre ele, tubo de 6 mm com balonete.",
      detalhe: "Ou cânula de traqueostomia. Alguns usam bougie que permite ventilar com adaptador." },
    { texto: "Ventilar pela fonte de sempre e confirmar com a capnografia." },
    { texto: "Membrana não palpável: incisão vertical de 6 a 8 cm a partir da fúrcula, dissecar com os dedos até a traqueia e seguir com bisturi e bougie." },
    { texto: "Punção com cateter, onde for a técnica da instituição: cateter 14 G resistente a dobras, seringa de 5 mL com soro e aspiração contínua.",
      detalhe: "Membrana pouco clara: mirar mais abaixo, na linha média da traqueia. Confirmar aspirando a seringa inteira sem refluxo. Ventilador a jato a 1 bar (14,5 psi) ou insuflador por fluxo a 15 L/min: 4 s e esperar 30 s pela SpO2; depois 2 s, pela SpO2. Ver o tórax expandir e o ar sair por cima (auto-PEEP, barotrauma). Sem sucesso: via cirúrgica." },
  ],
  medicamentos: [],
  volumes: [],
  pensarEm: [
    "Antes de precisar: saber onde estão o bisturi de lâmina 10, o bougie e o tubo de 6 mm.",
    "Laringoespasmo, broncoespasmo grave e pneumotórax hipertensivo também impedem a ventilação.",
  ],
  depois: [
    "Via aérea definitiva com o cirurgião (traqueostomia), conforme o caso.",
    "Vigiar sangramento, enfisema subcutâneo e pneumotórax; radiografia de tórax.",
    "Registrar na ficha a sequência, os horários e a técnica; marcar a via aérea difícil no prontuário e avisar o paciente.",
    "Treinar as técnicas em oficinas práticas de via aérea, como o Manual recomenda.",
  ],
  divergencias: [
    {
      tema: "Técnica de acesso pelo pescoço",
      posicoes: [
        { texto: "Punção com cateter e técnica cirúrgica; as instituições diferem no apoio a uma ou às duas.", referencia: "manual-11" },
        { texto: "Cricotireoidostomia com bisturi é a técnica de resgate recomendada; oxigenação de alta pressão por cânula fina se associa a complicações graves.", referencia: "das-2015" },
      ],
      escolha: "O protocolo mostra primeiro a técnica com bisturi (DAS) e deixa a punção como alternativa da instituição. O revisor decide.",
    },
  ],
  referencias: ["manual-11", "das-2015"],
  relacionados: [
    { protocolo: "intubacao-dificil", texto: "Intubação difícil não prevista" },
    { protocolo: "ventilacao-mascara-dificil", texto: "Dificuldade de ventilação com máscara" },
  ],
};
