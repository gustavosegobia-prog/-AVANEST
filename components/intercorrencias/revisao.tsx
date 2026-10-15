"use client";

import { useEffect, useState } from "react";
import estilos from "./intercorrencias.module.css";
import { Icone } from "@/components/icone";
import { createClient } from "@/utils/supabase/client";
import { assinatura, ehProtocolo, PODE_REGISTRAR, ROTULO_SITUACAO, type Estado } from "@/lib/intercorrencias/situacao";
import type { Protocolo, Situacao } from "@/lib/intercorrencias/tipos";
import { traduzirErro, type Revisoes } from "./use-revisoes";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
});
const dataHora = (iso: string) => DATA_HORA.format(new Date(iso));

const ROTULO_PAPEL = { admin: "Administrador", editor: "Editor científico", revisor: "Revisor médico" } as const;

const ACAO: Record<Situacao, { botao: string; motivo: boolean; forte?: boolean; perigo?: boolean }> = {
  rascunho: { botao: "Voltar para rascunho", motivo: false },
  pendente: { botao: "Enviar para revisão", motivo: false },
  aprovado: { botao: "Aprovar esta versão", motivo: false, forte: true },
  necessita_atualizacao: { botao: "Pedir atualização", motivo: true },
  suspenso: { botao: "Suspender", motivo: true, perigo: true },
};

/**
 * A revisão de um protocolo. Os botões seguem o papel (a mesma regra está no
 * banco, que é quem de fato decide); aprovar pede a confirmação de que o
 * protocolo foi lido inteiro, e pedir atualização ou suspender pede o motivo.
 */
export function PainelDeRevisao({ protocolo, estado, revisoes, superAdmin }: {
  protocolo: Protocolo; estado: Estado; revisoes: Revisoes; superAdmin: boolean;
}) {
  const [obs, setObs] = useState("");
  const [li, setLi] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);

  const papel = revisoes.papel?.papel ?? (revisoes.papel?.admin || superAdmin ? "admin" : null);
  // Decisão só com o banco à mão: sem ele (ou sem rede), nada é gravado.
  const comBanco = revisoes.fonte === "banco" && !revisoes.semBanco;
  const podem = papel ? PODE_REGISTRAR[papel] : [];
  const atual = assinatura(protocolo);

  async function decidir(situacao: Situacao, p: Protocolo = protocolo, sig: string = atual, nota: string = obs) {
    if (ACAO[situacao].motivo && nota.trim().length < 5) { setRetorno({ ok: false, texto: "Escreva o motivo (pelo menos 5 letras)." }); return; }
    setEnviando(true); setRetorno(null);
    const erro = await revisoes.registrar(p, sig, situacao, nota);
    setEnviando(false);
    if (erro) { setRetorno({ ok: false, texto: erro }); return; }
    setObs(""); setLi(false);
    setRetorno({ ok: true, texto: `Registrado: ${ROTULO_SITUACAO[situacao]}.` });
  }

  const historico = [...estado.historico].reverse();
  return (
    // Fechada por padrão: é trabalho da equipe, e não pode ocupar a consulta.
    <details className={`${estilos.secao} ${estilos.revisao}`}>
      <summary>
        Revisão científica
        <span className={`${estilos.selo} ${estilos[`selo_${estado.daVersaoAtual}`]}`}>{ROTULO_SITUACAO[estado.daVersaoAtual]}</span>
        <Icone nome="seta" tamanho={18} />
      </summary>
      <div className={estilos.pilha}>
        <p className={estilos.miuda}>
          Seu papel: <b>{papel ? ROTULO_PAPEL[papel] : "—"}</b>
          {revisoes.papel?.crm ? ` · ${revisoes.papel.crm}` : ""}
          {papel === "revisor" && !revisoes.papel?.crm ? " · sem CRM no perfil: não é possível aprovar." : ""}
          {" · "}versão {protocolo.versao}, assinatura {atual}
        </p>
        {revisoes.semBanco && (
          <p className={estilos.bloqueio}>
            O banco do módulo ainda não está instalado (migração 202610150001_intercorrencias_anestesicas.sql). Até lá,
            o protocolo aparece como pendente e nenhuma decisão pode ser registrada.
          </p>
        )}
        {!comBanco && !revisoes.semBanco && !revisoes.carregando && (
          <p className={estilos.bloqueio}>
            Sem conexão com o banco: as decisões não podem ser registradas agora.
            {revisoes.fonte === "copia" && revisoes.salvoEm ? ` Mostrando a cópia salva neste aparelho em ${dataHora(revisoes.salvoEm)}.` : ""}
          </p>
        )}

        {podem.length > 0 && comBanco && (
          <>
            <label className={estilos.campo}>
              <span>Observação (obrigatória para pedir atualização ou suspender)</span>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={2000} />
            </label>
            {podem.includes("aprovado") && (
              <label className={estilos.marcar}>
                <input type="checkbox" checked={li} onChange={(e) => setLi(e.target.checked)} />
                <span>Li o protocolo inteiro, conferi cada dose com a referência citada e as divergências entre as fontes.</span>
              </label>
            )}
            <div className={estilos.barraAcoes}>
              {podem.filter((s) => s !== estado.daVersaoAtual || s === "aprovado").map((s) => (
                <button key={s} type="button" disabled={enviando || (s === "aprovado" && (!li || estado.daVersaoAtual === "aprovado"))}
                  className={`${estilos.botao} ${ACAO[s].forte ? estilos.botaoForte : ""} ${ACAO[s].perigo ? estilos.botaoPerigo : ""}`}
                  onClick={() => void decidir(s)}>
                  {ACAO[s].botao}
                </button>
              ))}
            </div>
          </>
        )}
        {retorno && <p className={retorno.ok ? estilos.ok : estilos.erro} role="status">{retorno.texto}</p>}

        <h4 className={estilos.grupoDoses}>Histórico de versões</h4>
        {historico.length === 0 ? (
          <p className={estilos.vazio}>Nenhuma decisão registrada ainda. A versão {protocolo.versao} está pendente de revisão científica.</p>
        ) : (
          <ul className={estilos.historico}>
            {historico.map((r) => {
              const podeRestaurar = papel === "revisor" && r.situacao === "aprovado" && ehProtocolo(r.conteudo, protocolo.id)
                && r.assinatura !== estado.aprovacao?.assinatura;
              return (
                <li key={r.id}>
                  <div>
                    <span className={`${estilos.selo} ${estilos[`selo_${r.situacao}`]}`}>{ROTULO_SITUACAO[r.situacao]}</span>
                    <span>Versão {r.versao}</span>
                    <span>{dataHora(r.criadoEm)}</span>
                  </div>
                  <span>{r.autorNome} · {ROTULO_PAPEL[r.autorPapel]}{r.autorCrm ? ` · ${r.autorCrm}` : ""}</span>
                  {r.observacao && <span className={estilos.miuda}>“{r.observacao}”</span>}
                  {podeRestaurar && (
                    <div>
                      <button type="button" className={estilos.botao} disabled={enviando}
                        onClick={() => void decidir("aprovado", r.conteudo as Protocolo, r.assinatura,
                          `Restaurada a versão ${r.versao} aprovada em ${dataHora(r.criadoEm)}.`)}>
                        Restaurar esta versão
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </details>
  );
}

type Membro = { user_id: string; nome: string | null; email: string | null; crm: string | null; papel: "editor" | "revisor" };

/** A equipe científica: só o administrador da plataforma inclui, troca e tira. */
export function EquipeCientifica() {
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<"editor" | "revisor">("revisor");
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | null>(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vale = true;
    void createClient().rpc("intercorrencias_equipe_lista").then(({ data, error }) => {
      if (vale) setMembros(error ? [] : (data as Membro[]) ?? []);
    });
    return () => { vale = false; };
  }, [versao]);

  async function definir(alvo: string, novo: "editor" | "revisor" | null) {
    setRetorno(null);
    const { data, error } = await createClient().rpc("intercorrencias_definir_papel", { p_email: alvo, p_papel: novo });
    if (error) { setRetorno({ ok: false, texto: traduzirErro(error.message) }); return; }
    setRetorno({ ok: true, texto: novo ? `${data} agora é ${ROTULO_PAPEL[novo].toLowerCase()}.` : `${data} saiu da equipe.` });
    setEmail("");
    setVersao((v) => v + 1);
  }

  return (
    <section className={estilos.secao} aria-labelledby="t-equipe">
      <h3 id="t-equipe">Equipe científica</h3>
      <div className={estilos.pilha}>
        <p className={estilos.miuda}>
          Editor escreve e manda para revisão; revisor médico (com CRM no perfil) aprova, pede atualização ou suspende.
          Cada inclusão e saída fica registrada.
        </p>
        {membros === null ? <p className={estilos.vazio}>Carregando…</p> : membros.length === 0 ? (
          <p className={estilos.vazio}>Ninguém na equipe ainda.</p>
        ) : (
          <ul className={estilos.historico}>
            {membros.map((m) => (
              <li key={m.user_id}>
                <div>
                  <b>{m.nome ?? m.email}</b>
                  <span className={estilos.faixa}>{ROTULO_PAPEL[m.papel]}</span>
                  {m.crm && <span>{m.crm}</span>}
                </div>
                <div>
                  <span className={estilos.miuda}>{m.email}</span>
                  {m.email && (
                    <button type="button" className={`${estilos.botao} ${estilos.botaoPerigo}`} onClick={() => void definir(m.email!, null)}>
                      Tirar da equipe
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <form className={estilos.campos} onSubmit={(e) => { e.preventDefault(); if (email.trim()) void definir(email, papel); }}>
          <label className={estilos.campo} style={{ gridColumn: "span 2" }}>
            <span>E-mail do usuário</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </label>
          <label className={estilos.campo}>
            <span>Papel</span>
            <select value={papel} onChange={(e) => setPapel(e.target.value as "editor" | "revisor")}>
              <option value="revisor">Revisor médico</option>
              <option value="editor">Editor científico</option>
            </select>
          </label>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" className={`${estilos.botao} ${estilos.botaoForte}`} disabled={!email.trim()}>Incluir</button>
          </div>
        </form>
        {retorno && <p className={retorno.ok ? estilos.ok : estilos.erro} role="status">{retorno.texto}</p>}
      </div>
    </section>
  );
}
