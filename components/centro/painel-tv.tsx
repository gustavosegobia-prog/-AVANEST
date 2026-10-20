"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  CAMPOS_DO_CASO, atraso, duracao, hhmm, iniciaisDoPaciente, painelDaTv, tempoNaEtapa,
  type Caso, type Sala,
} from "@/lib/centro-cirurgico";
import estilos from "./tv.module.css";

const RELOGIO = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const DATA = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

const idade = (c: Caso) => (c.idade == null ? "" : `${c.idade} ${c.idade === 1 ? "ano" : "anos"}`);

/**
 * O mapa na TV do corredor do centro cirúrgico.
 *
 * Lido de longe e de passagem, então: letra grande, uma coluna por sala, e em
 * cada uma só três coisas — quem está agora (e há quanto tempo), quem vem a
 * seguir, e se a sala está livre. A RPA tem coluna própria, porque é a outra
 * pergunta que se faz olhando para a TV: "o paciente da sala 2 já saiu da RPA?".
 *
 * Sem botão nenhum. Sem nome completo: iniciais e idade, porque quem passa no
 * corredor lê a TV. Atualiza sozinha a cada meio minuto e pede ao navegador
 * para não apagar a tela.
 */
export function PainelTv({ institutionId, dia, nomeDaCasa, salasIniciais, casosIniciais, apelidos, agora: agoraDoServidor }: {
  institutionId: string;
  dia: string;
  nomeDaCasa: string;
  salasIniciais: Sala[];
  casosIniciais: Caso[];
  apelidos: Record<string, string>;
  agora: number;
}) {
  const [salas, setSalas] = useState(salasIniciais);
  const [casos, setCasos] = useState(casosIniciais);
  const [agora, setAgora] = useState(agoraDoServidor);
  const [atualizado, setAtualizado] = useState(agoraDoServidor);
  const [semRede, setSemRede] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);

  const recarregar = useCallback(async () => {
    const sb = createClient();
    const [s, c] = await Promise.all([
      sb.from("centro_salas").select("id, nome, ordem, ativa").eq("institution_id", institutionId).order("ordem"),
      sb.from("centro_casos").select(CAMPOS_DO_CASO).eq("institution_id", institutionId).eq("data", dia),
    ]);
    if (s.error || c.error) { setSemRede(true); return; }
    setSalas((s.data ?? []) as Sala[]);
    setCasos((c.data ?? []) as unknown as Caso[]);
    setSemRede(false);
    setAtualizado(Date.now());
  }, [institutionId, dia]);

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 15000);
    const dados = window.setInterval(() => { void recarregar(); }, 30000);
    return () => { window.clearInterval(relogio); window.clearInterval(dados); };
  }, [recarregar]);

  // A TV não pode apagar sozinha no meio da manhã. Onde o navegador não
  // oferece a trava, segue sem ela — a TV ligada no computador costuma ter o
  // descanso de tela desligado de qualquer jeito.
  useEffect(() => {
    let trava: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        trava = (await nav.wakeLock?.request("screen")) ?? null;
      } catch { trava = null; }
    };
    void pedir();
    const aoVoltar = () => { if (document.visibilityState === "visible") void pedir(); };
    const aoMudarTela = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("visibilitychange", aoVoltar);
    document.addEventListener("fullscreenchange", aoMudarTela);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      document.removeEventListener("fullscreenchange", aoMudarTela);
      void trava?.release();
    };
  }, []);

  const { porSala, rpa, contagem } = painelDaTv(salas, casos, 4);
  const quem = (id: string | null) => (id ? apelidos[id] ?? "" : "");

  return (
    <div className={`clinicalDark ${estilos.tv}`} style={{ "--salas": Math.max(porSala.length, 1) } as React.CSSProperties}>
      <header className={estilos.topo}>
        <div className={estilos.casa}>
          <span>Centro cirúrgico</span>
          <strong>{nomeDaCasa}</strong>
        </div>
        <ul className={estilos.numeros} aria-label="Pacientes por etapa">
          <li className={estilos.emSala}><b>{contagem.em_sala}</b> em sala</li>
          <li className={estilos.naRpa}><b>{contagem.rpa}</b> na RPA</li>
          <li><b>{contagem.agendado}</b> {contagem.agendado === 1 ? "agendado" : "agendados"}</li>
          <li className={estilos.altas}><b>{contagem.concluido}</b> {contagem.concluido === 1 ? "alta" : "altas"}</li>
        </ul>
        <div className={estilos.relogio}>
          <strong>{RELOGIO.format(agora)}</strong>
          <span>{DATA.format(agora)}</span>
        </div>
      </header>

      {porSala.length === 0 ? (
        <p className={estilos.semSalas}>Nenhuma sala cadastrada no mapa cirúrgico.</p>
      ) : (
        <main className={estilos.quadro}>
          {porSala.map(({ sala, agora: naSala, aSeguir, feitas, restantes }) => (
            <section key={sala.id} className={`${estilos.sala} ${naSala.length ? estilos.ocupada : estilos.livre}`}>
              <header className={estilos.cabeca}>
                <h2>{sala.nome}</h2>
                <span className={estilos.estado}>{naSala.length ? "Em uso" : "Livre"}</span>
              </header>

              {naSala.length > 0 ? naSala.map((c) => (
                <div key={c.id} className={estilos.agora}>
                  <p className={estilos.quem}>{iniciaisDoPaciente(c.paciente)} <span>{idade(c)}</span></p>
                  <p className={estilos.cirurgia}>{c.procedimento}</p>
                  <p className={estilos.equipe}>
                    {[c.cirurgiao, quem(c.anestesista_id) && `Anest. ${quem(c.anestesista_id)}`].filter(Boolean).join(" · ")}
                  </p>
                  <p className={estilos.tempo}>{duracao(tempoNaEtapa(c, agora))}</p>
                </div>
              )) : (
                <p className={estilos.vaga}>{aSeguir.length ? "Aguardando o próximo" : "Sem mais cirurgias hoje"}</p>
              )}

              {aSeguir.length > 0 && (
                <div className={estilos.seguir}>
                  <h3>A seguir</h3>
                  <ol>
                    {aSeguir.map((c) => {
                      const atrasou = atraso(c, agora);
                      return (
                        <li key={c.id} className={atrasou ? estilos.atrasado : undefined}>
                          <b>{hhmm(c.horario) || "—"}</b>
                          <span>{iniciaisDoPaciente(c.paciente)} · {c.procedimento}</span>
                          {atrasou && <em>atrasada {duracao(atrasou)}</em>}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
              <p className={estilos.rodapeSala}>
                {feitas} {feitas === 1 ? "feita" : "feitas"} · {restantes} na fila
              </p>
            </section>
          ))}

          <section className={estilos.rpa} aria-label="RPA">
            <header className={estilos.cabeca}>
              <h2>RPA</h2>
              <span className={estilos.estado}>{rpa.length}</span>
            </header>
            {rpa.length ? (
              <ol className={estilos.listaRpa}>
                {rpa.map((c) => (
                  <li key={c.id}>
                    <p className={estilos.quem}>{iniciaisDoPaciente(c.paciente)} <span>{idade(c)}</span></p>
                    <p className={estilos.cirurgia}>{c.procedimento}</p>
                    <p className={estilos.tempoRpa}>há {duracao(tempoNaEtapa(c, agora))}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={estilos.vaga}>Ninguém na RPA</p>
            )}
          </section>
        </main>
      )}

      <div className={estilos.rodape}>
        <span>{semRede ? "Sem conexão: mostrando o último mapa recebido" : `Atualizado às ${RELOGIO.format(atualizado)} · atualiza sozinho`}</span>
        <span>Iniciais no lugar do nome, por privacidade</span>
        {!telaCheia && (
          <button type="button" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}>
            Tela cheia
          </button>
        )}
      </div>
    </div>
  );
}
