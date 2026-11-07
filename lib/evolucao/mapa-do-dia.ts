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
// AS TRAVAS (06/11/2026: "vamos deixar uma trava também na data de
// nascimento"). A linha só já mostra um cadastro quando é o ÚNICO com o mesmo
// nome (sem acento) e:
//   - a mesma data de nascimento, quando o mapa e o cadastro têm a data; ou
//   - a mesma idade (um ano de folga), quando falta a data de um dos lados.
// Data de nascimento diferente, idade diferente, nome só parecido, dois
// cadastros iguais, ou nada além do nome para conferir: a linha não escolhe —
// o anestesista confirma.
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
  /** "AAAA-MM-DD", quando o mapa trouxe a data de nascimento. */
  nascimento: string | null;
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
  /**
   * O nome do hospital, quando a linha vem do mapa que o centro cirúrgico do
   * hospital monta na organização dele (centro_compartilhamentos, 07/11/2026).
   * Essa linha é só leitura: nada volta para o mapa do hospital.
   */
  doHospital?: string;
  /** O tipo de anestesia do mapa, por extenso ("Geral", "Local + sedação"). */
  anestesia?: string;
  /** Só anestesia local, do cirurgião: fica na lista, no fim, para o caso de pedirem sedação. */
  soLocal?: boolean;
};

/**
 * O mapa do hospital junto com o da casa: o paciente que já está no mapa da
 * casa (mesmo nome, sem acento) não se repete — vale a linha da casa, que liga
 * a ficha ao mapa.
 */
export function semRepetirOMapaDaCasa<T extends { paciente: string }>(daCasa: Array<{ paciente: string }>, doHospital: T[]): T[] {
  const nomes = new Set(daCasa.map((c) => semAcento(c.paciente)));
  const vistos = new Set<string>();
  return doHospital.filter((c) => {
    const n = semAcento(c.paciente);
    if (!n || nomes.has(n) || vistos.has(n)) return false;
    vistos.add(n);
    return true;
  });
}

/**
 * A ficha de hoje de quem veio do mapa do hospital. O mapa do hospital não
 * guarda a ficha (é de outra organização, só leitura); sem isto, depois de
 * encerrada a ficha a linha voltaria a oferecer "Abrir ficha", e o toque
 * abriria uma segunda para o mesmo paciente. Só para o cadastro sem dúvida
 * (principalDoCaso): a aberta antes da encerrada; das iguais, a mais recente.
 */
export function fichaDeHoje(
  patientId: string,
  fichas: Array<{ id: string; patient_id: string; status: string; inicio_em: string }>,
  hoje: string,
  diaDe: (iso: string) => string,
): { id: string; status: "aberta" | "encerrada" } | null {
  const doDia = fichas
    .filter((f) => f.patient_id === patientId && diaDe(f.inicio_em) === hoje)
    .sort((a, b) => (a.status === "aberta" ? 0 : 1) - (b.status === "aberta" ? 0 : 1) || b.inicio_em.localeCompare(a.inicio_em));
  const f = doDia[0];
  return f ? { id: f.id, status: f.status === "encerrada" ? "encerrada" : "aberta" } : null;
}

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
  // A anestesia local (do cirurgião) vai para o fim: está no mapa, mas raramente é do anestesista.
  const chave = (c: CasoDoMapaNaFicha) =>
    [c.meu ? 0 : 1, c.soLocal ? 1 : 0, c.ordem ?? Number.MAX_SAFE_INTEGER, minutos(c.horario) ?? 24 * 60] as const;
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
    data_nascimento: dataValida(c.nascimento),
    idade_anos: c.idade != null && Number.isInteger(c.idade) && c.idade >= 0 && c.idade <= 120 ? c.idade : null,
    convenio: c.convenio.trim() || null,
    cirurgia: c.procedimento.trim() || null,
  };
}

const dataValida = (d: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** "1974-03-01" → "01/03/1974". */
export const dataBR = (d: string) => d.slice(0, 10).split("-").reverse().join("/");

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

type Confere = "bate" | "nao_bate" | "sem_dado";

/**
 * O que a tela diz de cada parecido, para o anestesista decidir: o nome é o
 * mesmo (sem acento) ou só parecido, a data de nascimento bate ou não, e a
 * idade bate ou não. O que não bate é dito com todas as letras — é o que
 * denuncia o homônimo.
 */
export function comparacaoDoParecido(
  caso: Pick<CasoDoMapaNaFicha, "paciente" | "idade"> & { nascimento?: string | null },
  cadastro: { nome: string; data_nascimento: string | null; idade_anos: number | null },
  hoje: string,
): { mesmoNome: boolean; nascimento: Confere; idade: Confere; texto: string } {
  const mesmoNome = semAcento(caso.paciente) === semAcento(cadastro.nome);
  const [doMapa, doCad] = [dataValida(caso.nascimento), dataValida(cadastro.data_nascimento)];
  // A data é exata: um dia de diferença já é outra pessoa (ou um erro de digitação, que o anestesista confere).
  const nascimento: Confere = !doMapa || !doCad ? "sem_dado" : doMapa === doCad ? "bate" : "nao_bate";
  // A idade do mapa, ou a da data de nascimento do mapa, no dia de hoje.
  const idadeDoMapa = caso.idade ?? (doMapa ? idadeDoCadastro({ data_nascimento: doMapa, idade_anos: null }, hoje) : null);
  const doCadastro = idadeDoCadastro(cadastro, hoje);
  // Um ano de folga: o mapa escreve a idade que o hospital tem, às vezes de antes do aniversário.
  const idade: Confere = idadeDoMapa == null || doCadastro == null ? "sem_dado"
    : Math.abs(idadeDoMapa - doCadastro) <= 1 ? "bate" : "nao_bate";
  const partes = [
    mesmoNome ? "Mesmo nome" : "Nome parecido",
    nascimento === "bate" ? "mesma data de nascimento"
      : nascimento === "nao_bate" ? `data de nascimento diferente (mapa: ${dataBR(doMapa!)}, cadastro: ${dataBR(doCad!)})`
        : null,
    // Com a data conferida, a idade não acrescenta nada; sem ela, a idade é o que há.
    nascimento !== "sem_dado" ? null
      : idade === "bate" ? "mesma idade"
        : idade === "nao_bate" ? `idade diferente (mapa: ${idadeDoMapa}, cadastro: ${doCadastro})`
          : null,
  ].filter(Boolean);
  return { mesmoNome, nascimento, idade, texto: partes.join(" · ") };
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
 * O parecido que a linha pode mostrar sozinha: mesmo nome, nada que desminta
 * (data de nascimento nem idade) e algo que confirme além do nome — a data de
 * nascimento, ou, quando falta a data de um dos lados, a idade.
 */
export const confirmaSemPerguntar = (c: CadastroSugerido["comparacao"]) =>
  c.mesmoNome && c.nascimento !== "nao_bate" && c.idade !== "nao_bate"
  && (c.nascimento === "bate" || c.idade === "bate");

/**
 * Qual cadastro a linha já mostra. O ligado antes, quando há; senão o único
 * que confirma sem perguntar (confirmaSemPerguntar). Dois iguais, data ou
 * idade diferente, só nome parecido ou só o nome para conferir: nenhum — o
 * anestesista escolhe. A linha mostra o nome, a data de nascimento e a
 * avaliação desse cadastro ANTES do toque: o toque é a confirmação.
 */
export function principalDoCaso(caso: Pick<CasoDoMapaNaFicha, "patientId">, sugestoes: CadastroSugerido[]): CadastroSugerido | null {
  if (caso.patientId) return sugestoes.find((s) => s.id === caso.patientId) ?? null;
  // Mais de um com o mesmo nome e nada que desminta: na dúvida, ninguém.
  const semDesmentir = sugestoes.filter((s) => s.comparacao.mesmoNome && s.comparacao.nascimento !== "nao_bate" && s.comparacao.idade !== "nao_bate");
  if (semDesmentir.length !== 1) return null;
  return confirmaSemPerguntar(semDesmentir[0].comparacao) ? semDesmentir[0] : null;
}
