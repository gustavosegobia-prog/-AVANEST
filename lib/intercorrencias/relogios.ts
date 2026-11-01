/**
 * OS RELÓGIOS DOS PROTOCOLOS — contas de tempo, sem tela.
 *
 * - PCR materna: o tempo desde o reconhecimento e a meta de nascimento em até
 *   5 minutos sem retorno da circulação (AHA 2025, PCR na gestante).
 * - Ácido tranexâmico na HPP: a janela de 3 horas desde o nascimento e as
 *   condições da segunda dose (30 minutos depois da primeira, ou sangramento
 *   que recomeça em até 24 horas) — OMS/FIGO/ICM 2025.
 * - Nascimento: a meta de SpO2 pré-ductal do minuto (SBP 2026).
 *
 * Os horários entram como "HH:MM" (o relógio da sala) e viram o instante mais
 * recente que já passou: 23:50, lido às 00:10, é de ontem.
 */

const MIN = 60_000;

/** "4:07" — minutos e segundos; a partir de 1 hora, "1:04:07". */
export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

/** "14:30" para o horário do relógio. */
export function horaDe(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "HH:MM" → o instante mais recente, até agora, com esse horário. Inválido: nulo. */
export function horaParaMs(hhmm: string | undefined, agoraMs: number): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  const d = new Date(agoraMs);
  d.setHours(h, mi, 0, 0);
  let t = d.getTime();
  if (t > agoraMs) t -= 24 * 60 * MIN;
  return t;
}

// ---------------------------------------------------------------------------
// PCR materna
// ---------------------------------------------------------------------------
export type EstadoPcrMaterna = {
  segundos: number;
  /** Segundos até os 5 minutos; negativo depois deles. */
  ateCinco: number;
  mensagem: string;
  nivel: "atencao" | "perigo";
};

export function pcrMaterna(inicioMs: number, agoraMs: number): EstadoPcrMaterna {
  const segundos = Math.max(0, Math.floor((agoraMs - inicioMs) / 1000));
  const ateCinco = 300 - segundos;
  if (ateCinco > 0) {
    return {
      segundos, ateCinco, nivel: segundos >= 240 ? "perigo" : "atencao",
      mensagem: `Sem retorno da circulação e fundo uterino no umbigo ou acima: nascimento até 5:00 — faltam ${formatarTempo(ateCinco)}. O preparo começa já.`,
    };
  }
  return { segundos, ateCinco, nivel: "perigo", mensagem: "5 minutos sem retorno da circulação: nascimento imediato, se indicado, no local." };
}

// ---------------------------------------------------------------------------
// Ácido tranexâmico na hemorragia pós-parto
// ---------------------------------------------------------------------------
export type EstadoTranexamico = {
  /** Desde o nascimento, quando informado. */
  janela: null | { limiteMs: number; dentro: boolean; minutosRestantes: number; mensagem: string };
  /** Depois da primeira dose, quando informada. */
  segunda: null | { aPartirDeMs: number; ateMs: number; liberada: boolean; mensagem: string };
  /** O que falta informar. */
  falta: string[];
};

export function tranexamico(nascimentoMs: number | null, primeiraDoseMs: number | null, agoraMs: number): EstadoTranexamico {
  const falta: string[] = [];
  let janela: EstadoTranexamico["janela"] = null;
  if (nascimentoMs === null) falta.push("Informe a hora do nascimento.");
  else {
    const limiteMs = nascimentoMs + 180 * MIN;
    const dentro = agoraMs <= limiteMs;
    const minutosRestantes = Math.max(0, Math.floor((limiteMs - agoraMs) / MIN));
    janela = {
      limiteMs, dentro, minutosRestantes,
      mensagem: dentro
        ? `Janela de 3 horas até ${horaDe(limiteMs)} (faltam ${minutosRestantes} min): primeira dose de 1 g IV em 10 minutos, o mais cedo possível, junto do tratamento da causa.`
        : `Passaram 3 horas do nascimento (limite às ${horaDe(limiteMs)}): fora da janela do regime da OMS — decidir com a obstetrícia.`,
    };
  }
  let segunda: EstadoTranexamico["segunda"] = null;
  if (primeiraDoseMs !== null) {
    const aPartirDeMs = primeiraDoseMs + 30 * MIN;
    const ateMs = primeiraDoseMs + 24 * 60 * MIN;
    const liberada = agoraMs >= aPartirDeMs && agoraMs <= ateMs;
    segunda = {
      aPartirDeMs, ateMs, liberada,
      mensagem: agoraMs < aPartirDeMs
        ? `Segunda dose de 1 g só se o sangramento persistir a partir de ${horaDe(aPartirDeMs)} (30 minutos depois da primeira).`
        : agoraMs <= ateMs
          ? `Segunda dose de 1 g possível se o sangramento persiste ou recomeça (até 24 horas da primeira, às ${horaDe(ateMs)}). Total do regime: 2 g.`
          : "Passaram 24 horas da primeira dose: o regime de duas doses terminou.",
    };
  }
  return { janela, segunda, falta };
}

// ---------------------------------------------------------------------------
// Nascimento: meta de SpO2 pré-ductal (SBP 2026)
// ---------------------------------------------------------------------------
export const ALVOS_SPO2: ReadonlyArray<{ minuto: number; faixa: string }> = [
  { minuto: 2, faixa: "65–70%" },
  { minuto: 3, faixa: "70–75%" },
  { minuto: 4, faixa: "75–80%" },
  { minuto: 5, faixa: "80–85%" },
  { minuto: 10, faixa: "85–95%" },
];

/** A meta do último marco já atingido; antes de 2 minutos, nenhuma. */
export function alvoSpO2(segundos: number): { minuto: number; faixa: string } | null {
  let alvo: { minuto: number; faixa: string } | null = null;
  for (const a of ALVOS_SPO2) if (segundos >= a.minuto * 60) alvo = a;
  return alvo;
}
