"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { somarDias } from "@/lib/data-local";
import {
  CAMPOS_DO_CASO, ETAPAS_DO_FLUXO, NOME_DA_ETAPA, NOME_DO_DESTINO, anestesistasDePlantao, colunasDoMapa,
  contagemPorEtapa, duracao, horaDe, horaNoMapa, mover, proximaOrdem, proximoPasso, resumoDoDia, tempoNaEtapa, tempos,
  type Caso, type Etapa, type PlantaoDaEscala, type Sala, type Passo,
} from "@/lib/centro-cirurgico";
import { JanelaDoCaso, JanelaDoPasso, JanelaDeCancelar, JanelaDasSalas, mensagemDoBanco } from "./janelas";
import { JanelaDeImportar } from "./importar";
import estilos from "./mapa.module.css";

export type Anestesista = { id: string; nome: string; apelido: string };

type Aberta =
  | { tipo: "novo"; salaId: string }
  | { tipo: "editar"; caso: Caso }
  | { tipo: "passo"; caso: Caso; acao: Passo["acao"] }
  | { tipo: "cancelar"; caso: Caso }
  | { tipo: "salas" }
  | { tipo: "importar" }
  | null;

const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const nomeDoDia = (dia: string) => {
  const t = DIA_LONGO.format(new Date(`${dia}T12:00:00Z`));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * O mapa cirúrgico do dia.
 *
 * Duas vistas. O MAPA é a coluna de cada sala com a fila dela, e o cartão de
 * cada paciente leva o botão do próximo passo — entrou em sala, saiu da sala,
 * alta da RPA. O RESUMO é o fim do dia: quantos atos cada anestesista fez, de
 * quais convênios, e o que falta preencher para cobrar.
 *
 * Os contadores do alto também filtram: tocar em "RPA" mostra só quem está na
 * RPA, que é a pergunta que a enfermagem faz a cada meia hora.
 */
export function MapaCirurgico({
  institutionId, nomeDaCasa, dia, hoje, salasIniciais, casosIniciais, anestesistas, plantoes, podeMontar, semBanco, agora: agoraDoServidor,
  marca = null,
}: {
  institutionId: string;
  nomeDaCasa: string;
  dia: string;
  hoje: string;
  salasIniciais: Sala[];
  casosIniciais: Caso[];
  anestesistas: Anestesista[];
  plantoes: PlantaoDaEscala[];
  podeMontar: boolean;
  semBanco: boolean;
  agora: number;
  /** O logo do hospital (cadastro de locais), em marca d'água. */
  marca?: string | null;
}) {
  const [salas, setSalas] = useState(salasIniciais);
  const [casos, setCasos] = useState(casosIniciais);
  const [agora, setAgora] = useState(agoraDoServidor);
  const [vista, setVista] = useState<"mapa" | "resumo">("mapa");
  const [filtro, setFiltro] = useState<Etapa | null>(null);
  const [aberta, setAberta] = useState<Aberta>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const router = useRouter();

  const porId = useMemo(() => new Map(anestesistas.map((a) => [a.id, a])), [anestesistas]);
  const apelido = useCallback((id: string | null) => (id ? porId.get(id)?.apelido ?? "Anestesista" : ""), [porId]);

  // Recarrega do banco: depois de cada gravação, a cada meio minuto com a tela
  // à vista, e ao voltar para a aba. O mapa é olhado por várias pessoas ao
  // mesmo tempo — o anestesista na sala, a enfermagem no balcão.
  const recarregar = useCallback(async () => {
    const sb = createClient();
    const [s, c] = await Promise.all([
      sb.from("centro_salas").select("id, nome, ordem, ativa").eq("institution_id", institutionId).order("ordem"),
      sb.from("centro_casos").select(CAMPOS_DO_CASO).eq("institution_id", institutionId).eq("data", dia),
    ]);
    if (!s.error && s.data) setSalas(s.data as Sala[]);
    if (!c.error && c.data) setCasos(c.data as unknown as Caso[]);
  }, [institutionId, dia]);

  useEffect(() => {
    const tique = () => {
      setAgora(Date.now());
      if (document.visibilityState === "visible") void recarregar();
    };
    const id = window.setInterval(tique, 30000);
    const aoVoltar = () => { if (document.visibilityState === "visible") tique(); };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [recarregar]);

  /** Grava uma mudança num caso e devolve o erro em português, ou "". */
  const gravar = useCallback(async (id: string, mudanca: Partial<Caso>) => {
    const { data, error } = await createClient().from("centro_casos").update(mudanca).eq("id", id)
      .select(CAMPOS_DO_CASO).maybeSingle();
    if (error) return mensagemDoBanco(error.message);
    if (!data) return "Não foi possível gravar: o paciente não está mais no mapa ou você não pode alterá-lo.";
    setCasos((lista) => lista.map((c) => (c.id === id ? (data as unknown as Caso) : c)));
    setAgora(Date.now());
    return "";
  }, []);

  /** Sobe ou desce o paciente na fila da sala, trocando com o vizinho. */
  const moverNaFila = useCallback(async (fila: Caso[], id: string, direcao: -1 | 1) => {
    const mudancas = mover(fila, id, direcao);
    if (!mudancas.length) return;
    setErro("");
    const sb = createClient();
    for (const m of mudancas) {
      const { error } = await sb.from("centro_casos").update({ ordem: m.ordem }).eq("id", m.id);
      if (error) { setErro(mensagemDoBanco(error.message)); void recarregar(); return; }
    }
    const nova = new Map(mudancas.map((m) => [m.id, m.ordem]));
    setCasos((lista) => lista.map((c) => (nova.has(c.id) ? { ...c, ordem: nova.get(c.id)! } : c)));
  }, [recarregar]);

  const contagem = useMemo(() => contagemPorEtapa(casos), [casos]);
  const visiveis = useMemo(() => (filtro ? casos.filter((c) => c.etapa === filtro) : casos), [casos, filtro]);
  const colunas = useMemo(() => colunasDoMapa(salas, visiveis), [salas, visiveis]);
  const resumo = useMemo(() => resumoDoDia(casos, (id) => porId.get(id)?.nome), [casos, porId]);
  const salasAtivas = salas.filter((s) => s.ativa);
  const deHoje = dia === hoje;

  if (semBanco) {
    return (
      <Casca marca={marca}>
        <p className={estilos.faixa}>
          O banco do mapa cirúrgico ainda não está instalado. Rode a migração
          <code> 202610210001_mapa_cirurgico.sql</code> no Supabase.
        </p>
      </Casca>
    );
  }

  return (
    <Casca marca={marca}>
      <div className={estilos.titulo}>
        <div>
          <h1>Mapa cirúrgico</h1>
          <p>{nomeDaCasa}</p>
        </div>
        <div className={estilos.acoesDoTopo}>
          {/* Abre em outra aba: é a que vai para a TV, em tela cheia. */}
          <a href="/centro-cirurgico/tv" target="_blank" rel="noopener" className="outlineClinical compact">
            <Icone nome="painel" tamanho={16} /> Modo TV
          </a>
          {podeMontar && (
            <Link href={`/centro-cirurgico/relatorio?mes=${dia.slice(0, 7)}`} prefetch={false} className="outlineClinical compact">
              <Icone nome="grafico" tamanho={16} /> Relatório
            </Link>
          )}
          {podeMontar && (
            <button type="button" className="outlineClinical compact" onClick={() => setAberta({ tipo: "salas" })}>
              <Icone nome="ajustes" tamanho={16} /> Salas
            </button>
          )}
          {podeMontar && (
            <button type="button" className="outlineClinical compact" onClick={() => setAberta({ tipo: "importar" })}>
              <Icone nome="nota" tamanho={16} /> Importar mapa
            </button>
          )}
          {podeMontar && (
            <button type="button" className="primaryClinical compact" disabled={!salasAtivas.length}
              onClick={() => setAberta({ tipo: "novo", salaId: salasAtivas[0]?.id ?? "" })}>
              + Paciente
            </button>
          )}
        </div>
      </div>

      <nav className={estilos.dia} aria-label="Dia do mapa">
        <Link href={`/centro-cirurgico?data=${somarDias(dia, -1)}`} className={estilos.passoDia} aria-label="Dia anterior">
          <Icone nome="seta" tamanho={18} className={estilos.setaEsquerda} />
        </Link>
        <span className={estilos.nomeDoDia}>
          <strong>{nomeDoDia(dia)}</strong>
          {deHoje ? <em>Hoje</em> : <Link href="/centro-cirurgico">Voltar para hoje</Link>}
        </span>
        <Link href={`/centro-cirurgico?data=${somarDias(dia, 1)}`} className={estilos.passoDia} aria-label="Próximo dia">
          <Icone nome="seta" tamanho={18} className={estilos.setaDireita} />
        </Link>
        <div className={estilos.vistas} role="group" aria-label="Vista">
          <button type="button" aria-pressed={vista === "mapa"} onClick={() => setVista("mapa")}>Mapa</button>
          <button type="button" aria-pressed={vista === "resumo"} onClick={() => setVista("resumo")}>
            Resumo do dia{resumo.pendencias.length > 0 && <b className={estilos.marcaPendente} aria-label={`${resumo.pendencias.length} pendências`}>{resumo.pendencias.length}</b>}
          </button>
        </div>
      </nav>

      {erro && <p className={estilos.erro} role="alert">{erro}</p>}
      {aviso && <p className={estilos.avisoOk} role="status">{aviso}</p>}

      {vista === "mapa" ? (
        <>
          <div className={estilos.contadores} role="group" aria-label="Pacientes por etapa — toque para filtrar">
            {[...ETAPAS_DO_FLUXO, ...(contagem.cancelado ? ["cancelado" as const] : [])].map((e) => (
              <button key={e} type="button" className={`${estilos.contador} ${estilos[`etapa_${e}`]}`}
                aria-pressed={filtro === e} onClick={() => setFiltro(filtro === e ? null : e)}>
                <strong>{contagem[e]}</strong>
                <span>{NOME_DA_ETAPA[e]}</span>
              </button>
            ))}
          </div>
          {filtro && (
            <p className={estilos.filtrando}>
              Mostrando só <b>{NOME_DA_ETAPA[filtro].toLowerCase()}</b>.{" "}
              <button type="button" onClick={() => setFiltro(null)}>Mostrar todos</button>
            </p>
          )}

          {!salas.length ? (
            <div className={estilos.vazio}>
              <h2>{podeMontar ? "Cadastre as salas do centro cirúrgico" : "O mapa ainda não foi montado"}</h2>
              <p>
                {podeMontar
                  ? "Cada sala vira uma coluna do mapa, com a fila de pacientes do dia."
                  : "Quando a enfermagem cadastrar as salas e os pacientes, eles aparecem aqui."}
              </p>
              {podeMontar && (
                <button type="button" className="primaryClinical compact" onClick={() => setAberta({ tipo: "salas" })}>
                  Cadastrar salas
                </button>
              )}
            </div>
          ) : (
            <div className={estilos.quadro}>
              {colunas.map((col) => (
                <section key={col.sala?.id ?? "sem-sala"} className={estilos.coluna} aria-label={col.sala?.nome ?? "Sem sala"}>
                  <header className={estilos.cabecaDaColuna}>
                    <h2>{col.sala?.nome ?? "Sem sala"}</h2>
                    <span className={estilos.quantos}>{col.casos.length || ""}</span>
                    {podeMontar && col.sala?.ativa && (
                      <button type="button" className={estilos.maisNaSala} aria-label={`Paciente na ${col.sala.nome}`}
                        onClick={() => setAberta({ tipo: "novo", salaId: col.sala!.id })}>+</button>
                    )}
                  </header>
                  {col.casos.length ? (
                    <ol className={estilos.fila}>
                      {col.casos.map((c, i) => (
                        <li key={c.id}>
                          <Cartao caso={c} agora={agora} anestesista={apelido(c.anestesista_id)} podeMontar={podeMontar}
                            onPasso={(acao) => setAberta({ tipo: "passo", caso: c, acao })}
                            onEditar={() => setAberta({ tipo: "editar", caso: c })}
                            // Mexer na fila só com a sala inteira à vista: com o filtro, o
                            // vizinho da tela não é o vizinho da fila.
                            onMover={filtro ? undefined : {
                              subir: i > 0 ? () => void moverNaFila(col.casos, c.id, -1) : undefined,
                              descer: i < col.casos.length - 1 ? () => void moverNaFila(col.casos, c.id, 1) : undefined,
                            }} />
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={estilos.salaLivre}>{filtro ? "Ninguém nesta etapa." : "Sala livre."}</p>
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      ) : (
        <Resumo resumo={resumo} salas={salas} />
      )}

      {aberta?.tipo === "novo" || aberta?.tipo === "editar" ? (
        <JanelaDoCaso
          institutionId={institutionId}
          dia={dia}
          caso={aberta.tipo === "editar" ? aberta.caso : null}
          salaInicial={aberta.tipo === "novo" ? aberta.salaId : ""}
          salas={salas}
          ordemNova={proximaOrdem(casos)}
          anestesistas={anestesistas}
          dePlantao={(data, horario) => anestesistasDePlantao(plantoes, data, horario)}
          onFechar={() => setAberta(null)}
          onSalvo={(c) => {
            // Remarcado para outro dia: sai deste mapa.
            setCasos((lista) => [...lista.filter((x) => x.id !== c.id), ...(c.data === dia ? [c] : [])]);
            setAberta(null);
          }}
          onApagado={(id) => { setCasos((lista) => lista.filter((x) => x.id !== id)); setAberta(null); }}
          onCancelar={(c) => setAberta({ tipo: "cancelar", caso: c })}
          gravar={gravar}
        />
      ) : null}
      {aberta?.tipo === "passo" && (
        <JanelaDoPasso caso={aberta.caso} acao={aberta.acao} gravar={gravar}
          onFechar={() => setAberta(null)} onFeito={() => { setAberta(null); setErro(""); }} />
      )}
      {aberta?.tipo === "cancelar" && (
        <JanelaDeCancelar caso={aberta.caso} gravar={gravar} onFechar={() => setAberta(null)} onFeito={() => setAberta(null)} />
      )}
      {aberta?.tipo === "importar" && (
        <JanelaDeImportar institutionId={institutionId} diaAberto={dia} salas={salas} anestesistas={anestesistas}
          dePlantao={(data, horario) => anestesistasDePlantao(plantoes, data, horario)}
          onFechar={() => setAberta(null)}
          onImportado={(data, quantos) => {
            setAberta(null);
            setAviso(`${quantos} ${quantos === 1 ? "paciente importado" : "pacientes importados"}. Confira a ordem de cada sala.`);
            // O mapa de outro dia: vai para ele. O de hoje: recarrega aqui.
            if (data !== dia) router.push(`/centro-cirurgico?data=${data}`);
            else void recarregar();
          }} />
      )}
      {aberta?.tipo === "salas" && (
        <JanelaDasSalas institutionId={institutionId} salas={salas}
          onMudou={(lista) => setSalas(lista)} onFechar={() => { setAberta(null); void recarregar(); }} />
      )}
    </Casca>
  );
}

function Casca({ children, marca }: { children: React.ReactNode; marca: string | null }) {
  return (
    <div className="fcFundo temaApp">
      {/* A marca d'água do hospital: por cima de tudo, bem clara, e sem
          receber toque — o clique atravessa. */}
      {marca && (
        <div className={estilos.marcaDagua} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo enviado pelo hospital, de qualquer tamanho */}
          <img src={marca} alt="" />
        </div>
      )}
      <main className={`fcPagina ${estilos.pagina}`}>
        <header className="fcTopo">
          <Link href="/dashboard" className="fcVoltar">
            <Icone nome="voltar" tamanho={18} /> Painel
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}

/** O cartão do paciente: quem, o quê, onde está agora, e o próximo passo. */
function Cartao({ caso: c, agora, anestesista, podeMontar, onPasso, onEditar, onMover }: {
  caso: Caso; agora: number; anestesista: string; podeMontar: boolean;
  onPasso: (acao: Passo["acao"]) => void; onEditar: () => void;
  onMover?: { subir?: () => void; descer?: () => void };
}) {
  const passo = proximoPasso(c);
  const naEtapa = tempoNaEtapa(c, agora);
  const t = tempos(c);
  const marcos = [
    c.entrada_sala_em && `Entrou ${horaDe(c.entrada_sala_em)}`,
    c.saida_sala_em && `Saiu ${horaDe(c.saida_sala_em)}`,
    c.alta_rpa_em && `Alta ${horaDe(c.alta_rpa_em)}${c.aldrete_alta != null ? ` (Aldrete ${c.aldrete_alta})` : ""}`,
  ].filter(Boolean);
  const detalhe = [c.cirurgiao, c.convenio, c.leito && `Leito ${c.leito}`].filter(Boolean).join(" · ");
  return (
    <article className={`${estilos.cartao} ${estilos[`etapa_${c.etapa}`]}`}>
      <div className={estilos.linhaDoTopo}>
        <span className={estilos.hora}>{horaNoMapa(c)}</span>
        {podeMontar && onMover && (
          <span className={estilos.setas}>
            <button type="button" onClick={onMover.subir} disabled={!onMover.subir} aria-label={`Subir ${c.paciente} na fila`}>↑</button>
            <button type="button" onClick={onMover.descer} disabled={!onMover.descer} aria-label={`Descer ${c.paciente} na fila`}>↓</button>
          </span>
        )}
        <span className={estilos.chip}>
          {NOME_DA_ETAPA[c.etapa]}
          {naEtapa != null && <> · {duracao(naEtapa)}</>}
          {c.etapa === "concluido" && c.destino && <> · {c.destino === "uti" ? "UTI" : NOME_DO_DESTINO[c.destino].split(" ")[0]}</>}
        </span>
      </div>
      <h3 className={estilos.paciente}>
        {c.paciente}{c.idade != null && <span>{c.idade} {c.idade === 1 ? "ano" : "anos"}</span>}
      </h3>
      <p className={estilos.procedimento}>{c.procedimento}</p>
      {detalhe && <p className={estilos.detalhe}>{detalhe}</p>}
      <p className={anestesista ? estilos.anestesista : `${estilos.anestesista} ${estilos.falta}`}>
        <Icone nome="pessoa" tamanho={14} /> {anestesista || "Sem anestesista"}
      </p>
      {c.etapa === "cancelado" ? (
        <p className={estilos.motivo}>Cancelado: {c.cancelado_motivo}</p>
      ) : marcos.length > 0 && (
        <p className={estilos.marcos}>
          {marcos.join(" · ")}
          {c.etapa === "concluido" && t.sala != null && <> · sala {duracao(t.sala)}</>}
        </p>
      )}
      {podeMontar && (
        <div className={estilos.acoesDoCartao}>
          {passo && (
            <button type="button" className={`primaryClinical compact ${estilos.passo}`} onClick={() => onPasso(passo.acao)}>
              {passo.rotulo}
            </button>
          )}
          <button type="button" className={`outlineClinical compact ${estilos.editar}`} onClick={onEditar}
            aria-label={`Editar ${c.paciente}`}>
            Editar
          </button>
        </div>
      )}
    </article>
  );
}

/** O fim do dia: os atos de cada anestesista, por convênio, e o que falta. */
function Resumo({ resumo, salas }: { resumo: ReturnType<typeof resumoDoDia>; salas: Sala[] }) {
  const nomeDaSala = (id: string | null) => salas.find((s) => s.id === id)?.nome ?? "Sem sala";
  return (
    <div className={estilos.resumo}>
      <div className={estilos.totais}>
        <p><strong>{resumo.atos}</strong> {resumo.atos === 1 ? "ato anestésico" : "atos anestésicos"}</p>
        {resumo.naoIniciados > 0 && <p><strong>{resumo.naoIniciados}</strong> ainda {resumo.naoIniciados === 1 ? "agendado" : "agendados"}</p>}
        {resumo.cancelados > 0 && <p><strong>{resumo.cancelados}</strong> {resumo.cancelados === 1 ? "cancelado" : "cancelados"}</p>}
      </div>
      <p className={estilos.explica}>
        Conta quem entrou em sala e não foi cancelado — o paciente que ainda está na RPA já foi anestesiado.
        É a lista que cada anestesista leva para faturar.
      </p>

      {resumo.pendencias.length > 0 && (
        <section className={estilos.pendencias} aria-labelledby="mapa-pendencias">
          <h2 id="mapa-pendencias"><Icone nome="alerta" tamanho={16} /> Falta preencher para cobrar</h2>
          <ul>
            {resumo.pendencias.map((p) => <li key={p.casoId}><b>{p.paciente}</b>: {p.falta.toLowerCase()}</li>)}
          </ul>
        </section>
      )}

      {resumo.porAnestesista.length === 0 ? (
        <p className={estilos.vazioResumo}>Nenhum paciente entrou em sala neste dia.</p>
      ) : (
        <div className={estilos.porAnestesista}>
          {resumo.porAnestesista.map((l) => (
            <section key={l.anestesistaId ?? "sem"} className={estilos.blocoAnestesista}>
              <header>
                <h2>{l.nome}</h2>
                <span>{l.atos.length} {l.atos.length === 1 ? "ato" : "atos"}</span>
              </header>
              <p className={estilos.convenios}>
                {l.porConvenio.map((pc) => <span key={pc.convenio}>{pc.convenio} <b>{pc.atos}</b></span>)}
              </p>
              <table className={estilos.atos}>
                <thead><tr><th>Entrada</th><th>Paciente</th><th>Cirurgia</th><th>Convênio</th></tr></thead>
                <tbody>
                  {l.atos.map((c) => (
                    <tr key={c.id}>
                      <td data-rotulo="Entrada">{horaDe(c.entrada_sala_em) || horaNoMapa(c)}<small>{nomeDaSala(c.sala_id)}</small></td>
                      <td data-rotulo="Paciente">{c.paciente}</td>
                      <td data-rotulo="Cirurgia">{c.procedimento}</td>
                      <td data-rotulo="Convênio">{c.convenio || <em>sem convênio</em>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {resumo.porConvenio.length > 0 && (
        <section className={estilos.blocoConvenios} aria-labelledby="mapa-convenios">
          <h2 id="mapa-convenios">Por convênio</h2>
          <ul>
            {resumo.porConvenio.map((pc) => <li key={pc.convenio}><span>{pc.convenio}</span><b>{pc.atos}</b></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
