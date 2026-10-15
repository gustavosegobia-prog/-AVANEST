import estilos from "./intercorrencias.module.css";
import type { Ritmo, RitmoDoProtocolo } from "@/lib/intercorrencias/tipos";

/**
 * OS RITMOS DA PARADA, COMO APARECEM NO MONITOR.
 *
 * Desenhados aqui, por fórmula, e não fotografados: a mesma figura sai no
 * servidor e no aparelho, pesa nada e funciona sem rede. Quatro segundos de
 * derivação II, como na tela do monitor (fundo escuro, traço verde, a
 * frequência ao lado). É ilustração para reconhecer o padrão — o diagnóstico
 * é sempre no paciente.
 */

const SEGUNDOS = 4;
const LARGURA = 400;
const ALTURA = 110;
const MEIO = 60;
/** Pixels por milivolt, mais ou menos: o QRS normal fica com uns 32 px. */
const GANHO = 32;

const sino = (t: number, centro: number, largura: number) => Math.exp(-(((t - centro) / largura) ** 2));
const fase = (t: number, periodo: number) => (t % periodo) / periodo;

/** O sinal de cada ritmo em mV, no instante t (segundos). */
const SINAL: Record<Ritmo, (t: number) => number> = {
  // Caos: ondas de amplitude e frequência que nunca se repetem.
  fv: (t) => (0.75 + 0.35 * Math.sin(2 * Math.PI * 0.45 * t + 0.6))
    * (0.55 * Math.sin(2 * Math.PI * 4.7 * t) + 0.35 * Math.sin(2 * Math.PI * 6.3 * t + 1.3) + 0.2 * Math.sin(2 * Math.PI * 2.9 * t + 0.4)),
  // Monomórfica a 180 por minuto: complexos largos, iguais, sem P.
  tv: (t) => {
    const f = fase(t, 60 / 180);
    return 1.2 * sino(f, 0.3, 0.16) - 0.85 * sino(f, 0.7, 0.18);
  },
  // Sinusal a 60 por minuto, de aparência normal: o perigo é justamente esse.
  aesp: (t) => {
    const f = fase(t + 0.3, 1);
    return 0.12 * sino(f, 0.1, 0.035) - 0.12 * sino(f, 0.235, 0.008) + 1.05 * sino(f, 0.255, 0.011)
      - 0.3 * sino(f, 0.275, 0.009) + 0.28 * sino(f, 0.52, 0.06);
  },
  // Quase reta: só a deriva da linha de base.
  assistolia: (t) => 0.05 * Math.sin(2 * Math.PI * 0.35 * t + 0.8) + 0.018 * Math.sin(2 * Math.PI * 5.1 * t),
};

/** O caminho do traço, com uma casa decimal (o mesmo número no servidor e no navegador). */
function traco(ritmo: Ritmo): string {
  const pontos: string[] = [];
  for (let x = 0; x <= LARGURA; x += 1.5) {
    const y = MEIO - SINAL[ritmo]((x / LARGURA) * SEGUNDOS) * GANHO;
    pontos.push(`${pontos.length ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pontos.join("");
}

const FREQUENCIA: Record<Ritmo, string> = { fv: "---", tv: "180", aesp: "60", assistolia: "0" };

export function RitmosNoMonitor({ ritmos }: { ritmos: RitmoDoProtocolo[] }) {
  return (
    <section id="ritmos" className={estilos.secao} aria-labelledby="t-ritmos">
      <h3 id="t-ritmos">Ritmo no monitor</h3>
      <div className={estilos.ritmos}>
        {ritmos.map((r) => (
          <figure key={r.ritmo} className={estilos.ritmo}>
            <svg viewBox={`0 0 ${LARGURA + 64} ${ALTURA}`} className={estilos.monitor} role="img"
              aria-label={`Traçado ilustrativo de ${r.nome.toLowerCase()}`}>
              <rect className={estilos.monitorTela} x="0" y="0" width={LARGURA + 64} height={ALTURA} rx="8" />
              <text className={estilos.monitorRotulo} x="10" y="17">II</text>
              <text className={estilos.monitorRotulo} x="30" y="17">×1</text>
              <path className={estilos.monitorTraco} d={traco(r.ritmo)} />
              <line className={estilos.monitorDivisa} x1={LARGURA + 4} y1="10" x2={LARGURA + 4} y2={ALTURA - 10} />
              <text className={estilos.monitorRotulo} x={LARGURA + 14} y="30">FC</text>
              <text className={estilos.monitorValor} x={LARGURA + 14} y="56">{FREQUENCIA[r.ritmo]}</text>
              <text className={`${estilos.monitorRotulo} ${estilos.monitorPa}`} x={LARGURA + 14} y="80">PA</text>
              <text className={`${estilos.monitorPaValor} ${estilos.monitorPa}`} x={LARGURA + 14} y="98">--/--</text>
            </svg>
            <figcaption>
              <span className={r.chocavel ? estilos.chocavel : estilos.naoChocavel}>
                {r.chocavel ? "Chocável" : "Não chocável"}
              </span>
              <b>{r.nome}</b>
              <span>{r.legenda}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className={estilos.miuda}>
        Traçados ilustrativos, desenhados pelo AVANEST: o diagnóstico é no paciente, com o pulso e as curvas de pressão e EtCO2.
      </p>
    </section>
  );
}
