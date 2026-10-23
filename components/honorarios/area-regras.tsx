"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { CabecalhoDeSecao } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { calcularHonorario, type ResultadoDoHonorario, type VersaoDeContrato } from "@/lib/honorarios";
import { edicaoCbhpm, tabelasDoCalculo, versoesPublicadas } from "@/lib/honorarios-dados";
import { rotuloDoPorte } from "@/lib/honorarios-telas";
import { Etiqueta, Recusa, dinheiro, exigir, lerNumero, percentual, useAcao } from "./comum";
import type { DadosDasTabelas } from "./tipos";
import estilos from "./honorarios.module.css";

const ORIGEM = {
  valor_fixo_do_contrato: "Valor fixo da tabela do plano",
  porte_do_contrato: "Valor do porte no contrato",
  referencia_cbhpm: "Referência da CBHPM",
} as const;

/**
 * Como o valor previsto é calculado — a mesma conta de lib/honorarios.ts que
 * a Produção vai usar — e um simulador que roda essa conta com as tabelas
 * desta clínica. A simulação não grava nada.
 */
export function AreaRegras({ dados, versoes }: { dados: DadosDasTabelas; versoes: VersaoDeContrato[] }) {
  return (
    <section className="admSecao">
      <CabecalhoDeSecao titulo="Regras de cálculo"
        descricao="O valor previsto segue o contrato do convênio, na data da anestesia. O que o contrato não disser fica pendente." />
      <div className={estilos.duasColunasIguais}>
        <ol className={estilos.passos}>
          <li><strong>Código TUSS</strong><span>Cada procedimento precisa de um código da TUSS em uso, ativo na data da anestesia.</span></li>
          <li><strong>Contrato</strong><span>A versão publicada do convênio que vale na data. O contrato do hospital vence o geral; dois gerais ao mesmo tempo ficam pendentes.</span></li>
          <li><strong>Porte anestésico</strong><span>O que a tabela do plano dá ao código. Se o código não está na tabela do plano, o da CBHPM, pela correspondência TUSS ↔ CBHPM validada.</span></li>
          <li><strong>Valor de cada procedimento</strong><span>Na ordem: valor fixo do procedimento na tabela do plano; valor do porte no contrato; valor de referência da CBHPM com o reajuste do contrato.</span></li>
          <li><strong>Procedimentos múltiplos</strong><span>Do maior valor para o menor, cada um pelo percentual que o contrato diz.</span></li>
          <li><strong>Urgência, adicionais e redutores</strong><span>Somados sobre o subtotal, ou um sobre o outro, como o contrato definir. Valores fixos entram por último.</span></li>
          <li><strong>Centavos</strong><span>A conta é feita em centavos, arredondando cada passo para o centavo.</span></li>
        </ol>
        <div className={estilos.bloco}>
          <h4>Fica pendente, sem valor presumido</h4>
          <ul className={estilos.listaSimples}>
            <li>Sem TUSS publicada, sem código escolhido, código inexistente, substituído ou fora da vigência.</li>
            <li>Convênio sem contrato na data, ou com dois contratos possíveis.</li>
            <li>Código fora da tabela do plano e sem correspondência validada com a CBHPM; procedimento sem porte; porte sem valor.</li>
            <li>Urgência ou mais de um procedimento quando o contrato não prevê.</li>
            <li>O mesmo procedimento duas vezes, ou já lançado para o paciente no dia.</li>
          </ul>
          <p className="admAjuda">Calculado o valor, ele fica guardado com a memória do cálculo. Tabela atualizada depois não muda o que já foi calculado.</p>
        </div>
      </div>
      <Simulador dados={dados} versoes={versoes} />
    </section>
  );
}

function Simulador({ dados, versoes }: { dados: DadosDasTabelas; versoes: VersaoDeContrato[] }) {
  const convenios = [...new Set(versoes.filter((v) => v.situacao !== "rascunho").map((v) => v.operadora))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const [f, setF] = useState({ convenio: convenios[0] ?? "", local: "", data: dados.hoje, urgencia: false, codigos: ["", "", ""], informado: "" });
  const [resultado, setResultado] = useState<ResultadoDoHonorario | null>(null);
  const acao = useAcao();

  async function calcular() {
    setResultado(null);
    await acao.executar(async () => {
      const codigos = f.codigos.map((c) => c.replace(/\D/g, "")).filter(Boolean);
      if (!f.convenio.trim()) throw new Recusa("Informe o convênio.");
      if (!codigos.length) throw new Recusa("Informe ao menos um código TUSS.");
      const informado = lerNumero(f.informado);
      if (informado !== null && !(informado >= 0)) throw new Recusa("O valor anotado não é um número válido.");
      const supabase = createClient();
      const vigente = dados.tuss.find((t) => t.situacao === "vigente") ?? null;
      const tussCodigos = vigente ? exigir(await supabase.from("tuss_codigos")
        .select("codigo, descricao, situacao, substituido_por, inicio_vigencia, fim_vigencia")
        .eq("versao_id", vigente.id).in("codigo", codigos)) ?? [] : [];
      const correspondencias = exigir(await supabase.from("tuss_cbhpm_correspondencias")
        .select("tuss_codigo, cbhpm_edicao_id, cbhpm_codigo, situacao")
        .eq("institution_id", dados.institutionId).eq("situacao", "validada").in("tuss_codigo", codigos)) ?? [];
      // Só edição publicada entra na conta: a que está em conferência ainda não vale.
      const publicadas = dados.edicoes.filter((e) => e.situacao !== "em_conferencia");
      const cbhpm = [...new Set((correspondencias as Array<{ cbhpm_codigo: string }>).map((c) => c.cbhpm_codigo))];
      const procedimentos = cbhpm.length && publicadas.length ? exigir(await supabase.from("cbhpm_procedimentos")
        .select("edicao_id, codigo, porte_anestesico").in("edicao_id", publicadas.map((e) => e.id)).in("codigo", cbhpm)) ?? [] : [];
      const procs = procedimentos as Array<{ edicao_id: string; codigo: string; porte_anestesico: number | null }>;
      const t = tabelasDoCalculo({
        tussVersao: vigente ? { id: vigente.id, versao: vigente.versao } : null,
        tussCodigos: tussCodigos as Parameters<typeof tabelasDoCalculo>[0]["tussCodigos"],
        correspondencias: correspondencias as Parameters<typeof tabelasDoCalculo>[0]["correspondencias"],
        edicoes: publicadas.map((e) => edicaoCbhpm(e, procs.filter((p) => p.edicao_id === e.id),
          dados.portes.filter((p) => p.edicao_id === e.id))),
        contratos: versoesPublicadas(dados.versoes, dados.contratos, dados.operadoras, dados.valoresPorPorte, dados.valoresPorProcedimento),
      });
      setResultado(calcularHonorario({
        data: f.data, convenio: f.convenio, localId: f.local || null, urgencia: f.urgencia,
        procedimentos: f.codigos.map((c) => c.replace(/\D/g, "")).filter(Boolean), valorInformado: informado,
      }, t));
    }, "Não foi possível ler as tabelas para simular.");
  }

  return (
    <article className={estilos.painel} aria-label="Simulador">
      <header className={estilos.painelTopo}>
        <div>
          <h3>Simular um honorário</h3>
          <p>Roda a mesma conta da Produção com as tabelas publicadas. Nada é gravado.</p>
        </div>
      </header>
      <div className={estilos.camposEmLinha}>
        <label className={`clinicalField ${estilos.campoMedio}`}><span>Convênio</span>
          <input list="convenios-do-simulador" value={f.convenio} onChange={(e) => setF({ ...f, convenio: e.target.value })} placeholder="Como aparece na Produção" />
          <datalist id="convenios-do-simulador">{convenios.map((c) => <option key={c} value={c} />)}</datalist></label>
        <label className="clinicalField"><span>Hospital</span>
          <select value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })}>
            <option value="">Não informado</option>
            {dados.locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select></label>
        <label className="clinicalField"><span>Data da anestesia</span>
          <input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></label>
        <label className={`admFiltroMarca ${estilos.marcaNaLinha}`}><input type="checkbox" checked={f.urgencia} onChange={(e) => setF({ ...f, urgencia: e.target.checked })} />
          <span>Urgência</span></label>
      </div>
      <div className={estilos.camposEmLinha}>
        {f.codigos.map((c, i) => (
          <label key={i} className="clinicalField"><span>{i === 0 ? "Procedimento principal (TUSS)" : `Procedimento ${i + 1} (TUSS)`}</span>
            <input inputMode="numeric" value={c} onChange={(e) => setF({ ...f, codigos: f.codigos.map((x, j) => j === i ? e.target.value : x) })} /></label>
        ))}
        <label className="clinicalField"><span>Valor anotado (opcional)</span>
          <input inputMode="decimal" value={f.informado} onChange={(e) => setF({ ...f, informado: e.target.value })} placeholder="R$" /></label>
      </div>
      <div className={estilos.rodapeDoBloco}>
        <button type="button" className={`primaryClinical compact ${estilos.comIcone}`} onClick={calcular} disabled={acao.ocupado}>
          <Icone nome="calculadora" tamanho={16} /> {acao.ocupado ? "Calculando…" : "Calcular"}
        </button>
      </div>
      {acao.erro && <p className="clinicalError" role="alert">{acao.erro}</p>}
      {resultado && <Resultado r={resultado} />}
    </article>
  );
}

function Resultado({ r }: { r: ResultadoDoHonorario }) {
  const m = r.memoria;
  return (
    <div className={estilos.resultado} aria-live="polite">
      <div className={estilos.resultadoTopo}>
        <div>
          <span>Valor previsto</span>
          <strong>{r.valorPrevisto == null ? "Pendente" : dinheiro(r.valorPrevisto)}</strong>
        </div>
        <Etiqueta tom={r.situacao === "calculado" && !r.mensagem ? "ok" : "atencao"}>
          {r.situacao === "calculado" ? (r.mensagem ? "Calculado, com divergência" : "Calculado") : "Pendente de conferência"}
        </Etiqueta>
      </div>
      {r.mensagem && <p className="admNota"><Icone nome="alerta" tamanho={14} />{r.mensagem}</p>}
      {r.pendencias.length > 0 && (
        <ul className={estilos.listaSimples}>
          {r.pendencias.map((p, i) => <li key={i}>{p.texto}</li>)}
        </ul>
      )}
      {m.linhas.length > 0 && (
        <div className={estilos.tabelaRolagem}>
          <table className="admTabela">
            <thead><tr><th>Ordem</th><th>TUSS</th><th>CBHPM</th><th>Porte</th><th>Base</th><th>Origem</th><th>%</th><th>Valor</th></tr></thead>
            <tbody>
              {m.linhas.map((l) => (
                <tr key={l.ordem}>
                  <td data-rotulo="Ordem" className={estilos.numero}>{l.ordem}</td>
                  <td data-rotulo="TUSS" data-largo><span className={estilos.codigo}>{l.tussCodigo}</span>{l.descricao && <small className={estilos.linhaFraca}>{l.descricao}</small>}</td>
                  <td data-rotulo="CBHPM" className={estilos.codigo}>{l.cbhpmCodigo ?? "—"}</td>
                  <td data-rotulo="Porte">{l.porte == null ? "—" : rotuloDoPorte(l.porte)}
                    {l.porteDe && <small className={estilos.linhaFraca}>{l.porteDe === "contrato" ? "da tabela do plano" : "da CBHPM"}</small>}</td>
                  <td data-rotulo="Base" className={estilos.numero}>{dinheiro(l.base)}</td>
                  <td data-rotulo="Origem">{ORIGEM[l.origem]}</td>
                  <td data-rotulo="%" className={estilos.numero}>{percentual(l.percentual)}</td>
                  <td data-rotulo="Valor" className={estilos.numero}>{dinheiro(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {m.acrescimos.length > 0 && (
        <ul className={estilos.listaSimples}>
          {m.acrescimos.map((a, i) => <li key={i}>{a.nome}: {a.tipo === "percentual" ? percentual(a.parametro) : dinheiro(a.parametro)} = {dinheiro(a.valor)}</li>)}
        </ul>
      )}
      <dl className={estilos.regras}>
        <div><dt>TUSS</dt><dd>{m.tussVersao ?? "—"}</dd></div>
        <div><dt>Contrato</dt><dd>{m.operadora ? `${m.operadora} · versão ${m.contratoVersao}` : "—"}</dd></div>
        <div><dt>Referência</dt><dd>{m.referencia === "cbhpm" ? `CBHPM ${m.cbhpmEdicao ?? ""}${m.reajustePercentual ? ` · reajuste ${percentual(m.reajustePercentual)}` : ""}` : m.referencia === "propria" ? "Tabela própria" : "—"}</dd></div>
        <div><dt>Subtotal</dt><dd>{m.subtotal == null ? "—" : dinheiro(m.subtotal)}</dd></div>
      </dl>
      {m.regra.length > 0 && (
        <details className={estilos.detalhes}><summary>Memória do cálculo</summary>
          <ol className={estilos.listaSimples}>{m.regra.map((x, i) => <li key={i}>{x}</li>)}</ol>
        </details>
      )}
    </div>
  );
}
