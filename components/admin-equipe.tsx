"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { CabecalhoDeSecao, Dialogo } from "@/components/admin-ui";
import {
  NOME_DA_AREA_EXTRA, ROTULO_DO_ACESSO, concessoesLegadas, estadoDoAcesso,
  estadoDoConvite, formatarCRM, indicadores, profissao, rotuloDaFuncao,
  type ConviteDeLink, type EstadoDoAcesso, type Login, type Pessoa,
} from "@/lib/equipe";
import { linkDoConvite, mensagemDoConvite } from "@/lib/convite-mensagem";

// Equipe e acessos: a lista das pessoas e os convites pendentes.
//
// A lista tem SEIS colunas e cada uma responde uma pergunta — nome,
// profissão, função, acesso, locais e o que fazer. O que era uma fileira de
// etiquetas misturadas ("Anestesiologista · + Financeiro · Escalista · Sem
// acesso · Ativo") virou colunas separadas.

export type ConviteCompleto = ConviteDeLink & { token: string };

/** Login de cada pessoa e convites por link — lidos uma vez para a Administração toda. */
export function useDadosDaEquipe(ativo: boolean) {
  const [logins, setLogins] = useState<Map<string, Login> | null>(null);
  const [erroLogins, setErroLogins] = useState(false);
  const [convites, setConvites] = useState<ConviteCompleto[]>([]);
  const [erroConvites, setErroConvites] = useState(false);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    const supabase = createClient();
    void supabase.rpc("situacao_de_acesso_da_equipe").then(({ data, error }) => {
      if (!vivo) return;
      setErroLogins(Boolean(error));
      setLogins(error ? null : new Map(((data ?? []) as (Login & { perfil_id: string })[]).map((l) => [l.perfil_id, l])));
    });
    void supabase.from("convites").select("id,email,role,token,status,expires_at,created_at")
      .order("created_at", { ascending: false }).limit(200)
      .then(({ data, error }) => {
        if (!vivo) return;
        setErroConvites(Boolean(error));
        setConvites((data ?? []) as ConviteCompleto[]);
      });
    return () => { vivo = false; };
  }, [ativo, versao]);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { logins, erroLogins, convites, erroConvites, recarregar };
}

export type Filtros = {
  busca: string;
  funcao: string;
  acesso: "todos" | EstadoDoAcesso | "desativado_ou_pausado";
  profissao: "todas" | "medico" | "nao_medico" | "nao_informada";
  revisar: boolean;
};
export const FILTROS_LIMPOS: Filtros = { busca: "", funcao: "todas", acesso: "todos", profissao: "todas", revisar: false };

/** "Acesso elevado": quem administra, tem área extra ou concessão antiga. */
const acessoElevado = (p: Pessoa) =>
  p.role === "admin" || p.role === "owner" || (p.permissoes ?? []).some((x) => x !== p.role);

export function EquipeEAcessos({
  pessoas, logins, erroLogins, convites, erroConvites, podeAdministrar, organizacaoNome,
  filtros, onFiltros, subAba, onSubAba, onAbrirPessoa, onAdicionar, onRecarregar, onRefresh, mensagem,
  resumoEscala,
}: {
  pessoas: Pessoa[];
  logins: Map<string, Login> | null;
  erroLogins: boolean;
  convites: ConviteCompleto[];
  erroConvites: boolean;
  podeAdministrar: boolean;
  organizacaoNome: string | null;
  filtros: Filtros;
  onFiltros: (f: Filtros) => void;
  subAba: "pessoas" | "convites";
  onSubAba: (a: "pessoas" | "convites") => void;
  onAbrirPessoa: (id: string, aba?: "dados" | "acesso" | "historico") => void;
  onAdicionar: () => void;
  onRecarregar: () => void;
  onRefresh: () => void;
  mensagem: string;
  resumoEscala?: string;
}) {
  const agora = new Date().toISOString();
  const ind = indicadores(pessoas, logins, convites, agora);
  const pendentesPorEmail = pessoas.filter((p) => estadoDoAcesso(p, logins?.get(p.id)) === "convite_pendente");
  const linksAbertos = convites.filter((c) => ["pendente", "expirado"].includes(estadoDoConvite(c, agora)));

  const lista = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    const termoCRM = termo.replace(/\D/g, "");
    return pessoas.filter((p) => {
      const estado = estadoDoAcesso(p, logins?.get(p.id));
      if (filtros.funcao !== "todas" && p.role !== filtros.funcao) return false;
      if (filtros.acesso === "desativado_ou_pausado" ? !["desativado", "pausado"].includes(estado)
        : filtros.acesso !== "todos" && estado !== filtros.acesso) return false;
      if (filtros.profissao !== "todas" && profissao(p).tipo !== filtros.profissao) return false;
      if (filtros.revisar && !acessoElevado(p)) return false;
      if (!termo) return true;
      return `${p.nome} ${p.email ?? ""} ${p.crm ?? ""}`.toLowerCase().includes(termo)
        || (termoCRM.length >= 3 && (p.crm ?? "").replace(/\D/g, "").includes(termoCRM));
    });
  }, [pessoas, logins, filtros]);
  const filtrado = JSON.stringify(filtros) !== JSON.stringify(FILTROS_LIMPOS);

  return (
    <section className="admSecao">
      <CabecalhoDeSecao
        titulo="Equipe e acessos"
        descricao="Quem faz parte da equipe, o que cada pessoa pode fazer e quem entra no sistema."
        escopo="organizacao"
        acao={podeAdministrar && <button type="button" className="primaryClinical compact" onClick={onAdicionar}>+ Adicionar pessoa</button>}
      />
      {mensagem && <p className="financeSuccess" role="status">{mensagem}</p>}
      {resumoEscala && <p className="admNota"><Icone nome="calendario" tamanho={14} /> {resumoEscala}</p>}
      <p className="admResumoEquipe">
        <b>{ind.profissionais}</b> na equipe · <b>{ind.medicos}</b> médicos
        {ind.medicosQueAdministram > 0 && <> ({ind.medicosQueAdministram} também {ind.medicosQueAdministram === 1 ? "administra" : "administram"})</>}
        {" "}· <b>{ind.semConta}</b> sem conta · <b>{ind.acessoHabilitado}</b> com acesso habilitado
      </p>
      {erroLogins && <p className="pendingNotice">Não foi possível conferir quem já aceitou o convite. A lista mostra as contas ativas como “Acesso habilitado”. <button type="button" className="admLinkBotao" onClick={onRecarregar}>Tentar de novo</button></p>}

      <div className="admAbas" role="tablist" aria-label="Equipe e convites">
        <button type="button" role="tab" aria-selected={subAba === "pessoas"} className={subAba === "pessoas" ? "ativa" : ""} onClick={() => onSubAba("pessoas")}>
          Pessoas <b className="admContagem">{pessoas.length}</b></button>
        <button type="button" role="tab" aria-selected={subAba === "convites"} className={subAba === "convites" ? "ativa" : ""} onClick={() => onSubAba("convites")}>
          Convites pendentes <b className="admContagem">{pendentesPorEmail.length + linksAbertos.length}</b></button>
      </div>

      {subAba === "pessoas" && <>
        <div className="admFiltros" role="search">
          <label className="admBusca">
            <span className="visuallyHidden">Buscar por nome, e-mail ou CRM</span>
            <Icone nome="busca" tamanho={16} />
            <input type="search" value={filtros.busca} placeholder="Buscar por nome, e-mail ou CRM"
              onChange={(e) => onFiltros({ ...filtros, busca: e.target.value })} />
          </label>
          <label><span>Função</span>
            <select value={filtros.funcao} onChange={(e) => onFiltros({ ...filtros, funcao: e.target.value })}>
              <option value="todas">Todas</option>
              {["owner", "admin", "medico", "recepcao", "financeiro"].map((r) => <option key={r} value={r}>{rotuloDaFuncao(r)}</option>)}
            </select></label>
          <label><span>Acesso</span>
            <select value={filtros.acesso} onChange={(e) => onFiltros({ ...filtros, acesso: e.target.value as Filtros["acesso"] })}>
              <option value="todos">Todos</option>
              <option value="habilitado">Acesso habilitado</option>
              <option value="convite_pendente">Convite pendente</option>
              <option value="sem_conta">Sem conta</option>
              <option value="desativado_ou_pausado">Acesso desativado</option>
            </select></label>
          <label><span>Profissão</span>
            <select value={filtros.profissao} onChange={(e) => onFiltros({ ...filtros, profissao: e.target.value as Filtros["profissao"] })}>
              <option value="todas">Todas</option>
              <option value="medico">Médico(a)</option>
              <option value="nao_medico">Outra profissão</option>
              <option value="nao_informada">Não informada</option>
            </select></label>
          <label className="admFiltroMarca">
            <input type="checkbox" checked={filtros.revisar} onChange={(e) => onFiltros({ ...filtros, revisar: e.target.checked })} />
            <span>Só acesso elevado</span></label>
          {filtrado && <button type="button" className="admLinkBotao" onClick={() => onFiltros(FILTROS_LIMPOS)}>Limpar filtros</button>}
        </div>
        <p className="admContador" aria-live="polite">Mostrando {lista.length} de {pessoas.length}</p>

        {lista.length === 0 ? (
          <div className="emptyClinical">
            <strong>{pessoas.length ? "Ninguém combina com a busca ou os filtros." : "Ainda não há ninguém na equipe."}</strong>
            {pessoas.length
              ? <button type="button" className="admLinkBotao" onClick={() => onFiltros(FILTROS_LIMPOS)}>Limpar filtros e ver todos</button>
              : podeAdministrar && <>Comece por <button type="button" className="admLinkBotao" onClick={onAdicionar}>Adicionar pessoa</button>.</>}
          </div>
        ) : (
          <table className="admTabela">
            <thead><tr>
              <th scope="col">Nome</th><th scope="col">Profissão</th><th scope="col">Função</th>
              <th scope="col">Acesso</th><th scope="col">Locais</th><th scope="col"><span className="visuallyHidden">Ações</span></th>
            </tr></thead>
            <tbody>
              {lista.map((p) => {
                const estado = estadoDoAcesso(p, logins?.get(p.id));
                const prof = profissao(p);
                const extras = (p.permissoes ?? []).filter((x) => x !== p.role && NOME_DA_AREA_EXTRA[x]);
                const legado = concessoesLegadas(p);
                return <tr key={p.id}>
                  <td data-rotulo="Nome">
                    <span className="admPessoa">
                      <span className="avatar" aria-hidden="true">{p.nome.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase()}</span>
                      <span><strong>{p.nome}</strong>
                        <small>{p.sem_acesso ? "sem e-mail" : p.email || "sem e-mail"}{p.crm ? ` · ${formatarCRM(p.crm)}` : ""}</small></span>
                    </span>
                  </td>
                  <td data-rotulo="Profissão">
                    <span className={prof.tipo === "nao_informada" ? "admTextoFraco" : ""}>{prof.rotulo}</span>
                    {prof.tipo === "medico" && !(p.crm ?? "").trim() && p.status === "ativo" && <small className="admEtiqueta atencao">CRM pendente</small>}
                  </td>
                  <td data-rotulo="Função">
                    <span>{rotuloDaFuncao(p.role)}</span>
                    <span className="admEtiquetas">
                      {extras.map((a) => <small key={a} className="admEtiqueta">+ {NOME_DA_AREA_EXTRA[a]}</small>)}
                      {legado.length > 0 && <small className="admEtiqueta atencao" title={legado.map((c) => c.efeito).join(" ")}>concessão antiga</small>}
                      {p.escalista && <small className="admEtiqueta">monta a escala</small>}
                      {p.na_escala === false && !["recepcao", "financeiro"].includes(p.role) && <small className="admEtiqueta neutra">fora da escala</small>}
                    </span>
                  </td>
                  <td data-rotulo="Acesso">
                    <span className={`admAcesso ${estado}`}>{ROTULO_DO_ACESSO[estado]}</span>
                    {estado === "sem_conta" && <small className="admTextoFraco">na equipe, sem login</small>}
                  </td>
                  <td data-rotulo="Locais"><span className="admTextoFraco" title="O acesso vale em todos os locais compartilhados; não há restrição por local.">
                    {estado === "sem_conta" || estado === "desativado" || estado === "pausado" ? "—" : "Todos os compartilhados"}</span></td>
                  <td data-rotulo="Ações" className="admAcoesCelula">
                    <button type="button" className="outlineClinical" onClick={() => onAbrirPessoa(p.id)}
                      aria-label={`${podeAdministrar ? "Editar" : "Ver"} cadastro de ${p.nome}`}>{podeAdministrar ? "Editar" : "Ver"}</button>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        )}
      </>}

      {subAba === "convites" && <ConvitesPendentes
        pessoasPendentes={pendentesPorEmail} logins={logins} convites={convites} erroConvites={erroConvites}
        podeAdministrar={podeAdministrar} organizacaoNome={organizacaoNome}
        onAbrirPessoa={onAbrirPessoa} onRecarregar={onRecarregar} onRefresh={onRefresh} onAdicionar={onAdicionar} />}
    </section>
  );
}

// ── Convites ──────────────────────────────────────────────────────────────

const ROTULO_DO_CONVITE = { pendente: "Pendente", expirado: "Expirado", aceito: "Aceito", cancelado: "Cancelado" } as const;
const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

function ConvitesPendentes({
  pessoasPendentes, logins, convites, erroConvites, podeAdministrar, organizacaoNome,
  onAbrirPessoa, onRecarregar, onRefresh, onAdicionar,
}: {
  pessoasPendentes: Pessoa[];
  logins: Map<string, Login> | null;
  convites: ConviteCompleto[];
  erroConvites: boolean;
  podeAdministrar: boolean;
  organizacaoNome: string | null;
  onAbrirPessoa: (id: string, aba?: "dados" | "acesso" | "historico") => void;
  onRecarregar: () => void;
  onRefresh: () => void;
  onAdicionar: () => void;
}) {
  const agora = new Date().toISOString();
  const [ocupado, setOcupado] = useState("");
  const [retorno, setRetorno] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [copiado, setCopiado] = useState("");
  const [cancelando, setCancelando] = useState<{ tipo: "link"; convite: ConviteCompleto } | { tipo: "email"; pessoa: Pessoa } | null>(null);
  const [erroCancelar, setErroCancelar] = useState("");
  const abertos = convites.filter((c) => ["pendente", "expirado"].includes(estadoDoConvite(c, agora)));
  const recentes = convites.filter((c) => ["aceito", "cancelado"].includes(estadoDoConvite(c, agora))).slice(0, 20);

  async function reenviar(p: Pessoa) {
    setOcupado(p.id); setRetorno(null);
    const resposta = await fetch("/api/admin/users/reenviar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ perfil_id: p.id }),
    });
    const r = await resposta.json().catch(() => ({}));
    setOcupado("");
    setRetorno(resposta.ok ? { tipo: "ok", texto: `Convite reenviado para ${p.email}.` } : { tipo: "erro", texto: r.error ?? "Não foi possível reenviar." });
  }

  async function renovar(c: ConviteCompleto) {
    setOcupado(c.id); setRetorno(null);
    const novo = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const { error } = await createClient().from("convites").update({ expires_at: novo }).eq("id", c.id).eq("status", "pendente");
    setOcupado("");
    if (error) { setRetorno({ tipo: "erro", texto: `Não foi possível renovar: ${error.message}` }); return; }
    setRetorno({ tipo: "ok", texto: `Convite de ${c.email} renovado até ${dataBr(novo)}. O link continua o mesmo.` });
    onRecarregar();
  }

  async function confirmarCancelamento() {
    if (!cancelando) return;
    setErroCancelar(""); setOcupado("cancelar");
    if (cancelando.tipo === "link") {
      const { error } = await createClient().from("convites").update({ status: "revogado" }).eq("id", cancelando.convite.id);
      setOcupado("");
      if (error) { setErroCancelar(error.message); return; }
      setRetorno({ tipo: "ok", texto: `Convite de ${cancelando.convite.email} cancelado. O link deixou de funcionar.` });
      setCancelando(null); onRecarregar();
      return;
    }
    // Convite por e-mail: o cadastro já existe. Cancelar é excluí-lo — e o
    // banco só deixa quando não há nenhum registro vinculado.
    const { error } = await createClient().rpc("excluir_usuario", { p_perfil_id: cancelando.pessoa.id });
    setOcupado("");
    if (error) { setErroCancelar(`${error.message} Se a pessoa já tem registros, desative o acesso no cadastro dela.`); return; }
    setRetorno({ tipo: "ok", texto: `Convite de ${cancelando.pessoa.nome} cancelado e cadastro removido.` });
    setCancelando(null); onRefresh();
  }

  async function copiar(c: ConviteCompleto) {
    try { await navigator.clipboard.writeText(linkDoConvite(window.location.origin, c.token)); setCopiado(c.id); setTimeout(() => setCopiado(""), 2500); }
    catch { setRetorno({ tipo: "erro", texto: "Não foi possível copiar. Selecione o link e copie manualmente." }); }
  }

  const vazio = pessoasPendentes.length === 0 && abertos.length === 0;
  return (
    <div className="admConvites">
      {retorno && <p className={retorno.tipo === "ok" ? "financeSuccess" : "clinicalError"} role={retorno.tipo === "ok" ? "status" : "alert"}>{retorno.texto}</p>}
      {erroConvites && <p className="clinicalError">Não foi possível carregar os convites por link. <button type="button" className="admLinkBotao" onClick={onRecarregar}>Tentar de novo</button></p>}
      {vazio && <div className="emptyClinical">
        <strong>Nenhum convite pendente.</strong>
        {podeAdministrar && <>Para chamar alguém, use <button type="button" className="admLinkBotao" onClick={onAdicionar}>Adicionar pessoa</button>.</>}
      </div>}

      {pessoasPendentes.length > 0 && <>
        <h3 className="admSubtitulo">Convites por e-mail</h3>
        <p className="admNota">O cadastro já existe; falta a pessoa criar a senha pelo e-mail.</p>
        <ul className="admListaConvites">
          {pessoasPendentes.map((p) => {
            const l = logins?.get(p.id);
            return <li key={p.id}>
              <span><strong>{p.nome}</strong><small>{p.email} · {rotuloDaFuncao(p.role)}{l?.convidado_em ? ` · enviado em ${dataBr(l.convidado_em)}` : ""}</small></span>
              <span className="admAcesso convite_pendente">Pendente</span>
              {podeAdministrar && <span className="admAcoesConvite">
                <button type="button" className="outlineClinical" disabled={Boolean(ocupado)} onClick={() => void reenviar(p)}>{ocupado === p.id ? "Enviando…" : "Reenviar e-mail"}</button>
                <button type="button" className="outlineClinical" onClick={() => onAbrirPessoa(p.id)}>Abrir cadastro</button>
                <button type="button" className="outlineClinical" disabled={Boolean(ocupado)} onClick={() => { setErroCancelar(""); setCancelando({ tipo: "email", pessoa: p }); }}>Cancelar</button>
              </span>}
            </li>;
          })}
        </ul>
      </>}

      {abertos.length > 0 && <>
        <h3 className="admSubtitulo">Convites por link</h3>
        <ul className="admListaConvites">
          {abertos.map((c) => {
            const estado = estadoDoConvite(c, agora);
            return <li key={c.id}>
              <span><strong>{c.email}</strong><small>{rotuloDaFuncao(c.role)} · {estado === "expirado" ? `expirou em ${dataBr(c.expires_at)}` : `válido até ${dataBr(c.expires_at)}`}</small></span>
              <span className={`admEstadoConvite ${estado}`}>{ROTULO_DO_CONVITE[estado]}</span>
              {podeAdministrar && <span className="admAcoesConvite">
                {estado === "pendente" && <>
                  <button type="button" className="outlineClinical" onClick={() => void copiar(c)}><Icone nome={copiado === c.id ? "confirmado" : "copiar"} /> {copiado === c.id ? "Copiado" : "Copiar link"}</button>
                  <button type="button" className="outlineClinical whatsappAction" onClick={() => window.open(
                    `https://wa.me/?text=${encodeURIComponent(mensagemDoConvite(c, organizacaoNome, linkDoConvite(window.location.origin, c.token)))}`,
                    "_blank", "noopener,noreferrer")}><Icone nome="whatsapp" /> WhatsApp</button>
                </>}
                <button type="button" className="outlineClinical" disabled={Boolean(ocupado)} onClick={() => void renovar(c)}>{ocupado === c.id ? "Renovando…" : estado === "expirado" ? "Renovar por 7 dias" : "Estender 7 dias"}</button>
                <button type="button" className="outlineClinical" disabled={Boolean(ocupado)} onClick={() => { setErroCancelar(""); setCancelando({ tipo: "link", convite: c }); }}>Cancelar</button>
              </span>}
              {estado === "expirado" && <small className="admNotaLinha">Enquanto estiver pendente, impede criar outro convite para este e-mail.</small>}
            </li>;
          })}
        </ul>
      </>}

      {recentes.length > 0 && <details className="admDetalhes">
        <summary>Convites por link aceitos ou cancelados ({recentes.length} mais recentes)</summary>
        <ul className="admListaConvites compacta">
          {recentes.map((c) => <li key={c.id}>
            <span><strong>{c.email}</strong><small>{rotuloDaFuncao(c.role)} · criado em {dataBr(c.created_at)}</small></span>
            <span className={`admEstadoConvite ${estadoDoConvite(c, agora)}`}>{ROTULO_DO_CONVITE[estadoDoConvite(c, agora)]}</span>
          </li>)}
        </ul>
      </details>}

      {cancelando && <Dialogo
        titulo={cancelando.tipo === "link" ? `Cancelar o convite de ${cancelando.convite.email}?` : `Cancelar o convite de ${cancelando.pessoa.nome}?`}
        confirmar="Cancelar convite" cancelar="Manter" perigo ocupado={ocupado === "cancelar"} erro={erroCancelar}
        onConfirmar={() => void confirmarCancelamento()} onCancelar={() => setCancelando(null)}>
        {cancelando.tipo === "link"
          ? <p>O link deixa de funcionar na hora. Nada mais muda: você pode convidar o mesmo e-mail de novo depois.</p>
          : <p>O cadastro criado pelo convite é removido — só se a pessoa ainda não tiver nenhum registro (por exemplo, plantões já lançados em nome dela). Se tiver, o sistema recusa e explica; aí o caminho é desativar o acesso.</p>}
      </Dialogo>}
    </div>
  );
}

