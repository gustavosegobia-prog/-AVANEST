"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CabecalhoDeSecao } from "@/components/admin-ui";
import {
  GRUPOS_DE_ACAO, autorDoEvento, diferencas, rotuloDaAcao, sobreOEvento, type EventoDeAuditoria,
} from "@/lib/auditoria";

// O histórico de atividades, feito para investigar.
//
// A tela antiga mostrava "100 eventos recentes" em destaque — cem era o
// limite da consulta, não o tamanho do histórico. Aqui a consulta é
// filtrada no BANCO (período, autor, pessoa ou registro, local, tipo) e
// paginada; o topo diz quantos eventos o filtro encontrou e quantos estão
// carregados na tela, e onde o histórico começa. Nada anterior ao primeiro
// evento gravado é inventado.

const POR_PAGINA = 25;
const PERIODOS = [["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"], ["tudo", "Todo o histórico"]] as const;

type Local = { id: string; nome: string; nome_fantasia: string | null };

export function HistoricoDeAtividades({
  pessoas, nomes, filtroInicial, onAbrirPessoa, onAbrirLocais,
}: {
  pessoas: { id: string; nome: string }[];
  nomes: Map<string, string>;
  filtroInicial?: { afetado?: string };
  onAbrirPessoa: (id: string) => void;
  onAbrirLocais: () => void;
}) {
  const [periodo, setPeriodo] = useState<string>("30");
  const [autor, setAutor] = useState("");
  const [afetado, setAfetado] = useState(filtroInicial?.afetado ?? "");
  const [local, setLocal] = useState("");
  const [grupo, setGrupo] = useState("");
  const [eventos, setEventos] = useState<EventoDeAuditoria[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [pagina, setPagina] = useState(0);
  const [erro, setErro] = useState("");
  const [locais, setLocais] = useState<Local[]>([]);
  const [aberto, setAberto] = useState("");
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    const supabase = createClient();
    void supabase.from("locais_atendimento").select("id,nome,nome_fantasia").order("nome")
      .then(({ data }) => { if (vivo) setLocais((data ?? []) as Local[]); });
    // Onde o histórico começa: o evento mais antigo que existe.
    void supabase.from("auditoria").select("created_at").order("created_at", { ascending: true }).limit(1)
      .then(({ data }) => { if (vivo) setInicio(data?.[0]?.created_at ?? null); });
    return () => { vivo = false; };
  }, []);

  // Filtro novo recomeça da primeira página.
  const chave = JSON.stringify([periodo, autor, afetado, local, grupo]);
  const [chaveAnterior, setChaveAnterior] = useState(chave);
  if (chave !== chaveAnterior) { setChaveAnterior(chave); setPagina(0); setEventos([]); }

  // Carregando é derivado: a consulta pedida ainda não é a última que voltou.
  // Assim o efeito só grava estado quando o banco responde.
  const pedido = `${chave}|${pagina}|${tentativa}`;
  const [respondido, setRespondido] = useState("");
  const carregando = respondido !== pedido;
  useEffect(() => {
    let vivo = true;
    let consulta = createClient().from("auditoria")
      .select("id,actor_id,entidade,entidade_id,acao,detalhes,dados_anteriores,dados_novos,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
    if (periodo !== "tudo") consulta = consulta.gte("created_at", new Date(Date.now() - Number(periodo) * 86_400_000).toISOString());
    if (autor) consulta = consulta.eq("actor_id", autor);
    if (afetado) consulta = consulta.eq("entidade", "perfil").eq("entidade_id", afetado);
    if (local) consulta = consulta.eq("entidade", "local_atendimento").eq("entidade_id", local);
    const g = GRUPOS_DE_ACAO.find((x) => x.id === grupo);
    if (g) consulta = consulta.in("entidade", g.entidades);
    const esta = `${JSON.stringify([periodo, autor, afetado, local, grupo])}|${pagina}|${tentativa}`;
    void consulta.then(({ data, error, count }) => {
      if (!vivo) return;
      setRespondido(esta);
      if (error) { setErro("Não foi possível carregar o histórico. Confira a conexão e tente de novo."); return; }
      setErro("");
      setTotal(count ?? null);
      setEventos((atual) => pagina === 0 ? (data ?? []) as EventoDeAuditoria[] : [...atual, ...((data ?? []) as EventoDeAuditoria[])]);
    });
    return () => { vivo = false; };
  }, [periodo, autor, afetado, local, grupo, pagina, tentativa]);

  const filtrado = periodo !== "30" || autor || afetado || local || grupo;
  const limpar = () => { setPeriodo("30"); setAutor(""); setAfetado(""); setLocal(""); setGrupo(""); };
  const nomeDoLocal = (id: string | null) => {
    const l = locais.find((x) => x.id === id);
    return l ? (l.nome_fantasia || l.nome) : null;
  };

  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Histórico de atividades" escopo="organizacao"
        descricao="O que foi feito, por quem e quando. Use os filtros para investigar uma pessoa, um local ou um tipo de ação." />

      <div className="admFiltros" role="search" aria-label="Filtros do histórico">
        <label><span>Período</span><select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
          {PERIODOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
        <label><span>Autor</span><select value={autor} onChange={(e) => setAutor(e.target.value)}>
          <option value="">Qualquer pessoa</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <label><span>Pessoa afetada</span><select value={afetado} onChange={(e) => { setAfetado(e.target.value); if (e.target.value) setLocal(""); }}>
          <option value="">Qualquer</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
        <label><span>Local</span><select value={local} onChange={(e) => { setLocal(e.target.value); if (e.target.value) setAfetado(""); }}>
          <option value="">Qualquer</option>
          {locais.map((l) => <option key={l.id} value={l.id}>{l.nome_fantasia || l.nome}</option>)}</select></label>
        <label><span>Tipo de ação</span><select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          <option value="">Todos</option>
          {GRUPOS_DE_ACAO.map((g) => <option key={g.id} value={g.id}>{g.rotulo}</option>)}</select></label>
        {filtrado && <button type="button" className="admLinkBotao" onClick={limpar}>Limpar filtros</button>}
      </div>

      <p className="admContador" aria-live="polite">
        {total === null ? "Contando eventos…"
          : `${total} ${total === 1 ? "evento encontrado" : "eventos encontrados"} com estes filtros · ${eventos.length} carregado${eventos.length === 1 ? "" : "s"} na tela`}
        {inicio && ` · o histórico começa em ${new Date(inicio).toLocaleDateString("pt-BR")}`}
      </p>
      {(afetado || local) && <p className="admNota">Filtrar por pessoa ou local mostra os eventos registrados sobre esse cadastro. Outras ações que envolvem o local (como plantões) aparecem em “Escala e plantões”.</p>}

      {erro && <p className="clinicalError" role="alert">{erro} <button type="button" className="admLinkBotao" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button></p>}

      {!erro && eventos.length === 0 && !carregando
        ? <div className="emptyClinical"><strong>Nenhum evento com estes filtros.</strong>{filtrado ? <button type="button" className="admLinkBotao" onClick={limpar}>Limpar filtros</button> : "Ações administrativas aparecem aqui assim que acontecem."}</div>
        : <ol className="admEventos">
            {eventos.map((e) => {
              const mudancas = diferencas(e);
              const expandido = aberto === e.id;
              const pessoa = e.entidade === "perfil" && e.entidade_id && nomes.has(e.entidade_id) ? e.entidade_id : null;
              const ehLocal = e.entidade === "local_atendimento";
              return <li key={e.id}>
                <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>
                <span className="admEventoTexto">
                  <strong>{rotuloDaAcao(e)}</strong>
                  <small>{(ehLocal && nomeDoLocal(e.entidade_id)) || sobreOEvento(e, nomes)} · por {autorDoEvento(e, nomes)}</small>
                  {expandido && mudancas.length > 0 && <ul className="admDiferencas">
                    {mudancas.map((m) => <li key={m.campo}><b>{m.campo}:</b> {m.de} <span aria-hidden="true">→</span><span className="visuallyHidden">para</span> {m.para}</li>)}
                  </ul>}
                  {expandido && mudancas.length === 0 && <small className="admTextoFraco">Este evento não guardou os valores anteriores.</small>}
                </span>
                <span className="admEventoAcoes">
                  <button type="button" className="admLinkBotao" aria-expanded={expandido} onClick={() => setAberto(expandido ? "" : e.id)}>
                    {expandido ? "Ocultar detalhes" : "Detalhes"}</button>
                  {pessoa && <button type="button" className="admLinkBotao" onClick={() => onAbrirPessoa(pessoa)}>Abrir cadastro</button>}
                  {ehLocal && e.acao !== "delete" && <button type="button" className="admLinkBotao" onClick={onAbrirLocais}>Abrir locais</button>}
                </span>
              </li>;
            })}
          </ol>}

      {carregando && <p className="admNota" aria-live="polite">Carregando…</p>}
      {!carregando && total !== null && eventos.length < total &&
        <button type="button" className="outlineClinical admCarregarMais" onClick={() => setPagina((p) => p + 1)}>
          Carregar mais {Math.min(POR_PAGINA, total - eventos.length)} de {total - eventos.length} restantes</button>}
    </section>
  );
}
