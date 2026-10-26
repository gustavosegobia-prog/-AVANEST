"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Gaveta } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { divergeDoAnotado, padroesDaBusca, rotuloDoPorte } from "@/lib/honorarios-telas";
import { Etiqueta, dataBr, dinheiro, mensagemDoBanco } from "./comum";
import {
  calcularNoServidor, codigosSalvos, gravarCodigos, sugestoesDeCodigos, tussEmUso, type Codigo, type Resultado,
} from "./calculo-da-anestesia";
import estilos from "./honorarios.module.css";

// Conferir o honorário de uma anestesia da Produção: escolher os códigos TUSS
// dos procedimentos, marcar se foi urgência e calcular. A conta é feita no
// servidor (app/api/honorarios/calcular), com o contrato do convênio — que o
// médico não abre —, e o resultado volta com o que faltou, se faltou.

export type AnestesiaDaProducao = {
  id: string; data: string; paciente: string; convenio: string; procedimento: string | null;
  /** O valor que o médico anotou: o resultado diz quanto a tabela dá a mais ou a menos. */
  valor?: number | string | null;
  urgencia?: boolean | null; honorario_situacao?: string | null; honorario_valor_previsto?: number | string | null;
};

export type CamposDoHonorario = { honorario_situacao: string; honorario_valor_previsto: number | null; urgencia: boolean };

const ORIGEM = {
  valor_fixo_do_contrato: "Valor fixo da tabela do plano",
  porte_do_contrato: "Porte no contrato",
  referencia_cbhpm: "Referência da CBHPM",
} as const;

export function HonorarioDaAnestesia({
  anestesia, onFechar, onCalculado, onProxima,
}: {
  anestesia: AnestesiaDaProducao;
  onFechar: () => void;
  onCalculado: (id: string, campos: CamposDoHonorario) => void;
  /** A próxima anestesia do mês ainda sem cálculo; ausente quando não há. */
  onProxima?: () => void;
}) {
  const [codigos, setCodigos] = useState<Codigo[] | null>(null);
  const [urgencia, setUrgencia] = useState(Boolean(anestesia.urgencia));
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Codigo[]>([]);
  const [tussId, setTussId] = useState<string | null | undefined>(undefined);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // De quando é a sugestão de códigos (a última anotação com o mesmo procedimento).
  const [sugeridoDe, setSugeridoDe] = useState<string | null>(null);

  // Os códigos já escolhidos e a versão da TUSS em uso. Sem código ainda: os
  // da última anotação com o mesmo procedimento escrito, como sugestão; e,
  // sem sugestão, a busca já começa pelo procedimento da ficha.
  useEffect(() => {
    let valendo = true;
    void (async () => {
      const [salvos, tuss] = await Promise.all([codigosSalvos([anestesia.id]), tussEmUso()]);
      if (!valendo) return;
      setTussId(tuss);
      const deles = salvos.get(anestesia.id) ?? [];
      if (deles.length || !anestesia.procedimento?.trim()) {
        setCodigos(deles);
        return;
      }
      const sugestao = (await sugestoesDeCodigos([anestesia])).get(anestesia.id);
      if (!valendo) return;
      if (sugestao) {
        setCodigos(sugestao.codigos);
        setSugeridoDe(sugestao.data);
      } else {
        setCodigos([]);
        setBusca(anestesia.procedimento);
      }
    })();
    return () => { valendo = false; };
  }, [anestesia]);

  // A busca na TUSS em uso: o começo do código, ou um pedaço da descrição.
  useEffect(() => {
    const termo = busca.trim();
    if (!tussId || termo.length < 3) return;
    let valendo = true;
    const espera = setTimeout(async () => {
      const base = () => createClient().from("tuss_codigos").select("codigo, descricao").eq("versao_id", tussId).eq("situacao", "ativo");
      let achados: Codigo[] = [];
      if (/^[\d.\s-]+$/.test(termo)) {
        const { data } = await base().like("codigo", `${termo.replace(/\D/g, "")}%`).order("codigo").limit(8);
        achados = (data ?? []) as Codigo[];
      } else {
        // Todas as palavras primeiro; sem resultado, com uma palavra a menos.
        const padroes = padroesDaBusca(termo);
        for (let n = padroes.length; n > 0 && !achados.length && valendo; n--) {
          let q = base();
          for (const p of padroes.slice(0, n)) q = q.ilike("descricao", p);
          const { data } = await q.order("codigo").limit(8);
          achados = (data ?? []) as Codigo[];
        }
      }
      if (valendo) setAchados(achados);
    }, 250);
    return () => { valendo = false; clearTimeout(espera); };
  }, [busca, tussId]);

  /** Mudou o código, mudou a conta: o resultado antigo sai da tela. */
  function mudarCodigos(novos: Codigo[]) {
    setCodigos(novos);
    setSugeridoDe(null);
    setResultado(null);
  }

  function adicionar(c: Codigo) {
    if (codigos?.some((x) => x.codigo === c.codigo)) return;
    mudarCodigos([...(codigos ?? []), c]);
    setBusca("");
    setAchados([]);
  }

  function subir(i: number) {
    if (!codigos || i === 0) return;
    const novos = [...codigos];
    [novos[i - 1], novos[i]] = [novos[i], novos[i - 1]];
    mudarCodigos(novos);
  }

  async function calcular() {
    setCalculando(true);
    setErro("");
    setResultado(null);
    try {
      await gravarCodigos(anestesia.id, codigos ?? [], tussId ?? null);
      const r = await calcularNoServidor(anestesia.id, urgencia);
      setResultado(r);
      setSugeridoDe(null);
      onCalculado(anestesia.id, { honorario_situacao: r.situacao, honorario_valor_previsto: r.valorPrevisto, urgencia });
    } catch (e) {
      setErro(mensagemDoBanco(e, "Não foi possível calcular agora."));
    } finally {
      setCalculando(false);
    }
  }

  const m = resultado?.memoria;
  const anotado = Number(anestesia.valor ?? 0) || 0;
  const previsto = resultado?.valorPrevisto ?? null;

  // Depois de calcular, o rodapé fecha o assunto: pronto, ou a próxima do mês.
  const rodape = resultado ? (onProxima ? <>
    <button type="button" className="outlineClinical" onClick={onFechar}>Pronto</button>
    <button type="button" className={`primaryClinical compact ${estilos.comIcone}`} onClick={onProxima}>
      Próxima sem cálculo <Icone nome="avancar" tamanho={16} />
    </button>
  </> : (
    <button type="button" className="primaryClinical compact" onClick={onFechar}>Pronto</button>
  )) : <>
    <button type="button" className="outlineClinical" onClick={onFechar}>Fechar</button>
    <button type="button" className={`primaryClinical compact ${estilos.comIcone}`} onClick={calcular} disabled={calculando || !codigos?.length}>
      <Icone nome="calculadora" tamanho={16} /> {calculando ? "Calculando…" : "Calcular honorário"}
    </button>
  </>;

  return (
    <Gaveta titulo="Honorário da anestesia" onPedirFechar={onFechar}
      subtitulo={<>{anestesia.paciente} · {dataBr(anestesia.data)} · {anestesia.convenio}{anestesia.procedimento ? ` · ${anestesia.procedimento}` : ""}</>}
      rodape={rodape}>
      <div className="admCampos">
        {tussId === null && (
          <p className="clinicalError">A TUSS ainda não foi publicada: sem ela, o código do procedimento não é conferido.</p>
        )}
        <div className={estilos.bloco}>
          <h3>Procedimentos (código TUSS)</h3>
          <p className="admAjuda">O principal primeiro. Com mais de um, o contrato diz quanto vale cada um.</p>
          {codigos === null ? <p className="admTextoFraco" role="status">Carregando…</p> : codigos.length === 0 ? (
            <p className="admTextoFraco">Nenhum código escolhido ainda.</p>
          ) : (
            <ol className={estilos.codigosEscolhidos}>
              {codigos.map((c, i) => (
                <li key={c.codigo}>
                  <span className={estilos.codigo}>{c.codigo}</span>
                  <span>{c.descricao || "—"}</span>
                  <span className={estilos.acoesDoCodigo}>
                    {i > 0 && (
                      <button type="button" className={`outlineClinical compacto ${estilos.comIcone}`}
                        aria-label={`Subir ${c.codigo} para ${i}º`} onClick={() => subir(i)}>
                        <Icone nome="subir" tamanho={14} /> Subir
                      </button>
                    )}
                    <button type="button" className="outlineClinical compacto" aria-label={`Remover ${c.codigo}`}
                      onClick={() => mudarCodigos(codigos.filter((x) => x.codigo !== c.codigo))}>Remover</button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {sugeridoDe && codigos?.length ? (
            <p className="admNota" role="status">
              <Icone nome="alerta" tamanho={14} />
              Sugerido pelo que você usou em {dataBr(sugeridoDe)} para o mesmo procedimento. Confira antes de calcular.
            </p>
          ) : null}
          <label className="admBusca">
            <span className="sr-only">Buscar código TUSS</span>
            <Icone nome="busca" tamanho={16} />
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} disabled={!tussId}
              placeholder="Código TUSS ou nome do procedimento" />
          </label>
          {busca.trim().length >= 3 && achados.length > 0 && (
            <ul className={estilos.achados} aria-label="Códigos encontrados: escolha para acrescentar">
              {achados.map((c) => (
                <li key={c.codigo}>
                  <button type="button" onClick={() => adicionar(c)}>
                    <span className={estilos.codigo}>{c.codigo}</span><span>{c.descricao}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className={estilos.marca}>
          <input type="checkbox" checked={urgencia} onChange={(e) => { setUrgencia(e.target.checked); setResultado(null); }} />
          <span>Foi urgência</span>
        </label>

        {erro && <p className="clinicalError" role="alert">{erro}</p>}

        {resultado && m && (
          <div className={estilos.resultado} aria-live="polite">
            <p className={estilos.salvo}><Icone nome="confirmado" tamanho={15} /> Guardado na sua produção</p>
            <div className={estilos.resultadoTopo}>
              <div>
                <span>Valor previsto pela tabela</span>
                <strong>{previsto == null ? "Pendente" : dinheiro(previsto)}</strong>
              </div>
              <Etiqueta tom={resultado.situacao === "calculado" && !resultado.mensagem ? "ok" : "atencao"}>
                {resultado.situacao === "calculado" ? (resultado.mensagem ? "Calculado, com divergência" : "Calculado") : "Pendente de conferência"}
              </Etiqueta>
            </div>
            {previsto != null && divergeDoAnotado(previsto, anotado) && (
              <p className="admNota">
                <Icone nome="alerta" tamanho={14} />
                Você anotou {dinheiro(anotado)}: a tabela dá {dinheiro(Math.abs(previsto - anotado))}
                {previsto > anotado ? " a mais." : " a menos."}
              </p>
            )}
            {resultado.mensagem && <p className="admNota"><Icone nome="alerta" tamanho={14} />{resultado.mensagem}</p>}
            {resultado.pendencias.length > 0 && (
              <ul className={estilos.listaSimples}>{resultado.pendencias.map((p, i) => <li key={i}>{p.texto}</li>)}</ul>
            )}
            {m.linhas.length > 0 && (
              <table className={estilos.memoria}>
                <caption className="sr-only">De onde sai o valor previsto</caption>
                <thead>
                  <tr>
                    <th scope="col">Código</th><th scope="col">De onde vem</th>
                    <th scope="col" className={`${estilos.numero} ${estilos.memoriaLarga}`}>Base</th>
                    <th scope="col" className={`${estilos.numero} ${estilos.memoriaLarga}`}>%</th>
                    <th scope="col" className={estilos.numero}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {m.linhas.map((l) => (
                    <tr key={l.ordem}>
                      <td className={estilos.codigo}>{l.tussCodigo}</td>
                      <td>
                        {ORIGEM[l.origem]}
                        {l.porte != null && (
                          <span className={estilos.linhaFraca}>{rotuloDoPorte(l.porte)}{l.porteDe === "contrato" ? " da tabela do plano" : " da CBHPM"}</span>
                        )}
                        {/* No celular, base e percentual descem para cá: cinco colunas não cabem. */}
                        <span className={`${estilos.linhaFraca} ${estilos.memoriaEstreita}`}>{dinheiro(l.base)} × {l.percentual}%</span>
                      </td>
                      <td className={`${estilos.numero} ${estilos.memoriaLarga}`}>{dinheiro(l.base)}</td>
                      <td className={`${estilos.numero} ${estilos.memoriaLarga}`}>{l.percentual}%</td>
                      <td className={estilos.numero}><b>{dinheiro(l.valor)}</b></td>
                    </tr>
                  ))}
                </tbody>
                {(m.linhas.length > 1 || m.acrescimos.length > 0) && previsto != null && (
                  <tfoot>
                    {m.acrescimos.length > 0 && <>
                      {m.subtotal != null && <tr><th scope="row" colSpan={2}>Subtotal</th><td colSpan={2} className={estilos.memoriaLarga} /><td className={estilos.numero}>{dinheiro(m.subtotal)}</td></tr>}
                      {m.acrescimos.map((x) => (
                        <tr key={x.nome}>
                          <th scope="row" colSpan={2}>{x.nome} {x.tipo === "percentual" ? `(${x.parametro}%)` : "(valor fixo)"}</th><td colSpan={2} className={estilos.memoriaLarga} />
                          <td className={estilos.numero}>{x.valor < 0 ? "−" : "+"} {dinheiro(Math.abs(x.valor))}</td>
                        </tr>
                      ))}
                    </>}
                    <tr><th scope="row" colSpan={2}>Total</th><td colSpan={2} className={estilos.memoriaLarga} /><td className={estilos.numero}><b>{dinheiro(previsto)}</b></td></tr>
                  </tfoot>
                )}
              </table>
            )}
            {m.operadora && <p className="admAjuda">Contrato de {m.operadora}, versão {m.contratoVersao} · TUSS {m.tussVersao}</p>}
          </div>
        )}
      </div>
    </Gaveta>
  );
}

/**
 * O selo do honorário na linha da Produção. Quando o médico anotou um valor e
 * a tabela dá outro, o selo mostra os dois — é a divergência que importa.
 */
export function SeloDoHonorario({ situacao, valor, anotado, paciente, mascarar = (s) => s, onAbrir }: {
  situacao: string | null | undefined; valor: number | string | null | undefined;
  anotado?: number | string | null; paciente: string;
  /** O olho dos valores da Produção: escondido lá, escondido aqui. */
  mascarar?: (s: string) => string;
  onAbrir: () => void;
}) {
  const calculado = situacao === "calculado" || situacao === "conferido";
  const diverge = calculado && divergeDoAnotado(valor, anotado);
  const texto = diverge ? `Tabela ${mascarar(dinheiro(valor))} · anotado ${mascarar(dinheiro(anotado))}`
    : calculado ? `Honorário ${mascarar(dinheiro(valor))}`
    : situacao === "pendente" ? "Honorário pendente" : "Calcular honorário";
  const tom = diverge || situacao === "pendente" ? estilos.seloPendente : calculado ? estilos.seloOk : "";
  return (
    <button type="button" className={`${estilos.selo} ${tom}`} onClick={onAbrir} aria-label={`${texto}, ${paciente}`}>
      <Icone nome={diverge ? "alerta" : "calculadora"} tamanho={13} />{texto}
    </button>
  );
}
