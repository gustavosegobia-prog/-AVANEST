"use client";

import { useMemo, useState } from "react";
import estilos from "./intercorrencias.module.css";
import { buscar, CATEGORIAS, itensDaCategoria, PROTOCOLOS } from "@/lib/intercorrencias/catalogo";
import { resolverEstado, ROTULO_SITUACAO, type Estado } from "@/lib/intercorrencias/situacao";
import type { Categoria, Protocolo } from "@/lib/intercorrencias/tipos";
import { COR_DA_CATEGORIA, CamposDoPaciente, type DadosDoPaciente } from "./paciente";
import { ProtocoloTela } from "./protocolo";
import { EquipeCientifica } from "./revisao";
import { useRevisoes } from "./use-revisoes";

/**
 * INTERCORRÊNCIAS ANESTÉSICAS — a consulta da crise.
 *
 * A busca fica sempre no topo e acha pelo nome, pelo sinônimo ou pelo que se
 * vê no monitor ("estridor", "PA caindo"). Embaixo, as seis categorias. Um
 * toque abre o protocolo com "Agir agora" logo depois do título.
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
  const [aberto, setAberto] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [focarBusca, setFocarBusca] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [favoritos, setFavoritos] = useState<string[]>(lerFavoritos);

  const equipe = superAdmin || Boolean(revisoes.papel && (revisoes.papel.papel || revisoes.papel.admin));
  const estados = useMemo(
    () => Object.fromEntries(PROTOCOLOS.map((p) => [p.id, resolverEstado(p, revisoes.registros)])) as Record<string, Estado>,
    [revisoes.registros],
  );
  const disponivel = (p: Protocolo) => equipe || Boolean(estados[p.id].emUso);

  const alternarFavorito = (id: string) => setFavoritos((v) => {
    const novo = v.includes(id) ? v.filter((x) => x !== id) : [...v, id];
    try { window.localStorage.setItem(FAVORITOS, JSON.stringify(novo)); } catch { /* sem storage */ }
    return novo;
  });

  const protocolo = aberto ? PROTOCOLOS.find((p) => p.id === aberto) : undefined;
  if (protocolo && disponivel(protocolo)) {
    return (
      <ProtocoloTela
        doCodigo={protocolo} estado={estados[protocolo.id]} equipe={equipe} superAdmin={superAdmin} dados={dados} set={set} daFicha={daFicha}
        favorito={favoritos.includes(protocolo.id)} aoFavoritar={() => alternarFavorito(protocolo.id)}
        aoVoltar={() => { setAberto(null); setCategorias((c) => (c.includes(protocolo.categoria) ? c : [...c, protocolo.categoria])); }}
        aoBuscar={() => { setAberto(null); setTermo(""); setFocarBusca(true); }}
        aoAbrirCalculadora={aoAbrirCalculadora} revisoes={revisoes}
        aoAbrirProtocolo={(id) => { const alvo = PROTOCOLOS.find((p) => p.id === id); if (alvo && disponivel(alvo)) setAberto(id); }}
      />
    );
  }

  /** A etiqueta do item: a situação para a equipe; para o médico, só "em revisão" quando ainda não pode abrir. */
  const selo = (p: Protocolo) => {
    const e = estados[p.id];
    const s = equipe ? e.daVersaoAtual : e.emUso ? (e.precisaAtualizar ? "necessita_atualizacao" : "aprovado") : null;
    return s
      ? <span className={`${estilos.selo} ${estilos[`selo_${s}`]}`}>{ROTULO_SITUACAO[s]}</span>
      : <span className={`${estilos.selo} ${estilos.selo_preparo}`}>Em revisão</span>;
  };
  const abrir = (p: Protocolo) => { if (disponivel(p)) setAberto(p.id); };

  const achados = buscar(termo);
  const favoritados = favoritos.map((id) => PROTOCOLOS.find((p) => p.id === id)).filter((p): p is Protocolo => Boolean(p));

  return (
    <div className={estilos.modulo}>
      <header className={estilos.cabeca}>
        <h2>{titulo}</h2>
        <p>Reconhecer, agir agora e as doses para este paciente. Auxílio cognitivo: não substitui o julgamento médico.</p>
      </header>

      <label className={estilos.busca}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" value={termo} onChange={(e) => setTermo(e.target.value)} autoFocus={focarBusca}
          placeholder="Buscar: anafilaxia, estridor, PA caindo…" aria-label="Buscar intercorrência por nome, sinal ou sinônimo"
          autoComplete="off" spellCheck={false} enterKeyHint="search" />
      </label>

      <CamposDoPaciente dados={dados} set={set} daFicha={daFicha} compacto={daFicha} />

      {termo.trim() ? (
        <section className={estilos.resultados} aria-live="polite" aria-label="Resultados da busca">
          {achados.length === 0 && <p className={estilos.vazio}>Nada com “{termo.trim()}”. Tente o sinal que você está vendo, como “hipotensão”.</p>}
          {achados.map((a) => a.tipo === "protocolo" ? (
            <button key={a.protocolo.id} type="button" className={estilos.resultado} disabled={!disponivel(a.protocolo)}
              style={{ ["--cat" as string]: COR_DA_CATEGORIA[a.protocolo.categoria] }} onClick={() => abrir(a.protocolo)}>
              <span className={estilos.itemTexto}>
                <b>{a.protocolo.titulo}</b>
                <small>{CATEGORIAS.find((c) => c.id === a.protocolo.categoria)!.nome} · achado por {a.porque}</small>
              </span>
              {selo(a.protocolo)}
            </button>
          ) : (
            <button key={a.previsto.titulo} type="button" className={estilos.resultado} disabled
              style={{ ["--cat" as string]: COR_DA_CATEGORIA[a.previsto.categoria] }}>
              <span className={estilos.itemTexto}>
                <b>{a.previsto.titulo}</b>
                <small>{CATEGORIAS.find((c) => c.id === a.previsto.categoria)!.nome}</small>
              </span>
              <span className={`${estilos.selo} ${estilos.selo_preparo}`}>Em preparação</span>
            </button>
          ))}
        </section>
      ) : (
        <>
          {favoritados.length > 0 && (
            <section aria-label="Favoritos" className={estilos.favoritos}>
              {favoritados.map((p) => (
                <button key={p.id} type="button" className={estilos.chip} disabled={!disponivel(p)} onClick={() => abrir(p)}>★ {p.titulo}</button>
              ))}
            </section>
          )}

          <div className={estilos.categorias}>
            {CATEGORIAS.map((c) => {
              const { prontos, previstos } = itensDaCategoria(c.id);
              const aberta = categorias.includes(c.id);
              return (
                <section key={c.id} className={estilos.categoria} style={{ ["--cat" as string]: COR_DA_CATEGORIA[c.id] }}>
                  <button type="button" className={estilos.categoriaTopo} aria-expanded={aberta}
                    onClick={() => setCategorias((v) => (v.includes(c.id) ? v.filter((x) => x !== c.id) : [...v, c.id]))}>
                    <span className={estilos.letra} aria-hidden="true">{c.letra}</span>
                    <span>
                      <strong>{c.nome}</strong>
                      <small>{prontos.length} pronto{prontos.length === 1 ? "" : "s"} · {previstos.length} em preparação</small>
                    </span>
                    <span className={estilos.seta} aria-hidden="true">{aberta ? "▲" : "▼"}</span>
                  </button>
                  {aberta && (
                    <ul className={estilos.itens}>
                      {prontos.map((p) => (
                        <li key={p.id}>
                          <button type="button" className={estilos.item} disabled={!disponivel(p)} onClick={() => abrir(p)}>
                            <span className={estilos.itemTexto}><b>{p.titulo}</b><small>{p.resumo}</small></span>
                            {selo(p)}
                          </button>
                        </li>
                      ))}
                      {previstos.map((p) => (
                        <li key={p.titulo}>
                          <button type="button" className={estilos.item} disabled>
                            <span className={estilos.itemTexto}><b>{p.titulo}</b></span>
                            <span className={`${estilos.selo} ${estilos.selo_preparo}`}>Em preparação</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {revisoes.fonte === "copia" && !equipe && (
        <p className={estilos.rodape}>Sem conexão: usando as versões aprovadas salvas neste aparelho.</p>
      )}
      {revisoes.papel?.admin && !revisoes.semBanco && <EquipeCientifica />}
      <p className={estilos.rodape}>
        Os protocolos seguem diretrizes publicadas, citadas em cada um, e só valem como conteúdo clínico depois da aprovação de um revisor médico.
      </p>
    </div>
  );
}
