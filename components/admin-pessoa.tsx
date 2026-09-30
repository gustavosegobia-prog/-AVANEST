"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Icone } from "@/components/icone";
import { Dialogo, Gaveta } from "@/components/admin-ui";
import {
  AREAS_CONCEDIVEIS, FUNCOES, NOME_DA_AREA_EXTRA, ROTULO_DO_ACESSO, areasEfetivas, concessoesLegadas,
  estadoDoAcesso, explicacaoDoAcesso, formatarCRM, lerCRM, mostraRegistroMedico, possiveisDuplicados,
  profissao, resumoDaMudanca, rotuloDaFuncao,
  type ConviteDeLink, type Contexto, type Login, type Nivel, type Pessoa, type ResumoDaMudanca,
} from "@/lib/equipe";
import { autorDoEvento, diferencas, rotuloDaAcao, type EventoDeAuditoria } from "@/lib/auditoria";
import { linkDoConvite, mensagemDoConvite } from "@/lib/convite-mensagem";

// O cadastro de uma pessoa, e o cadastro de uma pessoa nova.
//
// Os dois vivem em painel lateral (tela inteira no celular), por cima da
// lista — que continua montada embaixo, com a busca, os filtros e a posição
// de rolagem de quando o painel abriu.

export type Ator = { id: string; role: string; permissoes?: string[] | null };

const NIVEIS: Nivel[] = ["Visualizar", "Cadastrar", "Editar", "Aprovar", "Administrar"];
const dataBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const APOIO = ["recepcao", "financeiro"];
/** O primeiro nome, sem "Dr."/"Dra." — "O que Dr. pode fazer" não diz de quem. */
const primeiroNome = (nome: string) =>
  nome.trim().split(/\s+/).find((x) => !/^(dr|dra|prof|profa)\.?$/i.test(x)) ?? nome.trim();

/** Liga uma mensagem de erro do banco ao campo a que ela se refere. */
function campoDoErro(mensagem: string): "nome" | "role" | "crm" | "status" | null {
  if (/nome não pode/i.test(mensagem)) return "nome";
  if (/proprietári|função|conta de acesso/i.test(mensagem)) return "role";
  if (/plano contratado|anestesiologista\(s\)/i.test(mensagem)) return "crm";
  if (/desativar o próprio/i.test(mensagem)) return "status";
  return null;
}

/** As permissões efetivas, área por área, com os níveis em colunas. */
export function TabelaDePermissoes({ pessoa, ctx }: { pessoa: Pessoa; ctx: Contexto }) {
  const areas = areasEfetivas(pessoa, ctx);
  if (!areas.length) {
    return <p className="admNota">
      {pessoa.sem_acesso
        ? "Sem conta de acesso: não usa nenhuma área do sistema. Participa da escala e do faturamento pelo cadastro."
        : "Com o acesso desativado, não usa nenhuma área. O cadastro e o histórico continuam."}
    </p>;
  }
  return (
    <div className="admPermissoes" role="table" aria-label="Permissões efetivas">
      <div role="row" className="admPermLinha cabeca">
        <span role="columnheader">Área</span>
        {NIVEIS.map((n) => <span role="columnheader" key={n}>{n}</span>)}
      </div>
      {areas.map((a) => (
        <div role="row" className="admPermLinha" key={a.id}>
          <span role="cell" className="admPermArea">
            <strong>{a.nome}</strong>
            <small>{a.descricao}{a.origem === "area_extra" ? " · área extra" : a.origem === "legado" ? " · concessão antiga" : ""}
              {a.foraDoPlano ? " · não contratada pela organização" : ""}</small>
          </span>
          {NIVEIS.map((n) => (
            <span role="cell" key={n} className={a.niveis.includes(n) ? "sim" : "nao"} data-nivel={n}>
              {a.niveis.includes(n) ? <><Icone nome="confirmado" tamanho={14} /><span className="visuallyHidden">{n}: sim</span></> : <span className="visuallyHidden">{n}: não</span>}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** O resumo "o que muda" antes de gravar uma mudança de acesso. */
function ResumoDaMudancaNaTela({ resumo, nome }: { resumo: ResumoDaMudanca; nome: string }) {
  return (
    <div className="admResumo">
      {resumo.passaAPermitir.length > 0 && <>
        <h3>{nome} passa a poder</h3>
        <ul>{resumo.passaAPermitir.map((x) => <li key={x} className="ganha">{x}</li>)}</ul>
      </>}
      {resumo.deixaDePermitir.length > 0 && <>
        <h3>{nome} deixa de poder</h3>
        <ul>{resumo.deixaDePermitir.map((x) => <li key={x} className="perde">{x}</li>)}</ul>
      </>}
      {resumo.outras.length > 0 && <>
        <h3>Também muda</h3>
        <ul>{resumo.outras.map((x) => <li key={x}>{x}</li>)}</ul>
      </>}
      <p className="admEscopoTexto"><Icone nome="confirmado" tamanho={14} /> {resumo.escopo}</p>
    </div>
  );
}

// ── O painel de uma pessoa ────────────────────────────────────────────────

type Formulario = {
  nome: string; crm: string; rqe: string; role: string; status: string;
  atuacao: boolean | null; areas: string[]; escalista: boolean; naEscala: boolean; manterLegado: boolean;
};

export function PainelDaPessoa({
  pessoa, equipe, ator, ctx, login, papeis, podeEscolherEscalista, nomes, abaInicial = "dados",
  onFechar, onSalvo, onAbrirOutra,
}: {
  pessoa: Pessoa & { created_at?: string };
  equipe: Pessoa[];
  ator: Ator;
  ctx: Contexto;
  login: Login | null | undefined;
  papeis: string[];
  podeEscolherEscalista: boolean;
  nomes: Map<string, string>;
  abaInicial?: "dados" | "acesso" | "historico";
  onFechar: () => void;
  onSalvo: (mensagem: string) => void;
  onAbrirOutra: (id: string) => void;
}) {
  const inicial: Formulario = useMemo(() => ({
    nome: pessoa.nome, crm: pessoa.crm ?? "", rqe: pessoa.rqe ?? "", role: pessoa.role, status: pessoa.status,
    atuacao: pessoa.atuacao_medica ?? null,
    areas: (pessoa.permissoes ?? []).filter((x) => (AREAS_CONCEDIVEIS as readonly string[]).includes(x) && x !== pessoa.role),
    escalista: pessoa.escalista === true, naEscala: pessoa.na_escala !== false, manterLegado: true,
  }), [pessoa]);
  const [f, setF] = useState<Formulario>(inicial);
  const [aba, setAba] = useState(abaInicial);
  const [erros, setErros] = useState<Partial<Record<"nome" | "role" | "crm" | "status", string>>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [revisando, setRevisando] = useState<ResumoDaMudanca | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  // Para onde ir se a pessoa confirmar que descarta: fechar, ou abrir outro cadastro.
  const [destinoDaSaida, setDestinoDaSaida] = useState<string | null>(null);
  const [acaoDeConta, setAcaoDeConta] = useState<null | "status" | "excluir">(null);
  const [erroDaAcao, setErroDaAcao] = useState("");

  const sujo = JSON.stringify(f) !== JSON.stringify(inicial);
  const legado = concessoesLegadas(pessoa);
  const depois: Pessoa = {
    ...pessoa, nome: f.nome, crm: f.crm || null, rqe: f.rqe || null, role: f.role, status: f.status,
    atuacao_medica: f.atuacao, escalista: f.escalista, na_escala: f.naEscala,
    permissoes: [...f.areas, ...(f.manterLegado ? legado.map((c) => c.valor) : [])],
  };
  const estado = estadoDoAcesso(pessoa, login);
  const administra = ator.role === "admin" || ator.role === "owner";
  const somenteLeitura = !administra
    ? "Você pode consultar este cadastro. Só administrador ou proprietário altera."
    : pessoa.role === "owner" && ator.role !== "owner"
      ? "Só o proprietário altera o cadastro de um proprietário."
      : "";
  const ehVoce = pessoa.id === ator.id;

  // Alterações não salvas: o navegador também pergunta antes de sair.
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  const pedirFechar = () => { if (sujo && !ocupado) { setDestinoDaSaida(null); setConfirmarSaida(true); } else if (!ocupado) onFechar(); };
  const abrirOutra = (id: string) => { if (sujo) { setDestinoDaSaida(id); setConfirmarSaida(true); } else onAbrirOutra(id); };
  const mudar = (x: Partial<Formulario>) => { setF((v) => ({ ...v, ...x })); setErroGeral(""); setAviso(""); };

  const duplicadosDoCRM = f.crm.trim()
    ? possiveisDuplicados({ crm: f.crm }, equipe.filter((p) => p.id !== pessoa.id))
    : [];
  const crmLido = lerCRM(f.crm);
  const mostraCRM = mostraRegistroMedico(depois);
  const opcoesDeFuncao = [...new Set([...papeis, pessoa.role, ...(ator.role === "owner" ? ["owner"] : [])])];

  async function gravar() {
    setOcupado(true); setErroGeral(""); setErros({});
    const supabase = createClient();
    const nucleoMudou = f.nome !== inicial.nome || f.crm !== inicial.crm || f.rqe !== inicial.rqe
      || f.role !== inicial.role || f.status !== inicial.status || f.atuacao !== inicial.atuacao
      || JSON.stringify(f.areas) !== JSON.stringify(inicial.areas) || !f.manterLegado;
    if (nucleoMudou) {
      const { error } = await supabase.rpc("admin_atualizar_perfil", {
        p_perfil_id: pessoa.id, p_role: f.role, p_status: f.status, p_nome: f.nome.trim(),
        p_crm: f.crm.trim() || null, p_rqe: f.rqe.trim() || null, p_permissoes: f.areas,
        // null = "não mexa": só manda quando a pessoa escolheu uma resposta nova.
        p_atuacao_medica: f.atuacao !== inicial.atuacao ? f.atuacao : null,
        p_manter_legado: f.manterLegado,
      });
      if (error) {
        setOcupado(false); setRevisando(null);
        const campo = campoDoErro(error.message);
        if (campo) { setErros({ [campo]: error.message }); setAba(campo === "role" || campo === "status" ? "acesso" : "dados"); }
        else setErroGeral(`Não foi possível salvar: ${error.message}`);
        return;
      }
    }
    if (f.escalista !== inicial.escalista) {
      const { error } = await supabase.from("perfis").update({ escalista: f.escalista }).eq("id", pessoa.id);
      if (error) { setOcupado(false); setRevisando(null); setErroGeral(`O cadastro foi salvo, mas o escalista não mudou: ${error.message}`); return; }
    }
    const naEscalaFinal = APOIO.includes(f.role) ? false : f.naEscala;
    if (naEscalaFinal !== (pessoa.na_escala !== false)) {
      const { error } = await supabase.rpc("definir_na_escala", { p_perfil_id: pessoa.id, p_na_escala: naEscalaFinal });
      if (error) { setOcupado(false); setRevisando(null); setErroGeral(`O cadastro foi salvo, mas a participação na escala não mudou: ${error.message}`); return; }
    }
    setOcupado(false);
    onSalvo(`Alterações em ${f.nome.trim()} salvas e registradas no histórico.`);
  }

  function salvar() {
    if (!f.nome.trim()) { setErros({ nome: "Informe o nome." }); setAba("dados"); return; }
    const resumo = resumoDaMudanca(pessoa, depois, ctx);
    if (resumo.temMudancaDeAcesso) { setRevisando(resumo); return; }
    void gravar();
  }

  async function mudarSituacao() {
    const alvo = pessoa.status === "ativo" ? "inativo" : "ativo";
    setOcupado(true); setErroDaAcao("");
    const { error } = await createClient().rpc("admin_atualizar_perfil", {
      p_perfil_id: pessoa.id, p_role: pessoa.role, p_status: alvo, p_nome: pessoa.nome,
      p_crm: pessoa.crm, p_rqe: pessoa.rqe, p_permissoes: inicial.areas,
    });
    setOcupado(false);
    if (error) { setErroDaAcao(error.message); return; }
    onSalvo(alvo === "inativo"
      ? `Acesso de ${pessoa.nome} desativado. O cadastro e o histórico continuam.`
      : `Acesso de ${pessoa.nome} reativado.`);
  }

  async function excluir() {
    setOcupado(true); setErroDaAcao("");
    const { error } = await createClient().rpc("excluir_usuario", { p_perfil_id: pessoa.id });
    setOcupado(false);
    if (error) { setErroDaAcao(error.message); return; }
    onSalvo(`Cadastro de ${pessoa.nome} excluído.`);
  }

  async function reenviar() {
    setOcupado(true); setAviso(""); setErroGeral("");
    const resposta = await fetch("/api/admin/users/reenviar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perfil_id: pessoa.id }),
    });
    const r = await resposta.json().catch(() => ({}));
    setOcupado(false);
    if (!resposta.ok) setErroGeral(r.error ?? "Não foi possível reenviar o convite.");
    else setAviso(`Convite reenviado para ${pessoa.email}.`);
  }

  const prof = profissao(depois);
  const rodape = somenteLeitura ? (
    <button type="button" className="outlineClinical" onClick={onFechar}>Fechar</button>
  ) : (<>
    <span className="admRodapeEstado" aria-live="polite">{ocupado ? "Salvando…" : sujo ? "Alterações não salvas" : "Nada alterado"}</span>
    <button type="button" className="outlineClinical" onClick={pedirFechar} disabled={ocupado}>Cancelar</button>
    <button type="button" className="primaryClinical compact" onClick={salvar} disabled={!sujo || ocupado}>Salvar alterações</button>
  </>);

  return (
    <Gaveta
      titulo={pessoa.nome}
      subtitulo={<>
        <span className={`admAcesso ${estado}`}>{ROTULO_DO_ACESSO[estado]}</span>
        <span>{rotuloDaFuncao(pessoa.role)} · {profissao(pessoa).rotulo}</span>
      </>}
      onPedirFechar={pedirFechar}
      rodape={rodape}
    >
      {somenteLeitura && <p className="pendingNotice">{somenteLeitura}</p>}
      {erroGeral && <p className="clinicalError" role="alert">{erroGeral}</p>}
      {aviso && <p className="financeSuccess" role="status">{aviso}</p>}

      <div className="admAbas" role="tablist" aria-label="Seções do cadastro">
        {([["dados", "Dados pessoais e profissionais"], ["acesso", "Acesso e permissões"], ["historico", "Histórico"]] as const).map(([id, rotulo]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} className={aba === id ? "ativa" : ""}
            onClick={() => setAba(id)}>{rotulo}{id === "acesso" && erros.role ? " •" : ""}{id === "dados" && (erros.nome || erros.crm) ? " •" : ""}</button>
        ))}
      </div>

      <fieldset className="admCampos" disabled={Boolean(somenteLeitura) || ocupado}>
        {aba === "dados" && <>
          <label className={`clinicalField ${erros.nome ? "comErro" : ""}`}>
            <span>Nome completo *</span>
            <input value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} aria-invalid={Boolean(erros.nome)}
              aria-describedby={erros.nome ? "erro-nome" : undefined} />
            {erros.nome && <small id="erro-nome" className="admErroCampo">{erros.nome}</small>}
          </label>
          <div className="clinicalField">
            <span>E-mail de acesso</span>
            <p className="admValorFixo">{pessoa.sem_acesso ? "Sem conta de acesso — não há e-mail." : pessoa.email || "—"}</p>
            {!pessoa.sem_acesso && <small className="admAjuda">É o login da pessoa e não muda por aqui.</small>}
          </div>
          <label className="clinicalField">
            <span>Atua como médico(a)?</span>
            <select value={f.atuacao === null ? "" : f.atuacao ? "sim" : "nao"} disabled={pessoa.role === "medico" || pessoa.sem_acesso}
              onChange={(e) => mudar({ atuacao: e.target.value === "sim" ? true : e.target.value === "nao" ? false : null })}>
              <option value="" disabled={inicial.atuacao !== null}>Não informado</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
            <small className="admAjuda">
              {pessoa.role === "medico" || pessoa.sem_acesso
                ? "A função Área médica é de quem atua como médico."
                : "A profissão é separada da função: um administrador pode ser médico e continua contando como médico."}
              {prof.fonte === "crm" && f.atuacao === null ? " Hoje a tela deduz pelo CRM cadastrado." : ""}
            </small>
          </label>
          {mostraCRM && <div className="admLinhaDupla">
            <label className={`clinicalField ${erros.crm ? "comErro" : ""}`}>
              <span>CRM / UF</span>
              <input value={f.crm} onChange={(e) => mudar({ crm: e.target.value })} placeholder="Ex.: 60593/PR"
                aria-invalid={Boolean(erros.crm)} aria-describedby="ajuda-crm" />
              <small id="ajuda-crm" className={erros.crm ? "admErroCampo" : "admAjuda"}>
                {erros.crm || (f.crm.trim()
                  ? crmLido?.uf ? `Aparece como ${formatarCRM(f.crm)}. O texto é guardado como digitado.`
                    : "Não encontrei a UF. Escreva como 60593/PR."
                  : "Em branco: a pessoa entra na escala com a pendência de CRM.")}
              </small>
            </label>
            <label className="clinicalField">
              <span>RQE</span>
              <input value={f.rqe} onChange={(e) => mudar({ rqe: e.target.value })} placeholder="Registro da especialidade" />
              <small className="admAjuda">Opcional.</small>
            </label>
          </div>}
          {duplicadosDoCRM.length > 0 && <div className="admAlerta" role="status">
            <strong>Este CRM também está em outro cadastro.</strong>
            {duplicadosDoCRM.map((d) => d.pessoa && (
              <span key={d.pessoa.id}>{d.pessoa.nome} ({d.motivo}) <button type="button" className="admLinkBotao" onClick={() => abrirOutra(d.pessoa!.id)}>Revisar esse cadastro</button></span>
            ))}
            <small>Nada é mesclado automaticamente. Se for a mesma pessoa, transfira os registros e exclua ou desative o cadastro que sobra.</small>
          </div>}

          <h3 className="admSubtitulo">Responsabilidades</h3>
          {APOIO.includes(f.role)
            ? <p className="admNota">Recepção e Financeiro não entram na escala.</p>
            : <label className="admMarca">
                <input type="checkbox" checked={f.naEscala} onChange={(e) => mudar({ naEscala: e.target.checked })} />
                <span><strong>Participa da escala</strong><small>Aparece para ser escalado nos plantões do grupo.</small></span>
              </label>}
          {podeEscolherEscalista && !pessoa.sem_acesso && (
            <label className="admMarca">
              <input type="checkbox" checked={f.escalista} onChange={(e) => mudar({ escalista: e.target.checked })} />
              <span><strong>Monta a escala do grupo</strong>
                <small>Com um escalista definido, só ele e o proprietário montam a escala — administradores deixam de montar.</small></span>
            </label>
          )}
        </>}

        {aba === "acesso" && <>
          <div className={`admCartaoEstado ${estado}`}>
            <strong>{ROTULO_DO_ACESSO[estado]}</strong>
            <span>{explicacaoDoAcesso(estado, login)}</span>
            {estado === "convite_pendente" && administra && (
              <button type="button" className="outlineClinical" onClick={() => void reenviar()} disabled={ocupado}>Reenviar convite por e-mail</button>
            )}
          </div>

          <label className={`clinicalField ${erros.role ? "comErro" : ""}`}>
            <span>Função no sistema</span>
            <select value={f.role} onChange={(e) => mudar({ role: e.target.value, areas: f.areas.filter((a) => a !== e.target.value) })}
              disabled={pessoa.sem_acesso || (pessoa.role === "owner" && ator.role !== "owner")} aria-invalid={Boolean(erros.role)}>
              {opcoesDeFuncao.map((r) => <option key={r} value={r}>{rotuloDaFuncao(r)}</option>)}
            </select>
            <small className={erros.role ? "admErroCampo" : "admAjuda"}>
              {erros.role || (pessoa.sem_acesso
                ? "Sem conta de acesso, a função é sempre Área médica. Para outra função, a pessoa precisa de uma conta."
                : FUNCOES[f.role]?.resumo)}
            </small>
          </label>

          {!pessoa.sem_acesso && (f.role === "admin" || f.role === "owner"
            ? <p className="admNota">{rotuloDaFuncao(f.role)} já usa todas as áreas contratadas.</p>
            : <fieldset className="admAreas">
                <legend>Áreas extras</legend>
                <p className="admAjuda">Além da função, esta pessoa também pode usar:</p>
                {AREAS_CONCEDIVEIS.filter((a) => a !== f.role).map((a) => {
                  const marcada = f.areas.includes(a);
                  const modulo = a === "recepcao" ? "recepcao" : a === "medico" ? "medico" : "financeiro";
                  const fora = Boolean(ctx.modulos && !ctx.modulos.includes(modulo));
                  return <label key={a} className="admMarca">
                    <input type="checkbox" checked={marcada} disabled={fora && !marcada}
                      onChange={() => mudar({ areas: marcada ? f.areas.filter((x) => x !== a) : [...f.areas, a] })} />
                    <span><strong>{NOME_DA_AREA_EXTRA[a]}</strong>
                      <small>{fora ? "A organização não contratou esta área." : FUNCOES[a]?.resumo}</small></span>
                  </label>;
                })}
              </fieldset>)}

          {legado.length > 0 && <div className="admAlerta">
            <strong>Concessões antigas</strong>
            {legado.map((c) => <span key={c.valor}><code>{c.valor}</code> — {c.efeito}</span>)}
            <label className="admMarca">
              <input type="checkbox" checked={!f.manterLegado} onChange={(e) => mudar({ manterLegado: !e.target.checked })} />
              <span><strong>Remover ao salvar</strong><small>Sem esta marca, elas continuam como estão.</small></span>
            </label>
          </div>}

          <h3 className="admSubtitulo">O que {primeiroNome(f.nome) || "esta pessoa"} pode fazer</h3>
          <TabelaDePermissoes pessoa={depois} ctx={ctx} />
          <p className="admNota"><Icone nome="confirmado" tamanho={13} /> Vale em todos os locais compartilhados da organização. O acesso no AVANEST não é separado por local.</p>

          {administra && !somenteLeitura && !ehVoce && <div className="admZonaDeCuidado">
            <h3>Ações sobre a conta</h3>
            {sujo && <p className="admNota">Salve ou descarte as alterações antes de desativar ou excluir.</p>}
            <div className="admZonaLinha">
              <span>
                <strong>{pessoa.status === "ativo" ? "Desativar acesso" : "Reativar acesso"}</strong>
                <small>{pessoa.status === "ativo"
                  ? "A pessoa deixa de entrar e sai da escala. Cadastro, plantões e histórico continuam."
                  : "A pessoa volta a entrar no sistema e a aparecer na escala."}</small>
              </span>
              <button type="button" className="outlineClinical" disabled={sujo || ocupado}
                onClick={() => { setErroDaAcao(""); setAcaoDeConta("status"); }}>
                {pessoa.status === "ativo" ? "Desativar" : "Reativar"}</button>
            </div>
            {pessoa.role !== "owner" && <div className="admZonaLinha">
              <span>
                <strong>Excluir cadastro</strong>
                <small>Só para quem não tem nenhum registro (prontuário, plantões, produção ou faturamento). Com registros, o sistema recusa: use desativar.</small>
              </span>
              <button type="button" className="outlineClinical red" disabled={sujo || ocupado}
                onClick={() => { setErroDaAcao(""); setAcaoDeConta("excluir"); }}>Excluir</button>
            </div>}
          </div>}
          {ehVoce && <p className="admNota">Você não pode desativar nem excluir o próprio acesso.</p>}
        </>}
      </fieldset>

      {aba === "historico" && <HistoricoDaPessoa pessoa={pessoa} nomes={nomes} />}

      {revisando && <Dialogo titulo="Confirme a mudança de acesso" confirmar="Confirmar e salvar" ocupado={ocupado}
        onConfirmar={() => void gravar()} onCancelar={() => setRevisando(null)}>
        <ResumoDaMudancaNaTela resumo={revisando} nome={primeiroNome(f.nome) || "A pessoa"} />
      </Dialogo>}

      {confirmarSaida && <Dialogo titulo="Descartar as alterações?" confirmar="Descartar" cancelar="Continuar editando" perigo
        onConfirmar={() => { setConfirmarSaida(false); if (destinoDaSaida) onAbrirOutra(destinoDaSaida); else onFechar(); }}
        onCancelar={() => setConfirmarSaida(false)}>
        <p>O que você mudou em {pessoa.nome} ainda não foi salvo.</p>
      </Dialogo>}

      {acaoDeConta === "status" && <Dialogo
        titulo={pessoa.status === "ativo" ? `Desativar o acesso de ${pessoa.nome}?` : `Reativar o acesso de ${pessoa.nome}?`}
        confirmar={pessoa.status === "ativo" ? "Desativar acesso" : "Reativar acesso"} perigo={pessoa.status === "ativo"}
        ocupado={ocupado} erro={erroDaAcao} onConfirmar={() => void mudarSituacao()} onCancelar={() => setAcaoDeConta(null)}>
        <ResumoDaMudancaNaTela nome={primeiroNome(pessoa.nome)}
          resumo={resumoDaMudanca(pessoa, { ...pessoa, status: pessoa.status === "ativo" ? "inativo" : "ativo" }, ctx)} />
      </Dialogo>}

      {acaoDeConta === "excluir" && <Dialogo titulo={`Excluir o cadastro de ${pessoa.nome}?`} confirmar="Excluir definitivamente" perigo
        ocupado={ocupado} erro={erroDaAcao} onConfirmar={() => void excluir()} onCancelar={() => setAcaoDeConta(null)}>
        <p>A exclusão é definitiva e só acontece se a pessoa não tiver nenhum registro no sistema. Se tiver, nada é apagado e o sistema explica o motivo — nesse caso, desative o acesso.</p>
      </Dialogo>}
    </Gaveta>
  );
}

/** O histórico administrativo de uma pessoa, lido da auditoria. */
function HistoricoDaPessoa({ pessoa, nomes }: { pessoa: Pessoa & { created_at?: string }; nomes: Map<string, string> }) {
  const [eventos, setEventos] = useState<EventoDeAuditoria[] | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    void createClient().from("auditoria")
      .select("id,actor_id,entidade,entidade_id,acao,detalhes,dados_anteriores,dados_novos,created_at")
      .eq("entidade_id", pessoa.id).order("created_at", { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) setErro("Não foi possível carregar o histórico desta pessoa.");
        else setEventos((data ?? []) as EventoDeAuditoria[]);
      });
    return () => { vivo = false; };
  }, [pessoa.id]);

  if (erro) return <p className="clinicalError">{erro}</p>;
  if (!eventos) return <p className="admNota" aria-live="polite">Carregando o histórico…</p>;
  return (
    <div className="admHistorico">
      {pessoa.created_at && <p className="admNota">Cadastro criado em {dataBr(pessoa.created_at)}.</p>}
      {eventos.length === 0
        ? <p className="admNota">Nenhuma alteração administrativa registrada para esta pessoa.</p>
        : <ol>
            {eventos.map((e) => {
              const mudancas = diferencas(e);
              return <li key={e.id}>
                <time dateTime={e.created_at}>{dataHora(e.created_at)}</time>
                <strong>{rotuloDaAcao(e)}</strong>
                <small>por {autorDoEvento(e, nomes)}</small>
                {mudancas.length > 0 && <ul className="admDiferencas">
                  {mudancas.map((m) => <li key={m.campo}><b>{m.campo}:</b> {m.de} <span aria-hidden="true">→</span><span className="visuallyHidden">para</span> {m.para}</li>)}
                </ul>}
              </li>;
            })}
          </ol>}
      <p className="admNota">Mostra as 30 alterações mais recentes. Valores anteriores só aparecem a partir de 30/09/2026, quando o registro passou a guardá-los.</p>
    </div>
  );
}

// ── Adicionar pessoa ──────────────────────────────────────────────────────

type Forma = "email" | "link" | "sem_conta";

export function NovaPessoa({
  equipe, convites, ctx, papeis, organizacao, onFechar, onConcluido, onAbrirPessoa, onConviteCriado,
}: {
  equipe: Pessoa[];
  convites: ConviteDeLink[];
  ctx: Contexto;
  papeis: string[];
  organizacao: { id: string; nome: string | null; atorId: string };
  onFechar: () => void;
  onConcluido: (mensagem: string) => void;
  onAbrirPessoa: (id: string) => void;
  onConviteCriado: () => void;
}) {
  const [passo, setPasso] = useState<1 | 2 | 3 | "feito">(1);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [atuacao, setAtuacao] = useState<"sim" | "nao" | "">("");
  const [crm, setCrm] = useState("");
  const [rqe, setRqe] = useState("");
  const [role, setRole] = useState(papeis.includes("medico") ? "medico" : papeis[0] ?? "medico");
  const [forma, setForma] = useState<Forma>("email");
  const [dias, setDias] = useState(7);
  const [outraPessoa, setOutraPessoa] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<{ mensagem: string; link?: string; convite?: { role: string; email: string; expires_at: string } } | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const enviando = useRef(false);

  const semEmail = !email.trim();
  const duplicados = possiveisDuplicados({ email, crm }, equipe, convites);
  const medico = atuacao === "sim" || role === "medico";
  const sujo = passo !== "feito" && Boolean(nome || email || crm || rqe);
  const formasPossiveis: Forma[] = semEmail ? ["sem_conta"] : role === "medico" ? ["email", "link", "sem_conta"] : ["email", "link"];
  const formaFinal = formasPossiveis.includes(forma) ? forma : formasPossiveis[0];
  const previa: Pessoa = {
    id: "nova", nome, email: email || null, role: formaFinal === "sem_conta" ? "medico" : role, status: "ativo",
    crm: crm || null, rqe: rqe || null, permissoes: [], sem_acesso: formaFinal === "sem_conta",
    atuacao_medica: atuacao === "" ? null : atuacao === "sim", na_escala: true,
  };

  const pedirFechar = () => { if (ocupado) return; if (sujo) setConfirmarSaida(true); else onFechar(); };

  function avancar() {
    const e: Record<string, string> = {};
    if (passo === 1) {
      if (!nome.trim()) e.nome = "Informe o nome completo.";
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Confira o e-mail: falta o @ ou o domínio.";
      if (duplicados.length && !outraPessoa) e.duplicado = "Revise os cadastros parecidos ou confirme que é outra pessoa.";
    }
    if (passo === 2 && semEmail && role !== "medico") {
      e.role = "Sem e-mail, a pessoa só pode ser cadastrada sem acesso — e cadastro sem acesso é para quem atua na área médica. Volte e informe o e-mail, ou escolha Área médica.";
    }
    setErros(e);
    if (Object.keys(e).length) return;
    setPasso(passo === 1 ? 2 : 3);
  }

  async function concluir() {
    if (enviando.current) return; // proteção contra clique duplo
    enviando.current = true; setOcupado(true); setErroGeral("");
    try {
      if (formaFinal === "link") {
        const { data, error } = await createClient().from("convites").insert({
          institution_id: organizacao.id, email: email.trim().toLowerCase(), role, invited_by: organizacao.atorId,
          expires_at: new Date(Date.now() + dias * 86_400_000).toISOString(),
        }).select("token,role,email,expires_at").single();
        if (error) {
          setErroGeral(error.code === "23505"
            ? "Já existe um convite por link pendente para este e-mail. Renove ou cancele o anterior em Convites pendentes."
            : `Não foi possível criar o convite: ${error.message}`);
          return;
        }
        onConviteCriado();
        setResultado({
          mensagem: `Link de convite criado para ${email.trim()}. Válido por ${dias} dias.`,
          link: linkDoConvite(window.location.origin, data.token), convite: data,
        });
        setPasso("feito");
        return;
      }
      const resposta = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formaFinal === "sem_conta"
          ? { nome: nome.trim(), role: "medico", sem_acesso: true, crm: crm.trim(), rqe: rqe.trim() }
          : { nome: nome.trim(), email: email.trim().toLowerCase(), role, crm: medico ? crm.trim() : "", rqe: medico ? rqe.trim() : "",
              atuacao_medica: atuacao === "" ? null : atuacao === "sim" }),
      });
      const r = await resposta.json().catch(() => ({}));
      if (!resposta.ok) { setErroGeral(r.error ?? "Não foi possível concluir o cadastro."); return; }
      setResultado({
        mensagem: formaFinal === "sem_conta"
          ? `${nome.trim()} cadastrado sem acesso. Já pode ser escalado e não recebe login.`
          : `Convite enviado para ${email.trim()}. ${nome.trim()} aparece na equipe como "Convite pendente" até criar a senha.`,
      });
      setPasso("feito");
    } finally {
      enviando.current = false; setOcupado(false);
    }
  }

  const passos = ["Dados da pessoa", "Função e locais", "Revisão e forma de entrada"];
  const rodape = passo === "feito" ? (<>
    <button type="button" className="outlineClinical" onClick={() => onConcluido(resultado?.mensagem ?? "")}>Concluir</button>
  </>) : (<>
    {passo > 1 && <button type="button" className="outlineClinical" onClick={() => setPasso((passo - 1) as 1 | 2)} disabled={ocupado}>Voltar</button>}
    <button type="button" className="outlineClinical" onClick={pedirFechar} disabled={ocupado}>Cancelar</button>
    {passo < 3
      ? <button type="button" className="primaryClinical compact" onClick={avancar}>Continuar</button>
      : <button type="button" className="primaryClinical compact" onClick={() => void concluir()} disabled={ocupado}>
          {ocupado ? "Salvando…" : formaFinal === "email" ? "Enviar convite" : formaFinal === "link" ? "Gerar link" : "Cadastrar sem acesso"}
        </button>}
  </>);

  return (
    <Gaveta titulo="Adicionar pessoa" onPedirFechar={pedirFechar} rodape={rodape}
      subtitulo={passo !== "feito" && <ol className="admPassos" aria-label="Etapas">
        {passos.map((p, i) => <li key={p} className={i + 1 === passo ? "atual" : i + 1 < (passo as number) ? "feito" : ""}
          aria-current={i + 1 === passo ? "step" : undefined}>{i + 1}. {p}</li>)}
      </ol>}>
      {erroGeral && <p className="clinicalError" role="alert">{erroGeral}</p>}

      {passo === 1 && <div className="admCampos">
        <label className={`clinicalField ${erros.nome ? "comErro" : ""}`}>
          <span>Nome completo *</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} data-foco-inicial placeholder="Ex.: Dra. Helena Martins" aria-invalid={Boolean(erros.nome)} />
          {erros.nome && <small className="admErroCampo">{erros.nome}</small>}
        </label>
        <label className={`clinicalField ${erros.email ? "comErro" : ""}`}>
          <span>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@exemplo.com" aria-invalid={Boolean(erros.email)} />
          <small className={erros.email ? "admErroCampo" : "admAjuda"}>{erros.email || "Vira o login da pessoa. Deixe em branco para cadastrar um profissional sem acesso ao sistema."}</small>
        </label>
        <label className="clinicalField">
          <span>Atua como médico(a)?</span>
          <select value={atuacao} onChange={(e) => setAtuacao(e.target.value as "sim" | "nao" | "")}>
            <option value="">Não sei / prefiro não informar</option><option value="sim">Sim</option><option value="nao">Não</option>
          </select>
        </label>
        {atuacao === "sim" && <div className="admLinhaDupla">
          <label className="clinicalField"><span>CRM / UF</span>
            <input value={crm} onChange={(e) => setCrm(e.target.value)} placeholder="Ex.: 60593/PR" />
            <small className="admAjuda">{crm.trim() ? (lerCRM(crm)?.uf ? `Aparece como ${formatarCRM(crm)}.` : "Não encontrei a UF. Escreva como 60593/PR.") : "Opcional agora; fica como pendência."}</small>
          </label>
          <label className="clinicalField"><span>RQE</span><input value={rqe} onChange={(e) => setRqe(e.target.value)} placeholder="Opcional" /></label>
        </div>}
        {duplicados.length > 0 && <div className={`admAlerta ${erros.duplicado ? "comErro" : ""}`} role="status">
          <strong>Encontramos cadastros parecidos</strong>
          {duplicados.map((d, i) => d.pessoa
            ? <span key={i}>{d.pessoa.nome} — {d.motivo} <button type="button" className="admLinkBotao" onClick={() => onAbrirPessoa(d.pessoa!.id)}>Revisar cadastro existente</button></span>
            : <span key={i}>{d.convite!.email} — {d.motivo}</span>)}
          <label className="admMarca"><input type="checkbox" checked={outraPessoa} onChange={(e) => setOutraPessoa(e.target.checked)} />
            <span><strong>É outra pessoa, quero continuar</strong><small>Nada é mesclado automaticamente.</small></span></label>
          {erros.duplicado && <small className="admErroCampo">{erros.duplicado}</small>}
        </div>}
      </div>}

      {passo === 2 && <div className="admCampos">
        <label className={`clinicalField ${erros.role ? "comErro" : ""}`}>
          <span>Função no sistema</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {papeis.map((p) => <option key={p} value={p}>{rotuloDaFuncao(p)}</option>)}
          </select>
          <small className={erros.role ? "admErroCampo" : "admAjuda"}>{erros.role || FUNCOES[role]?.resumo}</small>
        </label>
        <p className="admNota">Proprietário não é escolhido aqui: quem é proprietário promove outra pessoa pelo cadastro dela, depois que ela entrar.</p>
        <h3 className="admSubtitulo">Locais</h3>
        <p className="admNota"><Icone nome="confirmado" tamanho={13} /> A pessoa terá acesso a todos os locais compartilhados da organização. O AVANEST não separa acesso por local; locais particulares continuam só de quem os criou.</p>
        <p className="admNota">Áreas extras (por exemplo, Financeiro para alguém da Recepção) são concedidas no cadastro da pessoa, depois de criado.</p>
      </div>}

      {passo === 3 && <div className="admCampos">
        <fieldset className="admFormas">
          <legend>Como a pessoa vai entrar</legend>
          {([
            ["email", "Convidar por e-mail", "O AVANEST envia um e-mail com o link para a pessoa criar a senha. O cadastro já aparece na equipe como “Convite pendente”."],
            ["link", "Gerar link de convite", "Você copia o link e envia por WhatsApp ou onde preferir. Ele só vale para este e-mail e expira na data escolhida. Nome, profissão e CRM são preenchidos pela pessoa ao aceitar."],
            ["sem_conta", "Cadastrar profissional sem acesso ao sistema", "A pessoa participa dos processos permitidos, como a escala e o faturamento, mas não terá login: não há e-mail, senha nem convite. Se um dia precisar de acesso, dá para convidar depois sem perder plantões."],
          ] as [Forma, string, string][]).map(([valor, titulo, texto]) => {
            const possivel = formasPossiveis.includes(valor);
            return <label key={valor} className={`admForma ${formaFinal === valor ? "escolhida" : ""} ${possivel ? "" : "indisponivel"}`}>
              <input type="radio" name="forma" value={valor} checked={formaFinal === valor} disabled={!possivel} onChange={() => setForma(valor)} />
              <span><strong>{titulo}</strong><small>{texto}</small>
                {!possivel && <em>{valor === "sem_conta" ? "Disponível só para a função Área médica." : "Precisa de e-mail (passo 1)."}</em>}</span>
            </label>;
          })}
        </fieldset>
        {formaFinal === "link" && <label className="clinicalField"><span>Validade do link</span>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={3}>3 dias</option><option value={7}>7 dias</option><option value={30}>30 dias</option>
          </select></label>}

        <h3 className="admSubtitulo">Revisão</h3>
        <dl className="admRevisao">
          <div><dt>Nome</dt><dd>{nome || "—"}</dd></div>
          <div><dt>E-mail</dt><dd>{email || "sem e-mail"}</dd></div>
          <div><dt>Profissão</dt><dd>{profissao(previa).rotulo}</dd></div>
          {previa.crm && <div><dt>CRM</dt><dd>{formatarCRM(previa.crm)}</dd></div>}
          <div><dt>Função</dt><dd>{rotuloDaFuncao(previa.role)}</dd></div>
        </dl>
        <h3 className="admSubtitulo">Prévia das permissões</h3>
        <TabelaDePermissoes pessoa={previa} ctx={ctx} />
        {mostraRegistroMedico(previa) && !previa.crm && <p className="admNota">Sem CRM, a pessoa entra na escala com a pendência de registro.</p>}
      </div>}

      {passo === "feito" && resultado && <div className="admCampos">
        <p className="financeSuccess" role="status">{resultado.mensagem}</p>
        {resultado.link && resultado.convite && <div className="admLinkGerado">
          <input readOnly value={resultado.link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} />
          <div>
            <button type="button" className="outlineClinical" onClick={() => void navigator.clipboard?.writeText(resultado.link!)}>
              <Icone nome="copiar" /> Copiar link</button>
            <button type="button" className="outlineClinical whatsappAction" onClick={() => window.open(
              `https://wa.me/?text=${encodeURIComponent(mensagemDoConvite(resultado.convite!, organizacao.nome, resultado.link!))}`,
              "_blank", "noopener,noreferrer")}><Icone nome="whatsapp" /> Enviar por WhatsApp</button>
          </div>
        </div>}
      </div>}

      {confirmarSaida && <Dialogo titulo="Descartar o cadastro?" confirmar="Descartar" cancelar="Continuar cadastrando" perigo
        onConfirmar={() => { setConfirmarSaida(false); onFechar(); }} onCancelar={() => setConfirmarSaida(false)}>
        <p>Os dados digitados ainda não foram salvos.</p>
      </Dialogo>}
    </Gaveta>
  );
}
