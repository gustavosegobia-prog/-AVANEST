"use client";

import { useEffect, useRef, useState } from "react";
import estilos from "./intercorrencias.module.css";
import {
  calcularDose, calcularVolume, conferirPaciente, doseServe, numero, passosDe, populacaoDe, ROTULO_POPULACAO,
  volumeServe, type Alerta, type DoseCalculada, type PacienteDaConsulta,
} from "@/lib/intercorrencias/calculo";
import { acharProtocolo, CATEGORIAS } from "@/lib/intercorrencias/catalogo";
import { acharReferencia, BIBLIOGRAFIA_GERAL } from "@/lib/intercorrencias/referencias";
import { aprovacaoDe, dataDaAprovacao } from "@/lib/intercorrencias/aprovacao";
import { ROTULO_NIVEL, type Calculo } from "@/lib/calculos/doses";
import type { DoseDoProtocolo, Protocolo, Referencia, VolumeDoProtocolo } from "@/lib/intercorrencias/tipos";
import { Icone } from "@/components/icone";
import { CamposDoPaciente, pacienteDe, resumoDoPaciente, type DadosDoPaciente } from "./paciente";
import { RitmosNoMonitor } from "./ritmos";

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

/**
 * Uma linha por referência: o primeiro autor, o título e o ano. Onde no texto,
 * observações e a edição completa ficam no cadastro (referencias.ts) — na
 * consulta só ocupavam a tela.
 */
function referenciaCurta(r: Referencia): string {
  const autores = r.autoria.split(";")[0].replace(/\s*\([^)]*\)/g, "").trim();
  const primeiro = autores.split(",")[0].replace(/\s+et al\.?$/, "").trim();
  const etAl = autores.includes(",") || /\bet al\b/.test(autores);
  return `${primeiro}${etAl ? " et al" : ""}. ${r.titulo.replace(/\.$/, "")}.${r.ano ? ` ${r.ano}.` : ""}`;
}

function Avisos({ lista }: { lista: Alerta[] }) {
  if (!lista.length) return null;
  return (
    <ul className={estilos.avisos}>
      {lista.map((a, i) => (
        <li key={i} className={estilos[a.nivel]}>
          {a.nivel !== "info" && <Icone nome="alerta" tamanho={17} />}
          <span>{a.texto}</span>
        </li>
      ))}
    </ul>
  );
}

/** O teto de uma infusão por kg/min é por minuto: "Máximo: 200 mcg/min". */
const porMinuto = (d: DoseDoProtocolo) => (d.dose.por === "kg/min" ? "/min" : d.dose.por === "kg/h" ? "/h" : "");
const periodo = (c: Calculo) => (c.por === "kg/min" || c.por === "min" ? "/min" : c.por === "kg/h" || c.por === "h" ? "/h" : "");

function CartaoDose({ d, protocolo, paciente, semFaixa, confirmadas, aoConfirmar }: {
  d: DoseDoProtocolo; protocolo: Protocolo; paciente: PacienteDaConsulta; semFaixa: boolean;
  /** Soluções já conferidas ("rótulo|via"): conferir uma vez vale para todos os cartões que a usam. */
  confirmadas: string[]; aoConfirmar: (chave: string) => void;
}) {
  const [indice, setIndice] = useState(0);
  const conta: DoseCalculada = calcularDose(d, protocolo, paciente, indice);
  const original = d.apresentacoes[indice] ?? d.apresentacoes[0];
  const bloqueio = semFaixa ? "Informe a idade para calcular na faixa certa." : conta.bloqueio;
  const chave = `${original?.rotulo ?? "sem frasco"}|${d.via}`;
  const precisaConfirmar = d.altoRisco && original && !confirmadas.includes(chave);
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
          {d.tetoAbsoluto && <div className={estilos.miuda}>Máximo: {numero(d.tetoAbsoluto.valor)} {d.tetoAbsoluto.unidade}{porMinuto(d)}</div>}
        </div>
        {bloqueio ? (
          <p className={estilos.bloqueio} style={{ gridColumn: "span 2" }}>{bloqueio}</p>
        ) : (
          <>
            <div className={`${estilos.caixa} ${estilos.caixaDose}`}>
              <small>Dose calculada</small>
              {conta.contas.map((c) => (
                <div key={c.nivel} className={estilos.nivel}>
                  {varios && <em>{ROTULO_NIVEL[c.nivel]}</em>}
                  <b>{numero(c.doseTotal, 3)} {c.unidadeDose}{periodo(c)}</b>
                </div>
              ))}
            </div>
            <div className={`${estilos.caixa} ${estilos.caixaVolume}`}>
              <small>Volume</small>
              {!original ? (
                <span className={estilos.confirmado}>{d.semVolume ?? "Pela bula: o frasco e a reconstituição variam com o fabricante."}</span>
              ) : precisaConfirmar ? (
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

      {!original ? null : d.apresentacoes.length > 1 ? (
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
      {original?.preparo && <p className={estilos.preparo}>Preparo: {original.preparo}</p>}
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

/** "Desfibrilação", "Cristaloide", "Hemocomponentes": o nome do grupo pelo que há nele. */
function tituloDosVolumes(lista: VolumeDoProtocolo[]): string {
  if (lista[0].grupo) return lista[0].grupo;
  if (lista.every((v) => v.unidade === "J")) return "Desfibrilação";
  if (lista.every((v) => !v.rotulo)) return "Cristaloide";
  return "Volumes";
}

export function ProtocoloTela({
  p, dados, set, daFicha, favorito, aoFavoritar, aoVoltar, aoBuscar, aoAbrirCalculadora, aoAbrirProtocolo,
}: {
  p: Protocolo;
  dados: DadosDoPaciente;
  set: (c: string, v: string) => void;
  daFicha: boolean;
  favorito: boolean;
  aoFavoritar: () => void;
  aoVoltar: () => void;
  aoBuscar: () => void;
  aoAbrirCalculadora?: () => void;
  /** "Criança: use o SAV pediátrico" abre o outro protocolo. */
  aoAbrirProtocolo?: (id: string) => void;
}) {
  const [confirmadas, setConfirmadas] = useState<string[]>([]);
  // Abre no começo do protocolo, e não onde a lista estava rolada.
  const topo = useRef<HTMLDivElement>(null);
  useEffect(() => { topo.current?.scrollIntoView({ block: "start" }); }, []);

  const aprovacao = aprovacaoDe(p);
  const paciente = pacienteDe(dados);
  const populacao = populacaoDe(paciente);
  const categoria = CATEGORIAS.find((c) => c.id === p.categoria)!;
  const doses = p.medicamentos.filter((d) => populacao === null || doseServe(d, populacao, paciente.idadeAnos));
  const grupos = populacao === null
    ? [["Adulto", doses.filter((d) => d.populacao !== "pediatrico")], ["Criança", doses.filter((d) => d.populacao === "pediatrico")]] as const
    : [[null, doses]] as const;
  const volumes = p.volumes.filter((v) => populacao === null || volumeServe(v, populacao));
  // Choque, cristaloide e hemocomponentes, e os grupos com nome próprio (doses máximas de anestésico local).
  const nomeados = [...new Set(volumes.flatMap((v) => (v.grupo ? [v.grupo] : [])))];
  const gruposDeVolumes = [
    volumes.filter((v) => !v.grupo && v.unidade === "J"),
    volumes.filter((v) => !v.grupo && v.unidade !== "J"),
    ...nomeados.map((g) => volumes.filter((v) => v.grupo === g)),
  ].filter((g) => g.length);
  // O protocolo certo para a faixa do paciente: forte quando a faixa bate; sem idade, só a lembrança.
  const veja = (p.veja ?? [])
    .filter((v) => populacao === null || v.quando.includes(populacao))
    .map((v) => ({ ...v, alvo: acharProtocolo(v.protocolo) }))
    .filter((v) => v.alvo);
  // Protocolo só de condutas (via aérea, listas): a seção de doses traz só as notas — e, sem notas, não aparece.
  const temCalculo = p.medicamentos.length > 0 || p.volumes.length > 0;
  const notas = p.notasDeDose ?? [];
  const temDoses = temCalculo || notas.length > 0;
  const relacionados = (p.relacionados ?? []).filter((r) => acharProtocolo(r.protocolo));

  return (
    <div ref={topo} className={`${estilos.modulo} ${estilos.impressao}`} style={{ scrollMarginTop: 80 }}>
      <p className={estilos.soImpressao}>
        AVANEST · Intercorrências anestésicas · impresso em {dataBr(new Date().toISOString())} · versão {p.versao}
        {aprovacao ? ` · aprovada por ${aprovacao.responsavel}, ${aprovacao.crm}, em ${dataDaAprovacao(aprovacao)}` : " · sem aprovação registrada"}
        <br />Paciente: {resumoDoPaciente(paciente)}{paciente.gestante ? " · gestante" : ""}
      </p>

      <div className={`${estilos.barraAcoes} ${estilos.naoImprimir}`}>
        <button type="button" className={estilos.botao} onClick={aoVoltar} aria-label={`Voltar para ${categoria.nome}`}>
          <Icone nome="voltar" tamanho={18} />Voltar
        </button>
        <button type="button" className={`${estilos.botao} ${estilos.soNoEstreito}`} onClick={aoBuscar}>
          <Icone nome="busca" tamanho={18} />Buscar outra
        </button>
        <button type="button" className={`${estilos.botao} ${estilos.empurra}`} aria-pressed={favorito} onClick={aoFavoritar}
          aria-label={favorito ? "Tirar dos favoritos" : "Favoritar"}>
          <Icone nome="estrela" tamanho={18} /><span className={estilos.someNoCelular}>{favorito ? "Favorito" : "Favoritar"}</span>
        </button>
        {aoAbrirCalculadora && (
          <button type="button" className={estilos.botao} onClick={aoAbrirCalculadora} aria-label="Calculadora de doses">
            <Icone nome="calculadora" tamanho={18} /><span className={estilos.someNoCelular}>Calculadora</span>
          </button>
        )}
        <button type="button" className={estilos.botao} onClick={() => window.print()} aria-label="Imprimir ou salvar em PDF">
          <Icone nome="imprimir" tamanho={18} />PDF
        </button>
      </div>

      <header className={estilos.protoTitulo}>
        <h2>{p.titulo}</h2>
        <p>{p.resumo}</p>
        <div className={estilos.linhaSelos}>
          <span className={estilos.tagCategoria}>
            {categoria.nome}
          </span>
          {p.populacoes.map((x) => (
            <span key={x} className={`${estilos.faixa} ${x === populacao ? estilos.faixaAtiva : ""}`}>{ROTULO_POPULACAO[x]}</span>
          ))}
        </div>
        <div className={estilos.linhaSelos}>
          <span>Versão {p.versao} · conteúdo de {dataBr(p.atualizadoEm)}</span>
          {aprovacao ? (
            <span>Aprovada por {aprovacao.responsavel}, {aprovacao.crm}, em {dataDaAprovacao(aprovacao)}</span>
          ) : (
            <span className={estilos.semAprovacao}>Versão nova, sem aprovação registrada</span>
          )}
        </div>
      </header>

      {/* No computador, os dados do paciente ficam na coluna da esquerda. */}
      <div className={`${estilos.naoImprimir} ${estilos.soNoEstreito}`}>
        <CamposDoPaciente dados={dados} set={set} daFicha={daFicha} compacto />
      </div>
      <Avisos lista={conferirPaciente(paciente)} />

      {veja.map((v) => (
        <div key={v.protocolo} className={`${estilos.veja} ${populacao ? estilos.vejaForte : ""}`} role="note">
          <span>{v.texto}</span>
          {aoAbrirProtocolo && (
            <button type="button" className={`${estilos.botao} ${populacao ? estilos.botaoForte : ""} ${estilos.naoImprimir}`}
              onClick={() => aoAbrirProtocolo(v.protocolo)}>
              Abrir {v.alvo!.titulo}
            </button>
          )}
        </div>
      ))}

      {/* A ordem da crise: reconhecer, agir, as doses deste paciente; o resto depois. */}
      <nav className={`${estilos.atalhos} ${estilos.naoImprimir}`} aria-label="Partes do protocolo">
        <a href="#reconhecer">Reconhecer</a>
        <a href="#agir" className={estilos.atalhoAgir}>Agir agora</a>
        {temDoses && <a href="#doses">Doses</a>}
        <a href="#pensar">Pensar em</a>
        <a href="#depois">Depois</a>
        <a href="#referencias">Referências</a>
      </nav>

      <section id="reconhecer" className={`${estilos.secao} ${estilos.reconhecer}`} aria-labelledby="t-rec">
        <h3 id="t-rec">Reconhecer</h3>
        <ul>{p.reconhecer.map((x) => <li key={x}>{x}</li>)}</ul>
        {p.ritmos && p.ritmos.length > 0 && (
          <>
            <h4 id="ritmos">Ritmo no monitor</h4>
            <RitmosNoMonitor ritmos={p.ritmos} />
          </>
        )}
      </section>

      <section id="agir" className={`${estilos.secao} ${estilos.agir}`} aria-labelledby="t-agir">
        <h3 id="t-agir"><Icone nome="alerta" tamanho={21} />Agir agora</h3>
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

      {temDoses && <section id="doses" className={temCalculo ? estilos.secaoAberta : estilos.secao} aria-labelledby="t-doses">
        <h3 id="t-doses">{temCalculo ? "Medicamentos e doses" : "Medicamentos"}{temCalculo && populacao ? ` · ${ROTULO_POPULACAO[populacao]}` : ""}</h3>
        <div className={estilos.doses}>
          {temCalculo && populacao && doses.length === 0 && volumes.length === 0 && (
            <div className={`${estilos.bloqueio} ${estilos.semDoses}`}>
              <span>
                Este protocolo não traz doses para {ROTULO_POPULACAO[populacao].toLowerCase()}
                {veja.length || notas.length ? "." : ". Confira a idade informada."}
              </span>
              {aoAbrirProtocolo && veja.map((v) => (
                <button key={v.protocolo} type="button" className={`${estilos.botao} ${estilos.botaoForte} ${estilos.naoImprimir}`}
                  onClick={() => aoAbrirProtocolo(v.protocolo)}>
                  Abrir {v.alvo!.titulo}
                </button>
              ))}
            </div>
          )}
          {grupos.map(([titulo, lista]) => (
            <div key={titulo ?? "todas"} className={`${estilos.doses} ${estilos.listaDoses}`}>
              {titulo && <h4 className={estilos.grupoDoses}>{titulo}</h4>}
              {lista.map((d) => (
                <CartaoDose key={`${d.id}-${populacao}`} d={d} protocolo={p} paciente={paciente} semFaixa={populacao === null}
                  confirmadas={confirmadas} aoConfirmar={(c) => setConfirmadas((v) => [...v, c])} />
              ))}
            </div>
          ))}
          {gruposDeVolumes.map((grupo) => (
            <div key={grupo[0].id} className={estilos.doses}>
              <h4 className={estilos.grupoDoses}>{tituloDosVolumes(grupo)}</h4>
              <div className={estilos.volumes}>
                {grupo.map((v) => {
                  const c = calcularVolume(v, paciente);
                  return (
                    <div key={v.id} className={estilos.volume}>
                      {v.rotulo && <strong className={estilos.volumeNome}>{v.rotulo}</strong>}
                      <small>{v.indicacao} · {c.base}</small>
                      {c.bloqueio ? <span className={estilos.miuda}>{c.bloqueio}</span> : <b>{c.texto}</b>}
                      {v.repeticao && <small>{v.repeticao}</small>}
                      <small>Fonte: {v.referencias.map(curta).join(" · ")}</small>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {notas.length > 0 && (
            <ul className={estilos.notasDose}>{notas.map((x) => <li key={x}>{x}</li>)}</ul>
          )}
        </div>
      </section>}

      <section id="pensar" className={estilos.secao} aria-labelledby="t-pensar">
        <h3 id="t-pensar">Pensar em</h3>
        <ul>{p.pensarEm.map((x) => <li key={x}>{x}</li>)}</ul>
        {aoAbrirProtocolo && relacionados.length > 0 && (
          <nav className={`${estilos.relacionados} ${estilos.naoImprimir}`} aria-label="Protocolos que costumam vir junto">
            <span>Abrir também</span>
            {relacionados.map((r) => (
              <button key={r.protocolo} type="button" className={estilos.botao} onClick={() => aoAbrirProtocolo(r.protocolo)}>
                {r.texto}<Icone nome="seta" tamanho={16} />
              </button>
            ))}
          </nav>
        )}
      </section>

      <section id="depois" className={estilos.secao} aria-labelledby="t-depois">
        <h3 id="t-depois">Depois</h3>
        <ul>{p.depois.map((x) => <li key={x}>{x}</li>)}</ul>
      </section>

      {p.divergencias.length > 0 && (
        <section className={estilos.secao}>
          <details>
            <summary>Diferenças entre as fontes ({p.divergencias.length})<Icone nome="seta" tamanho={18} /></summary>
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

      <section id="referencias" className={`${estilos.secao} ${estilos.secaoReferencias}`} aria-labelledby="t-refs">
        <h3 id="t-refs">Referências</h3>
        <ol className={estilos.referencias}>
          {[...new Set([...p.referencias, ...BIBLIOGRAFIA_GERAL])].map((id) => {
            const r = acharReferencia(id);
            if (!r) return null;
            const url = r.doi ? `https://doi.org/${r.doi}` : r.link;
            return (
              <li key={id}>
                {referenciaCurta(r)}
                {url && <> <a href={url} target="_blank" rel="noreferrer">Abrir</a></>}
              </li>
            );
          })}
        </ol>
      </section>

      <p className={estilos.rodape}>
        Auxílio cognitivo para emergência. Não substitui o julgamento médico: confira apresentação, via e dose antes de administrar.
      </p>
    </div>
  );
}
