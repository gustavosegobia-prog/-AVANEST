"use client";

import { useEffect, useState, type ReactNode } from "react";
import estilos from "./intercorrencias.module.css";
import {
  agendaHipercalemia, ALVOS_SPO2, alvoSpO2, formatarTempo, horaDe, horaParaMs, lipidioAcumulado, pcrMaterna, sugestaoLipidio, tranexamico,
} from "@/lib/intercorrencias/relogios";
import { numero, populacaoDe } from "@/lib/intercorrencias/calculo";
import type { Ferramenta } from "@/lib/intercorrencias/tipos";
import { pacienteDe, type DadosDoPaciente } from "./paciente";

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

/**
 * Emulsão lipídica: o volume acumulado (bolus + infusões) contra o limite de
 * 12 mL/kg. Os botões trazem o bolus e as taxas do regime do peso; ao trocar
 * a taxa, o que já correu é somado e a nova taxa começa a contar.
 */
function Lipidio({ dados, set }: { dados: DadosDoPaciente; set: (c: string, v: string) => void }) {
  const paciente = pacienteDe(dados);
  const populacao = populacaoDe(paciente);
  const n = (c: string) => Number(dados[c]) || 0;
  const inicio = n("lipidio:inicio") || null;
  const taxa = n("lipidio:taxa");
  const agora = useAgora(inicio !== null && taxa > 0);
  const titulo = "Emulsão lipídica 20%: volume acumulado";
  // Criança: limite de 10 mL/kg (Tratado SAESP), política definida pelo responsável médico; adulto, 12 mL/kg (ASRA).
  const crianca = populacao === "pediatrico" || populacao === "neonatal";
  const sugestao = sugestaoLipidio(paciente.pesoKg, crianca);
  if (!sugestao) {
    return (
      <div className={`${estilos.ferramenta} ${estilos.naoImprimir}`} role="group" aria-label={titulo}>
        <div className={estilos.ferramentaTopo}><strong>{titulo}</strong></div>
        <p className={estilos.miuda}>Informe o peso para o bolus, as taxas e o limite acumulado.</p>
      </div>
    );
  }
  const fecharSegmento = (agoraMs: number) => {
    if (inicio && taxa > 0) set("lipidio:infundido", String(n("lipidio:infundido") + (taxa * (agoraMs - inicio)) / 3_600_000));
  };
  const iniciarTaxa = (mlH: number, agoraMs: number) => { fecharSegmento(agoraMs); set("lipidio:taxa", String(mlH)); set("lipidio:inicio", String(agoraMs)); };
  const parar = (agoraMs: number) => { fecharSegmento(agoraMs); set("lipidio:taxa", ""); set("lipidio:inicio", ""); };
  const zerar = () => {
    if (!window.confirm("Zerar o volume acumulado de emulsão lipídica?")) return;
    for (const c of ["lipidio:bolus", "lipidio:infundido", "lipidio:taxa", "lipidio:inicio"]) set(c, "");
  };
  const estado = lipidioAcumulado({
    bolusMl: n("lipidio:bolus"), infundidoMl: n("lipidio:infundido"), taxaMlH: taxa, inicioMs: inicio, agoraMs: agora ?? inicio ?? 0, limiteMl: sugestao.limiteMl, limiteRotulo: sugestao.limiteRotulo,
  });
  const algum = n("lipidio:bolus") > 0 || n("lipidio:infundido") > 0 || inicio !== null;
  return (
    <div className={`${estilos.ferramenta} ${estilos.naoImprimir}`} role="group" aria-label={titulo}>
      <div className={estilos.ferramentaTopo}>
        <strong>{titulo}</strong>
        <b className={estilos.relogio}>{numero(estado.totalMl, 0)} mL</b>
        {algum && <button type="button" className={estilos.botao} onClick={zerar}>Zerar</button>}
      </div>
      <div className={estilos.acoesFerramenta}>
        <button type="button" className={`${estilos.botao} ${estilos.botaoForte}`}
          onClick={() => set("lipidio:bolus", String(n("lipidio:bolus") + sugestao.bolusMl))}>
          + Bolus de {numero(sugestao.bolusMl, 0)} mL
        </button>
        {sugestao.taxas.map((t) => (
          <button key={t.rotulo} type="button" className={estilos.botao} aria-pressed={inicio !== null && taxa === t.mlH}
            onClick={() => iniciarTaxa(t.mlH, Date.now())}>
            {t.rotulo}: {numero(t.mlH, 0)} mL/h
          </button>
        ))}
        {inicio && <button type="button" className={estilos.botao} onClick={() => parar(Date.now())}>Parar a infusão</button>}
      </div>
      <ul className={estilos.avisos}>
        <li className={estilos[estado.nivel]}><span>{estado.mensagem}</span></li>
        <li className={estilos.info}><span>{sugestao.regime === "abaixo-de-70"
          ? "Abaixo de 70 kg: bolus de 1,5 mL/kg em 2 a 3 minutos e 0,25 mL/kg/min; instável, repetir o bolus ou dobrar a taxa."
          : "A partir de 70 kg: cerca de 100 mL em 2 a 3 minutos e 250 mL em 15 a 20 minutos; instável, novo bolus e aumento da infusão."} Manter por mais de 15 minutos depois da estabilidade.</span></li>
      </ul>
    </div>
  );
}

/** Hipercalemia: a agenda de glicemias e de potássio a partir da insulina. */
function AgendaHipercalemia({ dados, set }: { dados: DadosDoPaciente; set: (c: string, v: string) => void }) {
  return (
    <Cronometro chave="cronometro:insulina" titulo="Controles depois da insulina" iniciar="Iniciar na insulina"
      dica="Toque ao dar a insulina: a tela marca as glicemias de 0 a 360 minutos e o potássio em 1, 2, 4, 6 e 24 horas — os que passarem da sala vão na passagem de cuidado."
      dados={dados} set={set}>
      {(_s, inicio, agora) => {
        const { itens, proximo } = agendaHipercalemia(inicio, agora);
        return (
          <>
            <ul className={estilos.avisos}>
              {proximo && (
                <li className={estilos.atencao}><span>Próximo: {proximo.tipo.toLowerCase()} às {horaDe(proximo.ms)} ({proximo.minuto} min da insulina).</span></li>
              )}
              <li className={estilos.info}><span>Insulina às {horaDe(inicio)}. Glicemia antes do tratamento abaixo de 7 mmol/L (126 mg/dL): glicose 10%, 50 mL/h por 5 horas.</span></li>
              <li className={estilos.info}><span>Ao sair da sala, entregar os horários seguintes à equipe da clínica cirúrgica (ou da UTI), que assume o acompanhamento.</span></li>
            </ul>
            <ol className={estilos.agenda} aria-label="Controles">
              {itens.map((x) => (
                <li key={`${x.tipo}-${x.minuto}`} data-passou={x.passou || undefined} aria-current={proximo === x ? "step" : undefined}>
                  <small>{x.tipo}{x.minuto >= 1440 ? " · 24 h" : ""}</small><b>{horaDe(x.ms)}</b>
                </li>
              ))}
            </ol>
          </>
        );
      }}
    </Cronometro>
  );
}

export function FerramentaDoProtocolo({ ferramenta, dados, set }: {
  ferramenta: Ferramenta; dados: DadosDoPaciente; set: (c: string, v: string) => void;
}) {
  if (ferramenta === "cronometro-pcr-materna") return <PcrMaterna dados={dados} set={set} />;
  if (ferramenta === "cronometro-nascimento") return <Nascimento dados={dados} set={set} />;
  if (ferramenta === "lipidio-acumulado") return <Lipidio dados={dados} set={set} />;
  if (ferramenta === "agenda-hipercalemia") return <AgendaHipercalemia dados={dados} set={set} />;
  return <Tranexamico dados={dados} set={set} />;
}
