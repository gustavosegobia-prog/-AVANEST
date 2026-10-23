"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CabecalhoDeSecao } from "@/components/admin-ui";
import { descreverAlteracao, type LinhaDeAuditoria } from "@/lib/honorarios-telas";
import { Etiqueta, Vazio, dataHoraBr, type Tom } from "./comum";
import type { DadosDasTabelas, LinhaImportacao } from "./tipos";
import estilos from "./honorarios.module.css";

const TIPO: Record<LinhaImportacao["tipo"], string> = {
  tuss: "TUSS", cbhpm: "CBHPM", contrato: "Contrato", correspondencia: "Correspondências",
};
const SITUACAO: Record<LinhaImportacao["situacao"], [string, Tom]> = {
  previa: ["Interrompida", "atencao"], aplicada: ["Aplicada", "ok"], descartada: ["Descartada", "neutra"],
};

type Alteracao = LinhaDeAuditoria & { id: string; created_at: string; actor_id: string | null };

/**
 * O que foi importado e o que foi alterado nas tabelas, com quem e quando.
 * As alterações vêm da auditoria (gatilho audita_honorarios), que só o
 * administrador da organização lê.
 */
export function AreaHistorico({ dados }: { dados: DadosDasTabelas }) {
  const [alteracoes, setAlteracoes] = useState<Alteracao[] | null>(null);
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());
  const [semAcesso, setSemAcesso] = useState(false);

  useEffect(() => {
    let valendo = true;
    (async () => {
      const supabase = createClient();
      const [a, p] = await Promise.all([
        supabase.from("auditoria").select("id, created_at, actor_id, tabela, acao, dados_anteriores, dados_novos")
          .eq("institution_id", dados.institutionId).contains("detalhes", { modulo: "honorarios" })
          .order("created_at", { ascending: false }).limit(100),
        supabase.from("perfis").select("id, nome").eq("institution_id", dados.institutionId),
      ]);
      if (!valendo) return;
      setSemAcesso(Boolean(a.error));
      setAlteracoes((a.data ?? []) as Alteracao[]);
      setNomes(new Map(((p.data ?? []) as Array<{ id: string; nome: string }>).map((x) => [x.id, x.nome])));
    })();
    return () => { valendo = false; };
  }, [dados.institutionId]);

  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Histórico" descricao="Cada arquivo importado e cada alteração nas tabelas, com quem fez e quando." />

      <h3 className={estilos.subtitulo}>Importações</h3>
      {dados.importacoes.length === 0 ? (
        <Vazio titulo="Nenhum arquivo importado ainda." />
      ) : (
        <div className={estilos.tabelaRolagem}>
          <table className="admTabela">
            <thead><tr><th>Quando</th><th>Tipo</th><th>Arquivo</th><th>Linhas</th><th>Situação</th></tr></thead>
            <tbody>
              {dados.importacoes.map((i) => (
                <tr key={i.id}>
                  <td data-rotulo="Quando" className={estilos.semQuebra}>{dataHoraBr(i.created_at)}</td>
                  <td data-rotulo="Tipo">{TIPO[i.tipo]}</td>
                  <td data-rotulo="Arquivo" data-largo>
                    {i.arquivo_nome}
                    <small className={estilos.linhaFraca} title={i.arquivo_sha256}>impressão {i.arquivo_sha256.slice(0, 12)}{i.origem ? ` · ${i.origem}` : ""}</small>
                    {i.erros.length > 0 && (
                      <details className={estilos.detalhes}>
                        <summary>{i.erros.length.toLocaleString("pt-BR")} {i.erros.length === 1 ? "linha com erro" : "linhas com erro"}</summary>
                        <ul className={estilos.listaSimples}>
                          {i.erros.slice(0, 50).map((e, k) => <li key={k}>Linha {e.linha}: {e.mensagem}</li>)}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td data-rotulo="Linhas válidas" className={estilos.numero}>{i.linhas_validas.toLocaleString("pt-BR")} de {i.linhas_total.toLocaleString("pt-BR")}</td>
                  <td data-rotulo="Situação"><Etiqueta tom={SITUACAO[i.situacao][1]}>{SITUACAO[i.situacao][0]}</Etiqueta></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className={estilos.subtitulo}>Alterações</h3>
      {alteracoes === null ? <p className="admTextoFraco" role="status">Carregando…</p>
        : semAcesso ? <p className="admTextoFraco">Só o administrador da organização vê as alterações detalhadas.</p>
        : alteracoes.length === 0 ? <Vazio titulo="Nenhuma alteração registrada ainda." />
        : (
          <div className={estilos.tabelaRolagem}>
            <table className="admTabela">
              <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th></tr></thead>
              <tbody>
                {alteracoes.map((a) => {
                  const d = descreverAlteracao(a);
                  return (
                    <tr key={a.id}>
                      <td data-rotulo="Quando" className={estilos.semQuebra}>{dataHoraBr(a.created_at)}</td>
                      <td data-rotulo="Quem">{a.actor_id ? nomes.get(a.actor_id) ?? "Outra conta" : "Sistema"}</td>
                      <td data-rotulo="O quê" data-largo>{d.oQue}</td>
                      <td data-rotulo="Detalhe">{d.detalhe || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </section>
  );
}
