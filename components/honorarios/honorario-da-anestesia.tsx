"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Gaveta } from "@/components/admin-ui";
import { Icone } from "@/components/icone";
import { nomeSimples, type Memoria, type Pendencia } from "@/lib/honorarios";
import { codigosSugeridos, padroesDaBusca, rotuloDoPorte } from "@/lib/honorarios-telas";
import { Etiqueta, dataBr, dinheiro, mensagemDoBanco, Recusa } from "./comum";
import estilos from "./honorarios.module.css";

// Conferir o honorário de uma anestesia da Produção: escolher os códigos TUSS
// dos procedimentos, marcar se foi urgência e calcular. A conta é feita no
// servidor (app/api/honorarios/calcular), com o contrato do convênio — que o
// médico não abre —, e o resultado volta com o que faltou, se faltou.

export type AnestesiaDaProducao = {
  id: string; data: string; paciente: string; convenio: string; procedimento: string | null;
  urgencia?: boolean | null; honorario_situacao?: string | null; honorario_valor_previsto?: number | string | null;
};

type Codigo = { codigo: string; descricao: string };

type Resultado = {
  situacao: "calculado" | "pendente"; valorPrevisto: number | null; mensagem: string | null;
  pendencias: Pendencia[]; memoria: Memoria;
};

const ORIGEM = {
  valor_fixo_do_contrato: "valor fixo da tabela do plano",
  porte_do_contrato: "valor do porte no contrato",
  referencia_cbhpm: "referência da CBHPM",
} as const;

export function HonorarioDaAnestesia({
  anestesia, onFechar, onCalculado,
}: {
  anestesia: AnestesiaDaProducao;
  onFechar: () => void;
  onCalculado: (id: string, campos: { honorario_situacao: string; honorario_valor_previsto: number | null; urgencia: boolean }) => void;
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
      const supabase = createClient();
      const [procs, tuss] = await Promise.all([
        supabase.from("producao_procedimentos").select("ordem, tuss_codigo, descricao").eq("producao_id", anestesia.id).order("ordem"),
        supabase.from("tuss_versoes").select("id").eq("tabela", "22").eq("situacao", "vigente").maybeSingle(),
      ]);
      if (!valendo) return;
      setTussId((tuss.data as { id: string } | null)?.id ?? null);
      const salvos = ((procs.data ?? []) as Array<{ tuss_codigo: string | null; descricao: string | null }>)
        .filter((p) => p.tuss_codigo).map((p) => ({ codigo: p.tuss_codigo as string, descricao: p.descricao ?? "" }));
      if (salvos.length || !anestesia.procedimento?.trim()) {
        setCodigos(salvos);
        return;
      }
      const sugestao = await sugestaoDeCodigos(anestesia);
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

  function adicionar(c: Codigo) {
    if (codigos?.some((x) => x.codigo === c.codigo)) return;
    setCodigos([...(codigos ?? []), c]);
    setSugeridoDe(null);
    setBusca("");
    setAchados([]);
    setResultado(null);
  }

  async function calcular() {
    setCalculando(true);
    setErro("");
    setResultado(null);
    try {
      if (!codigos?.length) throw new Recusa("Escolha ao menos o código TUSS do procedimento principal.");
      const supabase = createClient();
      // Os procedimentos, na ordem escolhida: o que estava se apaga e entra de novo.
      const apagar = await supabase.from("producao_procedimentos").delete().eq("producao_id", anestesia.id);
      if (apagar.error) throw apagar.error;
      const inserir = await supabase.from("producao_procedimentos").insert(codigos.map((c, i) => ({
        producao_id: anestesia.id, ordem: i + 1, tuss_codigo: c.codigo, tuss_versao_id: tussId, descricao: c.descricao || null,
      })));
      if (inserir.error) throw inserir.error;
      const resposta = await fetch("/api/honorarios/calcular", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producaoId: anestesia.id, urgencia }),
      });
      const corpo = await resposta.json().catch(() => ({})) as Resultado & { error?: string };
      if (!resposta.ok) throw new Recusa(corpo.error || "Não foi possível calcular agora.");
      setResultado(corpo);
      onCalculado(anestesia.id, { honorario_situacao: corpo.situacao, honorario_valor_previsto: corpo.valorPrevisto, urgencia });
    } catch (e) {
      setErro(mensagemDoBanco(e, "Não foi possível calcular agora."));
    } finally {
      setCalculando(false);
    }
  }

  const m = resultado?.memoria;

  return (
    <Gaveta titulo="Honorário da anestesia" onPedirFechar={onFechar}
      subtitulo={<>{anestesia.paciente} · {dataBr(anestesia.data)} · {anestesia.convenio}{anestesia.procedimento ? ` · ${anestesia.procedimento}` : ""}</>}
      rodape={<>
        <button type="button" className="outlineClinical" onClick={onFechar}>Fechar</button>
        <button type="button" className={`primaryClinical compact ${estilos.comIcone}`} onClick={calcular} disabled={calculando || !codigos?.length}>
          <Icone nome="calculadora" tamanho={16} /> {calculando ? "Calculando…" : "Calcular honorário"}
        </button>
      </>}>
      <div className="admCampos">
        {tussId === null && (
          <p className="clinicalError">A TUSS ainda não foi publicada: sem ela, o código do procedimento não é conferido.</p>
        )}
        <div className={estilos.bloco}>
          <h4>Procedimentos (código TUSS)</h4>
          <p className="admAjuda">O principal primeiro. Com mais de um, o contrato diz quanto vale cada um.</p>
          {codigos === null ? <p className="admTextoFraco" role="status">Carregando…</p> : codigos.length === 0 ? (
            <p className="admTextoFraco">Nenhum código escolhido ainda.</p>
          ) : (
            <ol className={estilos.codigosEscolhidos}>
              {codigos.map((c) => (
                <li key={c.codigo}>
                  <span className={estilos.codigo}>{c.codigo}</span>
                  <span>{c.descricao || "—"}</span>
                  <button type="button" className="outlineClinical compacto" aria-label={`Tirar ${c.codigo}`}
                    onClick={() => { setCodigos(codigos.filter((x) => x.codigo !== c.codigo)); setResultado(null); setSugeridoDe(null); }}>Tirar</button>
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
            <ul className={estilos.achados} role="listbox" aria-label="Códigos encontrados">
              {achados.map((c) => (
                <li key={c.codigo}>
                  <button type="button" role="option" aria-selected={false} onClick={() => adicionar(c)}>
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
            <div className={estilos.resultadoTopo}>
              <div>
                <span>Valor previsto</span>
                <strong>{resultado.valorPrevisto == null ? "Pendente" : dinheiro(resultado.valorPrevisto)}</strong>
              </div>
              <Etiqueta tom={resultado.situacao === "calculado" && !resultado.mensagem ? "ok" : "atencao"}>
                {resultado.situacao === "calculado" ? (resultado.mensagem ? "Calculado, conferir" : "Calculado") : "Pendente de conferência"}
              </Etiqueta>
            </div>
            {resultado.mensagem && <p className="admNota"><Icone nome="alerta" tamanho={14} />{resultado.mensagem}</p>}
            {resultado.pendencias.length > 0 && (
              <ul className={estilos.listaSimples}>{resultado.pendencias.map((p, i) => <li key={i}>{p.texto}</li>)}</ul>
            )}
            {m.linhas.length > 0 && (
              <ul className={estilos.listaSimples}>
                {m.linhas.map((l) => (
                  <li key={l.ordem}>
                    {l.tussCodigo}{l.porte != null ? ` · ${rotuloDoPorte(l.porte)}${l.porteDe === "contrato" ? " da tabela do plano" : " da CBHPM"}` : ""}
                    {" · "}{ORIGEM[l.origem]} {dinheiro(l.base)}{l.percentual !== 100 ? ` × ${l.percentual}%` : ""} = <b>{dinheiro(l.valor)}</b>
                  </li>
                ))}
              </ul>
            )}
            {m.operadora && <p className="admAjuda">Contrato de {m.operadora}, versão {m.contratoVersao} · TUSS {m.tussVersao}</p>}
          </div>
        )}
      </div>
    </Gaveta>
  );
}

/**
 * Os códigos da última anotação do médico com o mesmo procedimento escrito.
 * Só as anotações dele: a Produção é pessoal, e quem tem o Financeiro também
 * lê as enviadas dos colegas.
 */
async function sugestaoDeCodigos(anestesia: AnestesiaDaProducao) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: anteriores } = await supabase.from("producao_do_dia").select("id, data, procedimento")
    .eq("perfil_id", user.id).neq("id", anestesia.id).not("procedimento", "is", null)
    .order("data", { ascending: false }).limit(300);
  const lista = (anteriores ?? []) as Array<{ id: string; data: string; procedimento: string | null }>;
  const chave = nomeSimples(anestesia.procedimento);
  const candidatos = lista.filter((a) => nomeSimples(a.procedimento) === chave);
  if (!candidatos.length) return null;
  const { data: procs } = await supabase.from("producao_procedimentos").select("producao_id, ordem, tuss_codigo, descricao")
    .in("producao_id", candidatos.slice(0, 20).map((c) => c.id));
  return codigosSugeridos(anestesia, candidatos,
    (procs ?? []) as Array<{ producao_id: string; ordem: number; tuss_codigo: string | null; descricao: string | null }>);
}

/** O selo do honorário na linha da Produção. */
export function SeloDoHonorario({ situacao, valor, onAbrir }: {
  situacao: string | null | undefined; valor: number | string | null | undefined; onAbrir: () => void;
}) {
  const texto = situacao === "calculado" || situacao === "conferido"
    ? `Honorário ${dinheiro(valor)}`
    : situacao === "pendente" ? "Honorário pendente" : "Calcular honorário";
  return (
    <button type="button" className={`${estilos.selo} ${situacao === "pendente" ? estilos.seloPendente : situacao === "calculado" || situacao === "conferido" ? estilos.seloOk : ""}`}
      onClick={onAbrir}>
      <Icone nome="calculadora" tamanho={13} />{texto}
    </button>
  );
}
