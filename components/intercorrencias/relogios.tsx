"use client";

import { useEffect, useState, type ReactNode } from "react";
import estilos from "./intercorrencias.module.css";
import { ALVOS_SPO2, alvoSpO2, formatarTempo, horaDe, horaParaMs, pcrMaterna, tranexamico } from "@/lib/intercorrencias/relogios";
import type { Ferramenta } from "@/lib/intercorrencias/tipos";
import type { DadosDoPaciente } from "./paciente";

/**
 * As ferramentas de tempo dos protocolos. O início de cada cronômetro e os
 * horários ficam nos dados do paciente da tela: abrir outro protocolo (a PCR,
 * a reanimação neonatal) e voltar não perde o tempo. Nada vai para a ficha.
 */

/** O relógio da tela, de segundo em segundo, só enquanto há o que contar. */
function useAgora(ativo: boolean): number | null {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    const tique = () => setAgora(Date.now());
    const primeiro = setTimeout(tique, 0);
    const t = ativo ? setInterval(tique, 1000) : undefined;
    return () => { clearTimeout(primeiro); if (t) clearInterval(t); };
  }, [ativo]);
  return agora;
}

function Cronometro({ chave, titulo, iniciar, dica, dados, set, children }: {
  chave: string; titulo: string; iniciar: string; dica: string;
  dados: DadosDoPaciente; set: (c: string, v: string) => void;
  children: (segundos: number, inicio: number, agora: number) => ReactNode;
}) {
  const inicio = Number(dados[chave]) || null;
  const agora = useAgora(inicio !== null);
  const segundos = inicio && agora ? Math.max(0, (agora - inicio) / 1000) : 0;
  return (
    <div className={`${estilos.ferramenta} ${estilos.naoImprimir}`} role="group" aria-label={titulo}>
      <div className={estilos.ferramentaTopo}>
        <strong>{titulo}</strong>
        {inicio && <b className={estilos.relogio}>{formatarTempo(segundos)}</b>}
        {inicio ? (
          <button type="button" className={estilos.botao}
            onClick={() => { if (window.confirm("Zerar o cronômetro?")) set(chave, ""); }}>Zerar</button>
        ) : (
          <button type="button" className={`${estilos.botao} ${estilos.botaoForte}`} onClick={() => set(chave, String(Date.now()))}>{iniciar}</button>
        )}
      </div>
      {inicio && agora ? children(segundos, inicio, agora) : <p className={estilos.miuda}>{dica}</p>}
    </div>
  );
}

function PcrMaterna({ dados, set }: { dados: DadosDoPaciente; set: (c: string, v: string) => void }) {
  return (
    <Cronometro chave="cronometro:pcr-materna" titulo="Cronômetro da PCR materna" iniciar="Iniciar no reconhecimento da PCR"
      dica="Toque ao reconhecer a PCR: o preparo do parto ressuscitativo começa no mesmo momento, sem esperar 4 minutos."
      dados={dados} set={set}>
      {(_s, inicio, agora) => {
        const e = pcrMaterna(inicio, agora);
        return (
          <ul className={estilos.avisos}>
            <li className={estilos[e.nivel]}><span>{e.mensagem}</span></li>
            <li className={estilos.info}><span>Reconhecida às {horaDe(inicio)}. Adrenalina 1 mg a cada 3 a 5 minutos, como no adulto.</span></li>
          </ul>
        );
      }}
    </Cronometro>
  );
}

function Nascimento({ dados, set }: { dados: DadosDoPaciente; set: (c: string, v: string) => void }) {
  return (
    <Cronometro chave="cronometro:nascimento" titulo="Cronômetro do nascimento" iniciar="Iniciar no nascimento"
      dica="Toque no nascimento: o cronômetro marca o primeiro minuto da VPP e a meta de SpO2 pré-ductal de cada minuto."
      dados={dados} set={set}>
      {(segundos) => {
        const alvo = alvoSpO2(segundos);
        return (
          <>
            <ul className={estilos.avisos}>
              {segundos < 60 && (
                <li className={estilos.atencao}><span>Primeiro minuto: VPP até 60 segundos, se indicada (faltam {formatarTempo(60 - segundos)}).</span></li>
              )}
              <li className={estilos.info}><span>{alvo
                ? `Meta de SpO2 pré-ductal agora: ${alvo.faixa} (marco de ${alvo.minuto} min).`
                : "A tabela de SpO2 começa aos 2 minutos."}</span></li>
            </ul>
            <ol className={estilos.metasSpO2} aria-label="Metas de SpO2 pré-ductal">
              {ALVOS_SPO2.map((a) => (
                <li key={a.minuto} aria-current={alvo?.minuto === a.minuto ? "step" : undefined}>
                  <small>{a.minuto} min</small><b>{a.faixa}</b>
                </li>
              ))}
            </ol>
          </>
        );
      }}
    </Cronometro>
  );
}

function Hora({ rotulo, chave, dados, set }: { rotulo: string; chave: string; dados: DadosDoPaciente; set: (c: string, v: string) => void }) {
  return (
    <div className={estilos.horario}>
      <label className={estilos.campo}>
        <span>{rotulo}</span>
        <input type="time" value={dados[chave] ?? ""} onChange={(e) => set(chave, e.target.value)} />
      </label>
      <button type="button" className={estilos.botao} aria-label={`${rotulo}: agora`} onClick={() => set(chave, horaDe(Date.now()))}>Agora</button>
    </div>
  );
}

function Tranexamico({ dados, set }: { dados: DadosDoPaciente; set: (c: string, v: string) => void }) {
  const algum = Boolean(dados["txa:nascimento"] || dados["txa:primeira"]);
  const agora = useAgora(algum);
  const estado = agora === null ? null : tranexamico(
    horaParaMs(dados["txa:nascimento"], agora), horaParaMs(dados["txa:primeira"], agora), agora,
  );
  return (
    <div className={`${estilos.ferramenta} ${estilos.naoImprimir}`} role="group" aria-label="Ácido tranexâmico: horários">
      <div className={estilos.ferramentaTopo}><strong>Ácido tranexâmico: horários</strong></div>
      <div className={estilos.horarios}>
        <Hora rotulo="Nascimento" chave="txa:nascimento" dados={dados} set={set} />
        <Hora rotulo="1ª dose" chave="txa:primeira" dados={dados} set={set} />
      </div>
      {estado && (
        <ul className={estilos.avisos}>
          {estado.janela && <li className={estado.janela.dentro ? estilos.atencao : estilos.perigo}><span>{estado.janela.mensagem}</span></li>}
          {estado.segunda && <li className={estado.segunda.liberada ? estilos.atencao : estilos.info}><span>{estado.segunda.mensagem}</span></li>}
          {estado.falta.map((f) => <li key={f} className={estilos.info}><span>{f}</span></li>)}
          <li className={estilos.info}><span>A indicação não depende de esperar perda extrema: começa com o diagnóstico de HPP, junto do tratamento da causa.</span></li>
        </ul>
      )}
    </div>
  );
}

export function FerramentaDoProtocolo({ ferramenta, dados, set }: {
  ferramenta: Ferramenta; dados: DadosDoPaciente; set: (c: string, v: string) => void;
}) {
  if (ferramenta === "cronometro-pcr-materna") return <PcrMaterna dados={dados} set={set} />;
  if (ferramenta === "cronometro-nascimento") return <Nascimento dados={dados} set={set} />;
  return <Tranexamico dados={dados} set={set} />;
}
