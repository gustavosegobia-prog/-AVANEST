"use client";

import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import estilos from "./intercorrencias.module.css";
import { buscar, CATEGORIAS, itensDaCategoria, PROTOCOLOS } from "@/lib/intercorrencias/catalogo";
import { APROVACAO } from "@/lib/intercorrencias/aprovacao";
import type { Categoria, Protocolo } from "@/lib/intercorrencias/tipos";
import { Icone } from "@/components/icone";
import { CamposDoPaciente, type DadosDoPaciente } from "./paciente";
import { ProtocoloTela } from "./protocolo";

/**
 * INTERCORRÊNCIAS ANESTÉSICAS — a consulta da crise.
 *
 * Os dados do paciente numa faixa no alto. No computador, embaixo dela, duas
 * colunas: à esquerda, fixas ao rolar, a busca e as categorias (as abas do
 * manual), que se abrem ali mesmo mostrando os protocolos; à direita, só o
 * protocolo escolhido (ou os resultados da busca). A tela muda quando se
 * escolhe o protocolo, não quando se abre a categoria. No celular, uma coluna só, e o protocolo aberto ocupa
 * a tela inteira. A busca acha pelo nome, pelo
 * sinônimo ou pelo que se vê no monitor ("estridor", "PA caindo").
 *
 * Todo protocolo pronto abre para quem usa: o conteúdo é o do código, com a
 * versão, a data e as referências de cada um. Consultar não registra nada no
 * prontuário.
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
  dados, set, aoAbrirCalculadora, daFicha = false, titulo = "Intercorrências anestésicas",
}: {
  /** "Manejo de crises em anestesia" no menu da área médica. */
  titulo?: string;
  dados: DadosDoPaciente;
  set: (c: string, v: string) => void;
  aoAbrirCalculadora?: () => void;
  /** Aberto de dentro da ficha: os dados vieram do atendimento. */
  daFicha?: boolean;
}) {
  const id = useId();
  const busca = useRef<HTMLInputElement>(null);
  const grade = useRef<HTMLDivElement>(null);
  /** A categoria aberta na coluna da esquerda: abrir uma não muda a tela, só mostra os protocolos dela. */
  const [expandida, setExpandida] = useState<Categoria | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);

  const abrir = (p: Protocolo) => {
    // Aberto pela busca ou por "Abrir também": a coluna passa a mostrar a categoria dele.
    if (!expandida || !itensDaCategoria(expandida).prontos.includes(p)) setExpandida(p.categoria);
    setTermo("");
    setAberto(p.id);
  };

  const alternarFavorito = (x: string) => setFavoritos((v) => {
    const novo = v.includes(x) ? v.filter((y) => y !== x) : [...v, x];
    try { window.localStorage.setItem(FAVORITOS, JSON.stringify(novo)); } catch { /* sem storage */ }
    return novo;
  });

  /** Fecha o protocolo; a categoria dele continua aberta na coluna. */
  const fechar = () => {
    flushSync(() => { setAberto(null); setTermo(""); });
    if ((grade.current?.getBoundingClientRect().top ?? 0) < 0) grade.current?.scrollIntoView({ block: "start" });
  };
  const buscarOutra = () => {
    flushSync(() => { setAberto(null); setTermo(""); });
    busca.current?.focus();
  };

  const protocolo = aberto ? PROTOCOLOS.find((p) => p.id === aberto) : undefined;
  const buscando = !protocolo && Boolean(termo.trim());

  const achados = buscar(termo);
  const favoritados = favoritos.map((x) => PROTOCOLOS.find((p) => p.id === x)).filter((p): p is Protocolo => Boolean(p));

  return (
    <div className={`${estilos.modulo} ${estilos.casca} ${protocolo ? estilos.comProtocolo : ""} ${buscando ? estilos.buscando : ""}`}>
      <header className={`${estilos.cabeca} ${estilos.naoImprimir}`}>
        <h2>{titulo}</h2>
        <p>Reconhecer, agir agora e as doses para este paciente. Auxílio cognitivo: não substitui o julgamento médico.</p>
      </header>

      <div className={`${estilos.barraPaciente} ${estilos.naoImprimir}`}>
        <CamposDoPaciente dados={dados} set={set} daFicha={daFicha} compacto={daFicha} />
      </div>

      <div ref={grade} className={estilos.grade}>
        <aside className={`${estilos.lateral} ${estilos.naoImprimir}`} aria-label="Busca e protocolos">
          <label className={estilos.busca}>
            <Icone nome="busca" tamanho={20} />
            <input ref={busca} type="search" value={termo}
              onChange={(e) => { setTermo(e.target.value); if (e.target.value.trim()) setAberto(null); }}
              placeholder="Buscar protocolo ou sinal" aria-label="Buscar intercorrência por nome, sinal ou sinônimo"
              autoComplete="off" spellCheck={false} enterKeyHint="search" />
          </label>

          <nav className={estilos.indice} aria-label="Protocolos por categoria">
            {favoritados.length > 0 && (
              <>
                <h3 className={estilos.indiceTitulo}>Favoritos</h3>
                <ul className={estilos.indiceLista}>
                  {favoritados.map((p) => (
                    <li key={p.id}>
                      <button type="button" className={`${estilos.indiceItem} ${estilos.indiceFavorito}`}
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
                const { prontos, previstos } = itensDaCategoria(c.id);
                const aberta = expandida === c.id;
                return (
                  <li key={c.id}>
                    <button type="button" className={estilos.indiceItem} aria-expanded={aberta} aria-controls={`${id}-${c.id}`}
                      onClick={() => setExpandida((v) => (v === c.id ? null : c.id))}>
                      <span className={estilos.indiceNome}>{c.nome}</span>
                      <Icone nome="seta" tamanho={16} className={estilos.indiceSeta} />
                    </button>
                    {aberta && (
                      <ul id={`${id}-${c.id}`} className={estilos.indiceSubs}>
                        {prontos.map((p) => (
                          <li key={p.id}>
                            <button type="button" className={estilos.indiceSub}
                              aria-current={p.id === protocolo?.id ? "page" : undefined} onClick={() => abrir(p)}>
                              {p.titulo}
                            </button>
                          </li>
                        ))}
                        {previstos.map((p) => (
                          <li key={p.titulo}>
                            <button type="button" className={estilos.indiceSub} disabled>
                              {p.titulo}<small>em preparação</small>
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
              p={protocolo} dados={dados} set={set} daFicha={daFicha}
              favorito={favoritos.includes(protocolo.id)} aoFavoritar={() => alternarFavorito(protocolo.id)}
              aoVoltar={fechar} aoBuscar={buscarOutra}
              aoAbrirCalculadora={aoAbrirCalculadora}
              aoAbrirProtocolo={(x) => { const alvo = PROTOCOLOS.find((p) => p.id === x); if (alvo) abrir(alvo); }}
            />
          ) : buscando ? (
            <section className={estilos.folha} aria-live="polite" aria-labelledby={`${id}-achados`}>
              <h3 id={`${id}-achados`} className={estilos.folhaTitulo}>
                {achados.length === 0 ? "Nada encontrado" : `${achados.length} resultado${achados.length === 1 ? "" : "s"} para “${termo.trim()}”`}
              </h3>
              {achados.length === 0 ? (
                <p className={estilos.vazio}>Tente o sinal que você está vendo, como “hipotensão”, “estridor” ou “EtCO2 caindo”.</p>
              ) : (
                <ul className={estilos.linhas}>
                  {achados.map((a) => {
                    const nome = (c: Categoria) => CATEGORIAS.find((x) => x.id === c)!.nome;
                    return a.tipo === "protocolo" ? (
                      <li key={a.protocolo.id}>
                        <button type="button" className={estilos.linha} onClick={() => abrir(a.protocolo)}>
                          <span className={estilos.linhaTexto}>
                            <b>{a.protocolo.titulo}</b><small>{nome(a.protocolo.categoria)} · achado por {a.porque}</small>
                          </span>
                          <Icone nome="seta" tamanho={18} className={estilos.linhaSeta} />
                        </button>
                      </li>
                    ) : (
                      <li key={a.previsto.titulo}>
                        <button type="button" className={estilos.linha} disabled>
                          <span className={estilos.linhaTexto}><b>{a.previsto.titulo}</b><small>{nome(a.previsto.categoria)}</small></span>
                          <span className={`${estilos.selo} ${estilos.selo_preparo}`}>Em preparação</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}
        </div>
      </div>

      <div className={`${estilos.rodapes} ${estilos.naoImprimir}`}>
        <p className={estilos.rodape}>
          Os protocolos seguem diretrizes publicadas, citadas no fim de cada um. Versão {APROVACAO.versao} aprovada por {APROVACAO.responsavel}, {APROVACAO.crm}, em {APROVACAO.data.split("-").reverse().join("/")}. Confira apresentação, via e dose antes de administrar.
        </p>
      </div>
    </div>
  );
}
