"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CabecalhoDeSecao, Dialogo } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { Aviso, Etiqueta, Vazio, dataBr, dataHoraBr, exigir, useAcao, type Tom } from "./comum";
import type { PedidoDeImportacao } from "./area-importar";
import type { DadosDasTabelas, LinhaTussVersao } from "./tipos";
import estilos from "./honorarios.module.css";

const SITUACAO: Record<LinhaTussVersao["situacao"], [string, Tom]> = {
  em_conferencia: ["Em conferência", "atencao"],
  vigente: ["Publicada", "ok"],
  substituida: ["Substituída", "neutra"],
};

type CodigoAchado = {
  codigo: string; descricao: string; inicio_vigencia: string | null; fim_vigencia: string | null;
  situacao: "ativo" | "inativo" | "substituido"; substituido_por: string | null;
};

const LIMITE = 50;

/**
 * A TUSS (Tabela 22 da ANS): consultar código e descrição, e as versões
 * importadas. Importar e publicar são da plataforma (super-admin); a clínica
 * só lê. A descrição aparece como a ANS publicou.
 */
export function AreaTuss({
  dados, onImportar, onAtualizar,
}: {
  dados: DadosDasTabelas;
  onImportar: (p: PedidoDeImportacao) => void;
  onAtualizar: () => void;
}) {
  const vigente = dados.tuss.find((t) => t.situacao === "vigente");
  const [versaoId, setVersaoId] = useState(vigente?.id ?? dados.tuss[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<CodigoAchado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroDaBusca, setErroDaBusca] = useState("");
  const [publicar, setPublicar] = useState<LinhaTussVersao | null>(null);
  const [descartar, setDescartar] = useState<LinhaTussVersao | null>(null);
  const acao = useAcao();

  // A busca anda enquanto se digita, com uma pausa para não pedir a cada tecla.
  useEffect(() => {
    const termo = busca.trim();
    if (!versaoId || termo.length < 2) return;
    let valendo = true;
    const espera = setTimeout(async () => {
      setBuscando(true);
      let q = createClient().from("tuss_codigos")
        .select("codigo, descricao, inicio_vigencia, fim_vigencia, situacao, substituido_por")
        .eq("versao_id", versaoId);
      const digitos = termo.replace(/\D/g, "");
      // Só número: o começo do código. Com letra: um pedaço da descrição.
      q = /^[\d.\s-]+$/.test(termo) ? q.like("codigo", `${digitos}%`) : q.ilike("descricao", `%${termo.replace(/[%_]/g, "")}%`);
      const { data, error } = await q.order("codigo").limit(LIMITE + 1);
      if (!valendo) return;
      setBuscando(false);
      setErroDaBusca(error ? "Não foi possível consultar a TUSS agora." : "");
      setAchados((data ?? []) as CodigoAchado[]);
    }, 250);
    return () => { valendo = false; clearTimeout(espera); };
  }, [busca, versaoId]);

  async function confirmarPublicacao() {
    if (!publicar) return;
    const ok = await acao.executar(async () => {
      exigir(await createClient().rpc("publicar_versao_tuss", { p_versao_id: publicar.id }));
    });
    if (ok) { setPublicar(null); onAtualizar(); }
  }

  async function confirmarDescarte() {
    if (!descartar) return;
    const ok = await acao.executar(async () => {
      const supabase = createClient();
      // Os códigos antes da versão: a versão não se apaga com código dentro.
      exigir(await supabase.from("tuss_codigos").delete().eq("versao_id", descartar.id));
      exigir(await supabase.from("tuss_versoes").delete().eq("id", descartar.id));
      exigir(await supabase.from("importacoes_tabelas").update({ situacao: "descartada" })
        .eq("tipo", "tuss").eq("destino_id", descartar.id));
    });
    if (ok) { setDescartar(null); onAtualizar(); }
  }

  const termo = busca.trim();
  const versaoEscolhida = dados.tuss.find((t) => t.id === versaoId);

  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Consulta TUSS"
        descricao="Tabela 22 da ANS — procedimentos e eventos em saúde. A descrição aparece exatamente como a ANS publicou."
        acao={dados.superAdmin ? (
          <button type="button" className="primaryClinical compact" onClick={() => onImportar({ tipo: "tuss" })}>
            Importar versão da ANS
          </button>
        ) : undefined} />

      {dados.tuss.length === 0 ? (
        <Vazio titulo="Nenhuma versão da TUSS importada.">
          A tabela vem do arquivo oficial da ANS (Padrão TISS — Representação de Conceitos em Saúde). Enquanto ela
          não for importada e publicada, todo honorário fica pendente.
        </Vazio>
      ) : (
        <>
          <div className={estilos.busca}>
            <label className="admBusca">
              <span className="sr-only">Código ou descrição</span>
              <Icone nome="busca" tamanho={16} />
              <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                placeholder="Código (31602…) ou parte da descrição" autoComplete="off" />
            </label>
            <label className={estilos.campoCurto}>
              <span>Versão</span>
              <select value={versaoId} onChange={(e) => setVersaoId(e.target.value)}>
                {dados.tuss.map((t) => (
                  <option key={t.id} value={t.id}>{t.versao} · {SITUACAO[t.situacao][0]}</option>
                ))}
              </select>
            </label>
          </div>
          {versaoEscolhida && versaoEscolhida.situacao !== "vigente" && (
            <Aviso tom="atencao">
              Consultando a versão {versaoEscolhida.versao}, que não é a usada no cálculo.
            </Aviso>
          )}
          {erroDaBusca && <p className="clinicalError" role="alert">{erroDaBusca}</p>}
          {termo.length < 2 ? (
            <p className="admTextoFraco">Digite ao menos dois caracteres do código ou da descrição.</p>
          ) : buscando && !achados ? (
            <p className="admTextoFraco" role="status">Buscando…</p>
          ) : achados && achados.length === 0 ? (
            <Vazio titulo={`Nada encontrado para “${termo}”.`}>Confira o código ou tente outra palavra da descrição.</Vazio>
          ) : achados && (
            <div className={estilos.tabelaRolagem} aria-busy={buscando}>
              <table className="admTabela">
                <thead>
                  <tr><th>Código</th><th>Descrição</th><th>Vigência</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  {achados.slice(0, LIMITE).map((c) => (
                    <tr key={c.codigo}>
                      <td data-rotulo="Código" className={estilos.codigo}>{c.codigo}</td>
                      <td data-rotulo="Descrição" data-largo>{c.descricao}</td>
                      <td data-rotulo="Vigência" className={estilos.semQuebra}>
                        {dataBr(c.inicio_vigencia)}{c.fim_vigencia ? ` a ${dataBr(c.fim_vigencia)}` : ""}
                      </td>
                      <td data-rotulo="Situação">
                        {c.situacao === "ativo" ? <Etiqueta tom="ok">Ativo</Etiqueta>
                          : c.situacao === "inativo" ? <Etiqueta tom="neutra">Fora de vigência</Etiqueta>
                          : <Etiqueta tom="atencao">Substituído{c.substituido_por ? ` por ${c.substituido_por}` : ""}</Etiqueta>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {achados.length > LIMITE && (
                <p className="admTextoFraco">Mostrando os {LIMITE} primeiros. Digite mais do código ou da descrição.</p>
              )}
            </div>
          )}
        </>
      )}

      {dados.tuss.length > 0 && (
        <>
          <h3 className={estilos.subtitulo}>Versões importadas</h3>
          <div className={estilos.tabelaRolagem}>
            <table className="admTabela">
              <thead>
                <tr><th>Versão</th><th>Situação</th><th>Códigos</th><th>Origem</th><th>Importada</th><th><span className="sr-only">Ações</span></th></tr>
              </thead>
              <tbody>
                {dados.tuss.map((t) => (
                  <tr key={t.id}>
                    <td data-rotulo="Versão"><strong>{t.versao}</strong>{t.publicada_em && <small className={estilos.linhaFraca}>ANS: {dataBr(t.publicada_em)}</small>}</td>
                    <td data-rotulo="Situação"><Etiqueta tom={SITUACAO[t.situacao][1]}>{SITUACAO[t.situacao][0]}</Etiqueta></td>
                    <td data-rotulo="Códigos" className={estilos.numero}>{t.total_codigos.toLocaleString("pt-BR")}</td>
                    <td data-rotulo="Origem" data-largo>
                      {t.origem}
                      {t.arquivo_nome && <small className={estilos.linhaFraca} title={t.arquivo_sha256 ?? undefined}>{t.arquivo_nome}</small>}
                    </td>
                    <td data-rotulo="Importada" className={estilos.semQuebra}>{dataHoraBr(t.importada_em)}</td>
                    <td data-rotulo="Ações" className={estilos.acoesDaLinha}>
                      {dados.superAdmin && t.situacao === "em_conferencia" && (
                        <>
                          <button type="button" className="primaryClinical compact" onClick={() => { acao.setErro(""); setPublicar(t); }}>Publicar</button>
                          <button type="button" className="outlineClinical compacto" onClick={() => { acao.setErro(""); setDescartar(t); }}>Descartar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {publicar && (
        <Dialogo titulo={`Publicar a TUSS ${publicar.versao}?`} confirmar="Publicar" ocupado={acao.ocupado} erro={acao.erro}
          onConfirmar={confirmarPublicacao} onCancelar={() => setPublicar(null)}>
          <p>
            Os {publicar.total_codigos.toLocaleString("pt-BR")} códigos desta versão passam a valer para os cálculos novos
            {vigente ? <>, e a versão {vigente.versao} fica como substituída</> : null}.
          </p>
          <p>Honorários já calculados continuam com a versão com que foram calculados. Publicada, a versão não muda mais.</p>
        </Dialogo>
      )}
      {descartar && (
        <Dialogo titulo={`Descartar a TUSS ${descartar.versao}?`} confirmar="Descartar" perigo ocupado={acao.ocupado} erro={acao.erro}
          onConfirmar={confirmarDescarte} onCancelar={() => setDescartar(null)}>
          <p>A versão em conferência e os códigos importados com ela são apagados. A importação fica no histórico como descartada.</p>
        </Dialogo>
      )}
    </section>
  );
}
