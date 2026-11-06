// ===========================================================================
// O mapa cirúrgico do dia na entrada da ficha anestésica
// ===========================================================================
// Pedido de 06/11/2026: "no lugar de o médico ficar buscando um por um nas
// fichas pré-anestésicas, lançando o mapa cirúrgico, ele já vai buscar
// automaticamente ali o paciente para iniciar a ficha anestésica no dia e na
// instituição específica".
//
// O mapa do hospital da sessão aparece no topo da ficha: os pacientes do dia,
// os do anestesista logado primeiro. Um toque abre a ficha com a avaliação
// pré-anestésica no topo e a sala, a cirurgia, o cirurgião e o convênio do
// mapa. Depois de aberta, o paciente do mapa fica ligado à ficha
// (ligar_caso_a_ficha, 202611060001), e o toque seguinte continua a mesma.
//
// O PACIENTE NUNCA É LIGADO SOZINHO. O nome do mapa vem de uma planilha ou de
// uma foto; o cadastro, da recepção. Ligar a ficha ao paciente errado é o pior
// erro possível aqui. O sistema procura os parecidos (pacientes_parecidos, sem
// acento) e o anestesista confirma com um toque — ou cadastra um novo com o
// que o mapa já trouxe.
//
// Tudo aqui é puro; a tela é app/evolucao/mapa-do-dia.tsx.
// ===========================================================================

import type { DoMapa } from "./importar.ts";

export type EtapaDoMapa = "agendado" | "em_sala" | "rpa" | "concluido" | "cancelado";

export type CasoDoMapaNaFicha = {
  id: string;
  /** "AAAA-MM-DD" */
  data: string;
  /** "HH:MM" ou "HH:MM:SS"; nulo é "a seguir", depois do anterior. */
  horario: string | null;
  ordem: number | null;
  sala: string;
  paciente: string;
  idade: number | null;
  procedimento: string;
  cirurgiao: string;
  convenio: string;
  /** O apelido do anestesista do mapa, ou vazio. */
  anestesista: string;
  /** O anestesista do mapa é quem está logado. */
  meu: boolean;
  etapa: EtapaDoMapa;
  /** O paciente cadastrado, quando o mapa já foi ligado. */
  patientId: string | null;
  /** A ficha ligada a este paciente do mapa, e em que pé ela está. */
  ficha: { id: string; status: "aberta" | "encerrada" } | null;
};

const minutos = (h: string | null) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(h ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/**
 * A ordem da lista: os do anestesista logado primeiro, e dentro de cada grupo
 * a ordem do mapa — o horário, e o "a seguir" (sem horário) logo depois de
 * quem vem antes dele na mesma ordem do papel. Cancelados não chegam aqui.
 */
export function ordenarMapaDaFicha<T extends CasoDoMapaNaFicha>(casos: T[]): T[] {
  const chave = (c: CasoDoMapaNaFicha) => [c.meu ? 0 : 1, c.ordem ?? Number.MAX_SAFE_INTEGER, minutos(c.horario) ?? 24 * 60] as const;
  return casos
    .filter((c) => c.etapa !== "cancelado")
    .sort((a, b) => {
      const [x, y] = [chave(a), chave(b)];
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
      return a.paciente.localeCompare(b.paciente, "pt-BR");
    });
}

/** O que o mapa leva para o cabeçalho da ficha (lib/evolucao/importar.ts, cabecalhoInicial). */
export const doMapaParaAFicha = (c: CasoDoMapaNaFicha): DoMapa => ({
  data: c.data, sala: c.sala, procedimento: c.procedimento, cirurgiao: c.cirurgiao, convenio: c.convenio,
});

/** O cadastro mínimo de quem está no mapa e não tem cadastro: só o que o mapa trouxe. */
export function cadastroDoMapa(c: CasoDoMapaNaFicha) {
  return {
    nome: c.paciente.trim(),
    idade_anos: c.idade != null && Number.isInteger(c.idade) && c.idade >= 0 && c.idade <= 120 ? c.idade : null,
    convenio: c.convenio.trim() || null,
    cirurgia: c.procedimento.trim() || null,
  };
}

export const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A idade de um cadastro: a da data de nascimento, quando há; senão a informada. */
export function idadeDoCadastro(p: { data_nascimento: string | null; idade_anos: number | null }, hoje: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(p.data_nascimento ?? "");
  const h = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoje);
  if (m && h) {
    let anos = Number(h[1]) - Number(m[1]);
    if (Number(h[2]) * 100 + Number(h[3]) < Number(m[2]) * 100 + Number(m[3])) anos--;
    return anos >= 0 && anos <= 130 ? anos : null;
  }
  return p.idade_anos ?? null;
}

/**
 * O que a tela diz de cada parecido, para o anestesista decidir: o nome é o
 * mesmo (sem acento) ou só parecido, e a idade bate ou não. A idade que não
 * bate é dita com todas as letras — é ela que mais denuncia o homônimo.
 */
export function comparacaoDoParecido(
  caso: Pick<CasoDoMapaNaFicha, "paciente" | "idade">,
  cadastro: { nome: string; data_nascimento: string | null; idade_anos: number | null },
  hoje: string,
): { mesmoNome: boolean; idade: "bate" | "nao_bate" | "sem_dado"; texto: string } {
  const mesmoNome = semAcento(caso.paciente) === semAcento(cadastro.nome);
  const doCadastro = idadeDoCadastro(cadastro, hoje);
  // Um ano de folga: o mapa escreve a idade que o hospital tem, às vezes de antes do aniversário.
  const idade = caso.idade == null || doCadastro == null ? "sem_dado"
    : Math.abs(caso.idade - doCadastro) <= 1 ? "bate" : "nao_bate";
  const partes = [
    mesmoNome ? "Mesmo nome" : "Nome parecido",
    idade === "bate" ? "mesma idade"
      : idade === "nao_bate" ? `idade diferente (mapa: ${caso.idade}, cadastro: ${doCadastro})`
        : null,
  ].filter(Boolean);
  return { mesmoNome, idade, texto: partes.join(" · ") };
}

// ---------------------------------------------------------------------------
// O cadastro de cada paciente do mapa, já procurado (06/11/2026: "já deve
// puxar as avaliações pré-anestésicas se houver")
// ---------------------------------------------------------------------------

export type AvaliacaoResumo = { em: string; rascunho: boolean; cirurgia: string };

export type CadastroSugerido = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  idade_anos: number | null;
  sexo: string | null;
  convenio: string | null;
  hospital: string | null;
  cirurgia: string | null;
  procedimento: string | null;
  /** A avaliação pré-anestésica mais recente: a que vai para o topo da ficha. */
  avaliacao: AvaliacaoResumo | null;
  /** A ficha que esse paciente já tem aberta neste hospital, se tiver. */
  aberta: string | null;
  comparacao: ReturnType<typeof comparacaoDoParecido>;
};

export type CasoComCadastro = CasoDoMapaNaFicha & {
  /** O cadastro que a linha mostra e que o toque usa — só quando não há dúvida. */
  principal: CadastroSugerido | null;
  /** Todos os parecidos, para o anestesista escolher outro. */
  sugestoes: CadastroSugerido[];
};

/**
 * Qual cadastro a linha já mostra. O ligado antes, quando há; senão o único
 * com o mesmo nome (sem acento) e idade que não desmente. Dois iguais, idade
 * diferente ou só nome parecido: nenhum — o anestesista escolhe. A linha mostra
 * o nome, a idade e a avaliação desse cadastro ANTES do toque: o toque é a
 * confirmação.
 */
export function principalDoCaso(caso: Pick<CasoDoMapaNaFicha, "patientId">, sugestoes: CadastroSugerido[]): CadastroSugerido | null {
  if (caso.patientId) return sugestoes.find((s) => s.id === caso.patientId) ?? null;
  const fortes = sugestoes.filter((s) => s.comparacao.mesmoNome && s.comparacao.idade !== "nao_bate");
  return fortes.length === 1 ? fortes[0] : null;
}
