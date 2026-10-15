"use client";

import { useEffect, useRef, useState } from "react";
import estilos from "./intercorrencias.module.css";
import {
  calcularDose, calcularVolume, conferirPaciente, doseServe, numero, passosDe, populacaoDe, ROTULO_POPULACAO,
  volumeServe, type Alerta, type DoseCalculada, type PacienteDaConsulta,
} from "@/lib/intercorrencias/calculo";
import { CATEGORIAS } from "@/lib/intercorrencias/catalogo";
import { acharReferencia, BIBLIOGRAFIA_GERAL, citarReferencia } from "@/lib/intercorrencias/referencias";
import { ROTULO_NIVEL, type Calculo } from "@/lib/calculos/doses";
import { ROTULO_SITUACAO, type Estado } from "@/lib/intercorrencias/situacao";
import type { DoseDoProtocolo, Protocolo, Situacao } from "@/lib/intercorrencias/tipos";
import { COR_DA_CATEGORIA, CamposDoPaciente, pacienteDe, resumoDoPaciente, type DadosDoPaciente } from "./paciente";
import { PainelDeRevisao } from "./revisao";
import type { Revisoes } from "./use-revisoes";

const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
export const dataBr = (iso: string) => DATA.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));

/** "ANZAAG cartão 1", "QRH 3-1": o nome curto que cabe no pé do cartão. */
function curta(id: string): string {
  const r = acharReferencia(id);
  if (!r) return id;
  if (id.startsWith("anzaag-cartao-")) return `ANZAAG-ANZCA 2022, cartão ${id.slice(-1)}`;
  if (id.startsWith("qrh-")) return `QRH ${id.slice(4)} (Association of Anaesthetists)`;
  if (/^manual-\d+$/.test(id)) return `Manual de Crises, protocolo ${id.slice(7)}`;
  return `${r.autoria.split(",")[0].replace(/ et al\.?$/, "")}${r.autoria.includes(",") ? " et al." : ""}, ${r.ano ?? "s/ ano"}`;
}

function Avisos({ lista }: { lista: Alerta[] }) {
  if (!lista.length) return null;
  return (
    <ul className={estilos.avisos}>
      {lista.map((a, i) => (
        <li key={i} className={estilos[a.nivel]}>
          {a.nivel === "perigo" ? "⚠️ " : a.nivel === "atencao" ? "! " : ""}{a.texto}
        </li>
      ))}
    </ul>
  );
}

const periodo = (c: Calculo) => (c.por === "kg/min" || c.por === "min" ? "/min" : c.por === "kg/h" || c.por === "h" ? "/h" : "");

function CartaoDose({ d, protocolo, paciente, semFaixa, previa, confirmadas, aoConfirmar }: {
  d: DoseDoProtocolo; protocolo: Protocolo; paciente: PacienteDaConsulta; semFaixa: boolean; previa: boolean;
  /** Soluções já conferidas ("rótulo|via"): conferir uma vez vale para todos os cartões que a usam. */
  confirmadas: string[]; aoConfirmar: (chave: string) => void;
}) {
  const [indice, setIndice] = useState(0);
  const conta: DoseCalculada = calcularDose(d, protocolo, paciente, indice);
  const original = d.apresentacoes[indice] ?? d.apresentacoes[0];
  const bloqueio = semFaixa ? "Informe a idade para calcular na faixa certa." : conta.bloqueio;
  const chave = `${original.rotulo}|${d.via}`;
  const precisaConfirmar = d.altoRisco && !confirmadas.includes(chave);
  const varios = conta.contas.length > 1;

  return (
    <article className={estilos.dose} aria-label={`${d.farmaco}, ${d.indicacao}`}>
      <div className={estilos.doseTopo}>
        <strong>{d.farmaco}</strong>
        <span>{d.via} · {d.indicacao}</span>
        {d.altoRisco && <span className={estilos.altoRisco}>Alto risco</span>}
      </div>

      <div className={estilos.tres}>
        <div className={`${estilos.caixa} ${estilos.caixaRef}`}>
          <small>Dose de referência</small>
          <b>{conta.referencia}</b>
          {d.tetoAbsoluto && <div className={estilos.miuda}>Máximo: {numero(d.tetoAbsoluto.valor)} {d.tetoAbsoluto.unidade}</div>}
        </div>
        {bloqueio ? (
          <p className={estilos.bloqueio} style={{ gridColumn: "span 2" }}>{bloqueio}</p>
        ) : (
          <>
            <div className={`${estilos.caixa} ${estilos.caixaDose}`}>
              <small>Dose calculada{previa ? " · prévia" : ""}</small>
              {conta.contas.map((c) => (
                <div key={c.nivel} className={estilos.nivel}>
                  {varios && <em>{ROTULO_NIVEL[c.nivel]}</em>}
                  <b>{numero(c.doseTotal, 3)} {c.unidadeDose}{periodo(c)}</b>
                </div>
              ))}
            </div>
            <div className={`${estilos.caixa} ${estilos.caixaVolume}`}>
              <small>Volume</small>
              {precisaConfirmar ? (
                <>
                  <button type="button" className={estilos.confirmar}
                    onClick={() => aoConfirmar(chave)}>
                    Confirmar {original.rotulo} · {d.via}
                  </button>
                  {/* No papel não há o que tocar: o volume sai impresso, com a solução ao lado. */}
                  <div className={estilos.soImpressao}>
                    {conta.contas.map((c) => (
                      <div key={c.nivel} className={estilos.nivel}>
                        {varios && <em>{ROTULO_NIVEL[c.nivel]}</em>}
                        <b>{c.volume !== undefined ? `${numero(c.volume)} ${c.unidadeVolume}` : "—"}</b>
                      </div>
                    ))}
                    <span className={estilos.confirmado}>{original.rotulo}, {d.via}</span>
                  </div>
                </>
              ) : (
                <>
                  {conta.contas.map((c) => (
                    <div key={c.nivel} className={estilos.nivel}>
                      {varios && <em>{ROTULO_NIVEL[c.nivel]}</em>}
                      <b>{c.volume !== undefined ? `${numero(c.volume)} ${c.unidadeVolume}` : "—"}</b>
                    </div>
                  ))}
                  {d.altoRisco && <span className={estilos.confirmado}>Conferido: {original.rotulo}, {d.via}</span>}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {d.apresentacoes.length > 1 ? (
        <div className={estilos.apresentacoes} role="group" aria-label="Concentração">
          {d.apresentacoes.map((a, i) => (
            <button key={a.rotulo} type="button" aria-pressed={i === indice} onClick={() => setIndice(i)}>{a.rotulo}</button>
          ))}
        </div>
      ) : (
        <p className={estilos.preparo}>Apresentação: {conta.apresentacao?.rotulo ?? original.rotulo}</p>
      )}
      {d.apresentacoes.length > 1 && conta.apresentacao?.rotulo !== original.rotulo && conta.apresentacao && (
        <p className={estilos.preparo}>{conta.apresentacao.rotulo}</p>
      )}
      {original.preparo && <p className={estilos.preparo}>Preparo: {original.preparo}</p>}
      {d.repeticao && <p className={estilos.miuda}><b>Repetir:</b> {d.repeticao}</p>}
      {d.velocidade && <p className={estilos.miuda}><b>Ritmo:</b> {d.velocidade}</p>}
      <Avisos lista={conta.alertas} />
      {d.cuidados && d.cuidados.length > 0 && (
        <div className={estilos.cuidados}>
          <b>Cuidados</b>
          <ul>{d.cuidados.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
      <p className={estilos.fonteDose}>Fonte: {d.referencias.map(curta).join(" · ")}</p>
    </article>
  );
}

export function ProtocoloTela({
  doCodigo, estado, equipe, superAdmin, dados, set, daFicha, favorito, aoFavoritar, aoVoltar, aoBuscar, aoAbrirCalculadora, revisoes,
}: {
  superAdmin: boolean;
  /** A versão do código (o que o revisor revisa). */
  doCodigo: Protocolo;
  estado: Estado;
  equipe: boolean;
  dados: DadosDoPaciente;
  set: (c: string, v: string) => void;
  daFicha: boolean;
  favorito: boolean;
  aoFavoritar: () => void;
  aoVoltar: () => void;
  aoBuscar: () => void;
  aoAbrirCalculadora?: () => void;
  revisoes: Revisoes;
}) {
  const [verEmUso, setVerEmUso] = useState(false);
  const [confirmadas, setConfirmadas] = useState<string[]>([]);
  // Abre no começo do protocolo, e não onde a lista estava rolada.
  const topo = useRef<HTMLDivElement>(null);
  useEffect(() => { topo.current?.scrollIntoView({ block: "start" }); }, []);
  // O médico vê só o aprovado; a equipe vê a versão do código, e pode
  // comparar com a que está em uso.
  const p = !equipe ? estado.emUso! : verEmUso && estado.emUso ? estado.emUso : doCodigo;
  const mostrandoAprovado = Boolean(estado.emUso) && (!equipe || verEmUso || estado.emUso === doCodigo);
  const situacao: Situacao = mostrandoAprovado ? (estado.precisaAtualizar ? "necessita_atualizacao" : "aprovado") : estado.daVersaoAtual;
  const previa = !mostrandoAprovado;

  const paciente = pacienteDe(dados);
  const populacao = populacaoDe(paciente);
  const categoria = CATEGORIAS.find((c) => c.id === p.categoria)!;
  const doses = p.medicamentos.filter((d) => populacao === null || doseServe(d, populacao, paciente.idadeAnos));
  const grupos = populacao === null
    ? [["Adulto", doses.filter((d) => d.populacao !== "pediatrico")], ["Criança", doses.filter((d) => d.populacao === "pediatrico")]] as const
    : [[null, doses]] as const;
  const volumes = p.volumes.filter((v) => populacao === null || volumeServe(v, populacao));
  const refsDasDoses = new Set(p.medicamentos.flatMap((d) => d.referencias));

  return (
    <div ref={topo} className={`${estilos.modulo} ${estilos.impressao}`}
      style={{ ["--cat" as string]: COR_DA_CATEGORIA[p.categoria], scrollMarginTop: 80 }}>
      <p className={estilos.soImpressao}>
        AVANEST · Intercorrências anestésicas · impresso em {dataBr(new Date().toISOString())} · versão {p.versao} · {ROTULO_SITUACAO[situacao]}
        <br />Paciente: {resumoDoPaciente(paciente)}{paciente.gestante ? " · gestante" : ""}
      </p>

      <div className={`${estilos.barraAcoes} ${estilos.naoImprimir}`}>
        <button type="button" className={estilos.botao} onClick={aoVoltar} aria-label={`Voltar para ${categoria.nome}`}>← Voltar</button>
        <button type="button" className={estilos.botao} onClick={aoBuscar}>Buscar outra</button>
        <button type="button" className={estilos.botao} aria-pressed={favorito} onClick={aoFavoritar}
          aria-label={favorito ? "Tirar dos favoritos" : "Favoritar"}>
          {favorito ? "★" : "☆"}<span className={estilos.someNoCelular}>{favorito ? " Favorito" : " Favoritar"}</span>
        </button>
        {aoAbrirCalculadora && <button type="button" className={estilos.botao} onClick={aoAbrirCalculadora}>Calculadora</button>}
        <button type="button" className={estilos.botao} onClick={() => window.print()} aria-label="Imprimir ou salvar em PDF">
          PDF<span className={estilos.someNoCelular}> / imprimir</span>
        </button>
      </div>

      <header className={estilos.protoTitulo}>
        <span className={estilos.tagCategoria}>{categoria.letra} · {categoria.nome}</span>
        <h2>{p.titulo}</h2>
        <p>{p.resumo}</p>
        <div className={estilos.linhaSelos}>
          <span className={`${estilos.selo} ${estilos[`selo_${situacao}`]}`}>{ROTULO_SITUACAO[situacao]}</span>
          <span>Versão {p.versao} · conteúdo de {dataBr(p.atualizadoEm)}</span>
          {mostrandoAprovado && estado.aprovacao && (
            <span>Aprovado por {estado.aprovacao.autorNome}{estado.aprovacao.autorCrm ? ` (${estado.aprovacao.autorCrm})` : ""} em {dataBr(estado.aprovacao.criadoEm)}</span>
          )}
        </div>
        <div className={estilos.linhaSelos}>
          {p.populacoes.map((x) => (
            <span key={x} className={`${estilos.faixa} ${x === populacao ? estilos.faixaAtiva : ""}`}>{ROTULO_POPULACAO[x]}</span>
          ))}
        </div>
      </header>

      {previa && (
        <p className={estilos.revisaoAviso} role="note">
          Prévia para revisão: ainda não aprovado pelo revisor médico. Não usar como referência clínica.
        </p>
      )}
      {mostrandoAprovado && estado.precisaAtualizar && (
        <p className={estilos.revisaoAviso} role="note">
          O revisor marcou esta versão para atualização. Ela continua valendo até a nova ser aprovada.
        </p>
      )}
      {equipe && estado.versaoNovaEsperando && (
        <div className={`${estilos.barraAcoes} ${estilos.naoImprimir}`}>
          <span className={estilos.miuda}>
            Os médicos veem a versão {(estado.emUso as Protocolo).versao} aprovada; a versão {doCodigo.versao} espera revisão.
          </span>
          <button type="button" className={estilos.botao} onClick={() => setVerEmUso((v) => !v)}>
            {verEmUso ? "Ver a versão nova" : "Ver a versão em uso"}
          </button>
        </div>
      )}

      <div className={estilos.naoImprimir}>
        <CamposDoPaciente dados={dados} set={set} daFicha={daFicha} compacto />
      </div>
      <Avisos lista={conferirPaciente(paciente)} />

      <nav className={`${estilos.atalhos} ${estilos.naoImprimir}`} aria-label="Partes do protocolo">
        <a href="#agir">Agir agora</a><a href="#doses">Doses</a><a href="#reconhecer">Reconhecer</a>
        <a href="#pensar">Pensar em</a><a href="#depois">Depois</a><a href="#referencias">Referências</a>
      </nav>

      <section id="agir" className={`${estilos.secao} ${estilos.agir}`} aria-labelledby="t-agir">
        <h3 id="t-agir">Agir agora</h3>
        <ol className={estilos.passos}>
          {passosDe(p, populacao).map((x) => (
            <li key={x.texto}>
              <div>
                {x.so && <span className={estilos.soPara}>{x.so.map((s) => ROTULO_POPULACAO[s]).join(" / ")}</span>}
                <b>{x.texto}</b>
                {x.detalhe && <small>{x.detalhe}</small>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="doses" className={estilos.secao} aria-labelledby="t-doses">
        <h3 id="t-doses">Medicamentos e doses{populacao ? ` · ${ROTULO_POPULACAO[populacao]}` : ""}</h3>
        <div className={estilos.doses}>
          {grupos.map(([titulo, lista]) => (
            <div key={titulo ?? "todas"} className={estilos.doses}>
              {titulo && <h4 className={estilos.grupoDoses}>{titulo}</h4>}
              {lista.map((d) => (
                <CartaoDose key={`${d.id}-${populacao}`} d={d} protocolo={p} paciente={paciente} semFaixa={populacao === null} previa={previa}
                  confirmadas={confirmadas} aoConfirmar={(c) => setConfirmadas((v) => [...v, c])} />
              ))}
            </div>
          ))}
          {volumes.length > 0 && (
            <>
              <h4 className={estilos.grupoDoses}>Cristaloide</h4>
              <div className={estilos.volumes}>
                {volumes.map((v) => {
                  const c = calcularVolume(v, paciente);
                  return (
                    <div key={v.id} className={estilos.volume}>
                      <small>{v.indicacao} · {c.base}</small>
                      {c.bloqueio ? <span className={estilos.miuda}>{c.bloqueio}</span> : <b>{c.texto}</b>}
                      {v.repeticao && <small>{v.repeticao}</small>}
                      <small>Fonte: {v.referencias.map(curta).join(" · ")}</small>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      <section id="reconhecer" className={`${estilos.secao} ${estilos.reconhecer}`} aria-labelledby="t-rec">
        <h3 id="t-rec">Reconhecer</h3>
        <ul>{p.reconhecer.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      <section id="pensar" className={estilos.secao} aria-labelledby="t-pensar">
        <h3 id="t-pensar">Pensar em</h3>
        <ul>{p.pensarEm.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      <section id="depois" className={estilos.secao} aria-labelledby="t-depois">
        <h3 id="t-depois">Depois</h3>
        <ul>{p.depois.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      {p.divergencias.length > 0 && (
        <section className={estilos.secao}>
          <details open={equipe}>
            <summary>Diferenças entre as fontes ({p.divergencias.length})</summary>
            <div style={{ marginTop: 12 }}>
              {p.divergencias.map((d) => (
                <div key={d.tema} className={estilos.divergencia}>
                  <strong>{d.tema}</strong>
                  {d.posicoes.map((x) => <p key={x.referencia}><b>{curta(x.referencia)}:</b> {x.texto}</p>)}
                  <p><b>No protocolo:</b> {d.escolha}</p>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}

      <section id="referencias" className={estilos.secao} aria-labelledby="t-refs">
        <h3 id="t-refs">Referência científica</h3>
        <ol className={estilos.referencias}>
          {[...p.referencias, ...BIBLIOGRAFIA_GERAL].map((id) => {
            const r = acharReferencia(id);
            if (!r) return null;
            return (
              <li key={id}>
                {citarReferencia(r)}
                {r.doi && <> DOI: <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">{r.doi}</a>.</>}
                {r.link && <> <a href={r.link} target="_blank" rel="noreferrer">Abrir a fonte</a>.</>}
                <br />
                <span className={estilos.miuda}>
                  {r.localizacao ? `Onde: ${r.localizacao}.` : "Localização no texto: a conferir."}
                  {refsDasDoses.has(id) ? " Fundamenta doses deste protocolo." : ""}
                  {r.observacao ? ` ${r.observacao}` : ""}
                </span>
                <span className={`${estilos.refEstado} ${r.conferida ? estilos.refOk : estilos.refConferir}`}>
                  {r.conferida ? "conferida no original" : "a conferir"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {equipe && (
        <div className={estilos.naoImprimir}>
          <PainelDeRevisao protocolo={doCodigo} estado={estado} revisoes={revisoes} superAdmin={superAdmin} />
        </div>
      )}

      <p className={estilos.rodape}>
        Auxílio cognitivo para emergência. Não substitui o julgamento médico: confira apresentação, via e dose antes de administrar.
      </p>
    </div>
  );
}
