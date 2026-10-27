"use client";

import { useEffect, useState } from "react";
import { Gaveta } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { divergeDoAnotado, rotuloDoPorte, type MarcaDaClinica } from "@/lib/honorarios-telas";
import { Etiqueta, dataBr, dinheiro, mensagemDoBanco } from "./comum";
import {
  calcularNoServidor, codigosSalvos, conferirNoServidor, ensinarProcedimento, gravarCodigos, marcasDaClinica,
  sugestoesDeCodigos, tussEmUso, type Codigo, type Modo, type Resultado, type Sugestao,
} from "./calculo-da-anestesia";
import { BuscaNaTuss, CodigosEscolhidos } from "./escolha-de-codigos";
import estilos from "./honorarios.module.css";

// Conferir o honorário de uma anestesia da Produção: escolher os códigos TUSS
// dos procedimentos, marcar se foi urgência e as marcas da clínica, e
// calcular. A conta é feita no servidor (app/api/honorarios/calcular), com o
// contrato do convênio — que o médico não abre —, e o resultado volta com o
// que faltou, se faltou.
//
// Dois modos. O médico, na Produção dele, marca a urgência e as marcas. O
// Financeiro, na produção que a equipe enviou, fecha os códigos e confere: a
// urgência e as marcas aparecem como o médico deixou, e cada conferência
// ensina a lista da clínica (o nome do procedimento → os códigos).

export type AnestesiaDaProducao = {
  id: string; data: string; paciente: string; convenio: string; procedimento: string | null;
  /** O valor que o médico anotou: o resultado diz quanto a tabela dá a mais ou a menos. */
  valor?: number | string | null;
  urgencia?: boolean | null; honorario_situacao?: string | null; honorario_valor_previsto?: number | string | null;
  /** As marcas da clínica que o médico marcou (cada uma puxa um código a mais). */
  marcas?: string[] | null;
  /** Quem anotou — o Financeiro vê a produção da equipe inteira. */
  profissional?: string | null;
};

export type CamposDoHonorario = {
  honorario_situacao: string; honorario_valor_previsto: number | null; urgencia?: boolean; marcas?: string[];
};

/** O texto do que veio pronto: da lista da clínica, ou de uma anotação anterior. */
export function origemDaSugestao(s: Sugestao): string {
  return s.daLista
    ? "Código da lista da clínica para este procedimento."
    : `Sugerido pelo que foi usado em ${dataBr(s.data)} para o mesmo procedimento.`;
}

const ORIGEM = {
  valor_fixo_do_contrato: "Valor fixo da tabela do plano",
  porte_do_contrato: "Porte no contrato",
  referencia_cbhpm: "Referência da CBHPM",
} as const;

export function HonorarioDaAnestesia({
  anestesia, modo = "medico", onFechar, onCalculado, onProxima, onConferida,
}: {
  anestesia: AnestesiaDaProducao;
  modo?: Modo;
  onFechar: () => void;
  onCalculado: (id: string, campos: CamposDoHonorario) => void;
  /** A próxima anestesia do mês ainda sem cálculo; ausente quando não há. */
  onProxima?: () => void;
  /** Financeiro: o honorário desta anestesia foi dado por conferido. */
  onConferida?: (id: string) => void;
}) {
  const doFinanceiro = modo === "financeiro";
  const [codigos, setCodigos] = useState<Codigo[] | null>(null);
  const [urgencia, setUrgencia] = useState(Boolean(anestesia.urgencia));
  const [marcas, setMarcas] = useState<string[]>(anestesia.marcas ?? []);
  const [listaDeMarcas, setListaDeMarcas] = useState<MarcaDaClinica[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const [conferida, setConferida] = useState(false);
  const [busca, setBusca] = useState("");
  const [tussId, setTussId] = useState<string | null | undefined>(undefined);
  const [calculando, setCalculando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // De onde vieram os códigos sugeridos: a lista da clínica ou uma anotação anterior.
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);

  // Os códigos já escolhidos e a versão da TUSS em uso. Sem código ainda: os
  // da última anotação com o mesmo procedimento escrito, como sugestão; e,
  // sem sugestão, a busca já começa pelo procedimento da ficha.
  useEffect(() => {
    let valendo = true;
    void (async () => {
      const [salvos, tuss, daClinica] = await Promise.all([codigosSalvos([anestesia.id]), tussEmUso(), marcasDaClinica()]);
      if (!valendo) return;
      setTussId(tuss);
      setListaDeMarcas(daClinica);
      const deles = salvos.get(anestesia.id) ?? [];
      if (deles.length || !anestesia.procedimento?.trim()) {
        setCodigos(deles);
        return;
      }
      const achada = (await sugestoesDeCodigos([anestesia], modo)).get(anestesia.id);
      if (!valendo) return;
      if (achada) {
        setCodigos(achada.codigos);
        setSugestao(achada);
      } else {
        setCodigos([]);
        setBusca(anestesia.procedimento);
      }
    })();
    return () => { valendo = false; };
  }, [anestesia, modo]);

  /** Mudou o código, mudou a conta: o resultado antigo sai da tela. */
  function mudarCodigos(novos: Codigo[]) {
    setCodigos(novos);
    setSugestao(null);
    setResultado(null);
  }

  function adicionar(c: Codigo) {
    if (codigos?.some((x) => x.codigo === c.codigo)) return;
    mudarCodigos([...(codigos ?? []), c]);
  }

  async function calcular() {
    setCalculando(true);
    setErro("");
    setResultado(null);
    try {
      await gravarCodigos(anestesia.id, codigos ?? [], tussId ?? null);
      // A urgência e as marcas vão só pelo médico: no Financeiro ficam como ele deixou.
      const r = doFinanceiro
        ? await calcularNoServidor(anestesia.id)
        : await calcularNoServidor(anestesia.id, urgencia, marcas);
      setResultado(r);
      setSugestao(null);
      setConferida(false);
      if (doFinanceiro) void ensinarProcedimento(anestesia.procedimento, codigos ?? []);
      onCalculado(anestesia.id, doFinanceiro
        ? { honorario_situacao: r.situacao, honorario_valor_previsto: r.valorPrevisto }
        : { honorario_situacao: r.situacao, honorario_valor_previsto: r.valorPrevisto, urgencia, marcas });
    } catch (e) {
      setErro(mensagemDoBanco(e, "Não foi possível calcular agora."));
    } finally {
      setCalculando(false);
    }
  }

  /** Financeiro: dá por conferido o honorário que acabou de sair. */
  async function conferir() {
    setConferindo(true);
    setErro("");
    try {
      const feitas = await conferirNoServidor([anestesia.id]);
      if (feitas.includes(anestesia.id)) {
        setConferida(true);
        onConferida?.(anestesia.id);
      }
    } catch (e) {
      setErro(mensagemDoBanco(e, "Não foi possível conferir agora."));
    } finally {
      setConferindo(false);
    }
  }

  const m = resultado?.memoria;
  const anotado = Number(anestesia.valor ?? 0) || 0;
  const previsto = resultado?.valorPrevisto ?? null;
  // As marcas que aparecem: as ativas, e a desativada que esta anestesia já tinha.
  const marcasNaTela = listaDeMarcas.filter((x) => x.ativo !== false || marcas.includes(x.id));
  const nomesMarcados = listaDeMarcas.filter((x) => marcas.includes(x.id)).map((x) => x.nome);
  const podeConferir = doFinanceiro && resultado?.situacao === "calculado" && !conferida;

  // Depois de calcular, o rodapé fecha o assunto: conferir (no Financeiro),
  // pronto, ou a próxima.
  const rodape = resultado ? <>
    <button type="button" className={onProxima || podeConferir ? "outlineClinical" : "primaryClinical compact"} onClick={onFechar}>Pronto</button>
    {podeConferir && (
      <button type="button" className={`${onProxima ? "outlineClinical" : "primaryClinical compact"} ${estilos.comIcone}`}
        onClick={() => void conferir()} disabled={conferindo}>
        <Icone nome="confirmado" tamanho={16} /> {conferindo ? "Conferindo…" : "Marcar como conferido"}
      </button>
    )}
    {onProxima && (
      <button type="button" className={`primaryClinical compact ${estilos.comIcone}`} onClick={onProxima}>
        {doFinanceiro ? "Próxima" : "Próxima sem cálculo"} <Icone nome="avancar" tamanho={16} />
      </button>
    )}
  </> : <>
    <button type="button" className="outlineClinical" onClick={onFechar}>Fechar</button>
    <button type="button" className={`primaryClinical compact ${estilos.comIcone}`} onClick={calcular} disabled={calculando || !codigos?.length}>
      <Icone nome="calculadora" tamanho={16} /> {calculando ? "Calculando…" : "Calcular honorário"}
    </button>
  </>;

  return (
    <Gaveta titulo="Honorário da anestesia" onPedirFechar={onFechar}
      subtitulo={<>
        {anestesia.paciente} · {dataBr(anestesia.data)} · {anestesia.convenio}{anestesia.procedimento ? ` · ${anestesia.procedimento}` : ""}
        {anestesia.profissional ? ` · ${anestesia.profissional}` : ""}
      </>}
      rodape={rodape}>
      <div className="admCampos">
        {tussId === null && (
          <p className="clinicalError">A TUSS ainda não foi publicada: sem ela, o código do procedimento não é conferido.</p>
        )}
        <p className="admNota">
          <span className={estilos.seloDesenvolvimento}>Em desenvolvimento</span>
          O valor é uma previsão pela tabela do plano: confira com o contrato antes de cobrar.
        </p>
        <div className={estilos.bloco}>
          <h3>Procedimentos (código TUSS)</h3>
          <p className="admAjuda">O principal primeiro. Com mais de um, o contrato diz quanto vale cada um.</p>
          {codigos === null ? <p className="admTextoFraco" role="status">Carregando…</p> : codigos.length === 0 ? (
            <p className="admTextoFraco">Nenhum código escolhido ainda.</p>
          ) : (
            <CodigosEscolhidos codigos={codigos} onMudar={mudarCodigos} />
          )}
          {sugestao && codigos?.length ? (
            <p className="admNota" role="status">
              <Icone nome="alerta" tamanho={14} />
              {origemDaSugestao(sugestao)} Confira antes de calcular.
            </p>
          ) : null}
          <BuscaNaTuss tussId={tussId} busca={busca} onBusca={setBusca} onEscolher={adicionar} />
        </div>

        {doFinanceiro ? (
          // No Financeiro, a urgência e as marcas são as do médico.
          <p className={estilos.marcadoPeloMedico}>
            <b>Marcado pelo médico:</b>{" "}
            {[urgencia ? "urgência" : "", ...nomesMarcados].filter(Boolean).join(" · ") || "nada"}
          </p>
        ) : (
          <fieldset className={estilos.marcas}>
            <legend className="sr-only">Urgência e marcas</legend>
            <label className={estilos.marca}>
              <input type="checkbox" checked={urgencia} onChange={(e) => { setUrgencia(e.target.checked); setResultado(null); }} />
              <span>Foi urgência</span>
            </label>
            {marcasNaTela.map((x) => (
              <label key={x.id} className={estilos.marca}>
                <input type="checkbox" checked={marcas.includes(x.id)}
                  onChange={(e) => { setMarcas(e.target.checked ? [...marcas, x.id] : marcas.filter((id) => id !== x.id)); setResultado(null); }} />
                <span>{x.nome}</span>
              </label>
            ))}
          </fieldset>
        )}

        {erro && <p className="clinicalError" role="alert">{erro}</p>}

        {resultado && m && (
          <div className={estilos.resultado} aria-live="polite">
            <p className={estilos.salvo}>
              <Icone nome="confirmado" tamanho={15} />
              {doFinanceiro ? `Guardado na produção${anestesia.profissional ? ` de ${anestesia.profissional}` : ""}` : "Guardado na sua produção"}
              {conferida && " · conferido"}
            </p>
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
                {doFinanceiro ? "O médico anotou" : "Você anotou"} {dinheiro(anotado)}: a tabela dá {dinheiro(Math.abs(previsto - anotado))}
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
