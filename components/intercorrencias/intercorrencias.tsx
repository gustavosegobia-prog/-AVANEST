"use client";

import { useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import estilos from "./intercorrencias.module.css";
import { buscar, CATEGORIAS, itensDaCategoria, PROTOCOLOS } from "@/lib/intercorrencias/catalogo";
import { resolverEstado, ROTULO_SITUACAO, type Estado } from "@/lib/intercorrencias/situacao";
import type { Categoria, Protocolo } from "@/lib/intercorrencias/tipos";
import { Icone } from "@/components/icone";
import { CamposDoPaciente, type DadosDoPaciente } from "./paciente";
import { ProtocoloTela } from "./protocolo";
import { EquipeCientifica } from "./revisao";
import { useRevisoes } from "./use-revisoes";

/**
 * INTERCORRÊNCIAS ANESTÉSICAS — a consulta da crise.
 *
 * No computador, duas colunas: à esquerda, fixas ao rolar, a busca, os dados
 * do paciente e o índice por categoria (as abas do manual); à direita, o
 * índice completo ou o protocolo aberto. No celular, uma coluna só, e o
 * protocolo aberto ocupa a tela inteira. A busca acha pelo nome, pelo
 * sinônimo ou pelo que se vê no monitor ("estridor", "PA caindo").
 *
 * Quem vê o quê: o médico vê só o que um revisor aprovou (o instantâneo
 * aprovado, mesmo que o código já tenha uma versão nova); a equipe científica
 * vê tudo, com a situação de cada um e a prévia marcada como prévia. Consultar
 * não registra nada no prontuário.
 */

const FAVORITOS = "avanest:intercorrencias:favoritos";

/** Lido na inicialização: o módulo só aparece depois de um toque, nunca na primeira pintura do servidor. */
function lerFavoritos(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const salvo = window.localStorage.getItem(FAVORITOS);
    return salvo ? (JSON.parse(salvo) as string[]).filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function Intercorrencias({
  dados, set, aoAbrirCalculadora, daFicha = false, superAdmin = false, titulo = "Intercorrências anestésicas",
}: {
  /** "Manejo de crises em anestesia" no menu da área médica. */
  titulo?: string;
  dados: DadosDoPaciente;
  set: (c: string, v: string) => void;
  aoAbrirCalculadora?: () => void;
  /** Aberto de dentro da ficha: os dados vieram do atendimento. */
  daFicha?: boolean;
  /**
   * Conferido no servidor (perfis.super_admin). Vale como administrador do
   * módulo mesmo antes de o banco dele existir: é quem vê a prévia para
   * aprovar o desenho.
   */
  superAdmin?: boolean;
}) {
  const revisoes = useRevisoes();
  const id = useId();
  const busca = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);

  const equipe = superAdmin || Boolean(revisoes.papel && (revisoes.papel.papel || revisoes.papel.admin));
  const estados = useMemo(
    () => Object.fromEntries(PROTOCOLOS.map((p) => [p.id, resolverEstado(p, revisoes.registros)])) as Record<string, Estado>,
    [revisoes.registros],
  );
  const disponivel = (p: Protocolo) => equipe || Boolean(estados[p.id].emUso);
  const abrir = (p: Protocolo) => { if (disponivel(p)) { setTermo(""); setAberto(p.id); } };

  const alternarFavorito = (x: string) => setFavoritos((v) => {
    const novo = v.includes(x) ? v.filter((y) => y !== x) : [...v, x];
    try { window.localStorage.setItem(FAVORITOS, JSON.stringify(novo)); } catch { /* sem storage */ }
    return novo;
  });

  /** O índice leva ao grupo da categoria, saindo do protocolo ou da busca. */
  const irPara = (categoria: Categoria) => {
    flushSync(() => { setAberto(null); setTermo(""); });
    document.getElementById(`${id}-${categoria}`)?.scrollIntoView({ block: "start" });
  };
  const buscarOutra = () => {
    flushSync(() => { setAberto(null); setTermo(""); });
    busca.current?.focus();
  };

  const encontrado = aberto ? PROTOCOLOS.find((p) => p.id === aberto) : undefined;
  const protocolo = encontrado && disponivel(encontrado) ? encontrado : undefined;

  /** A etiqueta do item: a situação para a equipe; para o médico, só "em revisão" quando ainda não pode abrir. */
  const selo = (p: Protocolo) => {
    const e = estados[p.id];
    const s = equipe ? e.daVersaoAtual : e.emUso ? (e.precisaAtualizar ? "necessita_atualizacao" : "aprovado") : null;
    return s
      ? <span className={`${estilos.selo} ${estilos[`selo_${s}`]}`}>{ROTULO_SITUACAO[s]}</span>
      : <span className={`${estilos.selo} ${estilos.selo_preparo}`}>Em revisão</span>;
  };
  const linha = (p: Protocolo, detalhe: string) => (
    <li key={p.id}>
      <button type="button" className={estilos.linha} disabled={!disponivel(p)} onClick={() => abrir(p)}>
        <span className={estilos.linhaTexto}><b>{p.titulo}</b><small>{detalhe}</small></span>
        {selo(p)}
      </button>
    </li>
  );

  const achados = buscar(termo);
  const favoritados = favoritos.map((x) => PROTOCOLOS.find((p) => p.id === x)).filter((p): p is Protocolo => Boolean(p));

  return (
    <div className={`${estilos.modulo} ${estilos.casca} ${protocolo ? estilos.comProtocolo : ""}`}>
      <header className={`${estilos.cabeca} ${estilos.naoImprimir}`}>
        <h2>{titulo}</h2>
        <p>Reconhecer, agir agora e as doses para este paciente. Auxílio cognitivo: não substitui o julgamento médico.</p>
      </header>

      <div className={estilos.grade}>
        <aside className={`${estilos.lateral} ${estilos.naoImprimir}`} aria-label="Busca, paciente e índice">
          <label className={estilos.busca}>
            <Icone nome="busca" tamanho={20} />
            <input ref={busca} type="search" value={termo}
              onChange={(e) => { setTermo(e.target.value); if (e.target.value.trim()) setAberto(null); }}
              placeholder="Anafilaxia, estridor, PA caindo…" aria-label="Buscar intercorrência por nome, sinal ou sinônimo"
              autoComplete="off" spellCheck={false} enterKeyHint="search" />
          </label>

          <CamposDoPaciente dados={dados} set={set} daFicha={daFicha} compacto={daFicha} />

          <nav className={estilos.indice} aria-label="Índice">
            {favoritados.length > 0 && (
              <>
                <h3 className={estilos.indiceTitulo}>Favoritos</h3>
                <ul className={estilos.indiceLista}>
                  {favoritados.map((p) => (
                    <li key={p.id}>
                      <button type="button" className={`${estilos.indiceItem} ${estilos.indiceFavorito}`} disabled={!disponivel(p)}
                        aria-current={p.id === protocolo?.id ? "page" : undefined} onClick={() => abrir(p)}>
                        <Icone nome="estrela" tamanho={15} /><span className={estilos.indiceNome}>{p.titulo}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className={estilos.indiceTitulo}>Categorias</h3>
            <ul className={estilos.indiceLista}>
              {CATEGORIAS.map((c) => {
                const { prontos } = itensDaCategoria(c.id);
                const ativa = protocolo?.categoria === c.id;
                return (
                  <li key={c.id}>
                    <button type="button" className={estilos.indiceItem} aria-current={ativa ? "true" : undefined} onClick={() => irPara(c.id)}>
                      <span className={estilos.indiceLetra} aria-hidden="true">{c.letra}</span>
                      <span className={estilos.indiceNome}>{c.nome}</span>
                      <span className={estilos.indiceConta} aria-label={`${prontos.length} protocolos`}>{prontos.length}</span>
                    </button>
                    {ativa && (
                      <ul className={estilos.indiceSubs}>
                        {prontos.map((p) => (
                          <li key={p.id}>
                            <button type="button" className={estilos.indiceSub} disabled={!disponivel(p)}
                              aria-current={p.id === protocolo.id ? "page" : undefined} onClick={() => abrir(p)}>
                              {p.titulo}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className={estilos.principal}>
          {protocolo ? (
            <ProtocoloTela key={protocolo.id}
              doCodigo={protocolo} estado={estados[protocolo.id]} equipe={equipe} superAdmin={superAdmin} dados={dados} set={set} daFicha={daFicha}
              favorito={favoritos.includes(protocolo.id)} aoFavoritar={() => alternarFavorito(protocolo.id)}
              aoVoltar={() => irPara(protocolo.categoria)} aoBuscar={buscarOutra}
              aoAbrirCalculadora={aoAbrirCalculadora} revisoes={revisoes}
              aoAbrirProtocolo={(x) => { const alvo = PROTOCOLOS.find((p) => p.id === x); if (alvo) abrir(alvo); }}
            />
          ) : termo.trim() ? (
            <section className={estilos.folha} aria-live="polite" aria-labelledby={`${id}-achados`}>
              <h3 id={`${id}-achados`} className={estilos.folhaTitulo}>
                {achados.length === 0 ? "Nada encontrado" : `${achados.length} resultado${achados.length === 1 ? "" : "s"} para “${termo.trim()}”`}
              </h3>
              {achados.length === 0 ? (
                <p className={estilos.vazio}>Tente o sinal que você está vendo, como “hipotensão”, “estridor” ou “EtCO2 caindo”.</p>
              ) : (
                <ul className={estilos.linhas}>
                  {achados.map((a) => a.tipo === "protocolo"
                    ? linha(a.protocolo, `${CATEGORIAS.find((c) => c.id === a.protocolo.categoria)!.nome} · achado por ${a.porque}`)
                    : (
                      <li key={a.previsto.titulo}>
                        <button type="button" className={estilos.linha} disabled>
                          <span className={estilos.linhaTexto}>
                            <b>{a.previsto.titulo}</b>
                            <small>{CATEGORIAS.find((c) => c.id === a.previsto.categoria)!.nome}</small>
                          </span>
                          <span className={`${estilos.selo} ${estilos.selo_preparo}`}>Em preparação</span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </section>
          ) : (
            <div className={estilos.folha}>
              {CATEGORIAS.map((c) => {
                const { prontos, previstos } = itensDaCategoria(c.id);
                return (
                  <section key={c.id} id={`${id}-${c.id}`} className={estilos.grupo} aria-labelledby={`${id}-${c.id}-t`}>
                    <h3 id={`${id}-${c.id}-t`} className={estilos.grupoTitulo}>
                      <span className={estilos.indiceLetra} aria-hidden="true">{c.letra}</span>
                      {c.nome}
                      <small>{prontos.length} protocolo{prontos.length === 1 ? "" : "s"}</small>
                    </h3>
                    {prontos.length > 0 && <ul className={estilos.linhas}>{prontos.map((p) => linha(p, p.resumo))}</ul>}
                    {previstos.length > 0 && (
                      <p className={estilos.emPreparo}><b>Em preparação:</b> {previstos.map((p) => p.titulo).join(" · ")}</p>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {!protocolo && revisoes.papel?.admin && !revisoes.semBanco && <EquipeCientifica />}
        </div>
      </div>

      <div className={`${estilos.rodapes} ${estilos.naoImprimir}`}>
        {revisoes.fonte === "copia" && !equipe && (
          <p className={estilos.rodape}>Sem conexão: usando as versões aprovadas salvas neste aparelho.</p>
        )}
        <p className={estilos.rodape}>
          Os protocolos seguem diretrizes publicadas, citadas em cada um, e só valem como conteúdo clínico depois da aprovação de um revisor médico.
        </p>
      </div>
    </div>
  );
}
