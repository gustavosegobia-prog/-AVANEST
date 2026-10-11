"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { esperaMs, gravarFila, lerFila, type Pendente } from "@/lib/evolucao/fila";
import { vigentes, type Registro, type TipoDeRegistro, type Origem } from "@/lib/evolucao/registros";
import { dataLocal } from "@/lib/data-local";

// O estado da folha aberta: registros confirmados, fila de pendentes,
// cabeçalho com salvamento automático, desfazer/refazer.
//
// Uma regra atravessa tudo: a tela mostra o que o médico acabou de fazer NA
// HORA, mas só chama de "salvo" o que o servidor confirmou. Pendente é
// desenhado mais claro e contado no indicador de sincronização.

export type Folha = {
  id: string;
  institution_id: string;
  patient_id: string;
  avaliacao_id: string | null;
  status: "aberta" | "encerrada";
  dados: Record<string, unknown>;
  lock_version: number;
  versao: number;
  intervalo_minutos: number;
  inicio_em: string;
  encerrada_em: string | null;
  created_at: string;
};

export type NovoRegistro = {
  tipo: TipoDeRegistro;
  momento: string;
  dados?: Record<string, unknown>;
  origem?: Origem;
  substitui_id?: string | null;
  anulado?: boolean;
  motivo?: string | null;
};

export type Sincronia = "salvo" | "salvando" | "sem_conexao" | "erro";

type Acao =
  | { tipo: "criar"; id: string; copia: NovoRegistro }
  | { tipo: "corrigir"; antigo: Registro; novoId: string; novo: NovoRegistro }
  | { tipo: "excluir"; alvo: Registro };

/** HH:MM do relógio do serviço → ISO, no dia da referência (ou na véspera, se cairia no futuro). */
export function momentoDeHora(hhmm: string, referencia: Date = new Date()): string | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const iso = `${dataLocal(referencia)}T${hhmm}:00-03:00`;
  let t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  if (t > Date.now() + 5 * 60000) t -= 86400000;
  return new Date(t).toISOString();
}

export function useFolha(folhaInicial: Folha, registrosIniciais: Registro[]) {
  const [folha, setFolha] = useState<Folha>(folhaInicial);
  const [registros, setRegistros] = useState<Registro[]>(registrosIniciais);
  const [pendentes, setPendentes] = useState<Pendente[]>([]);
  const [sincronia, setSincronia] = useState<Sincronia>("salvo");
  const [recusa, setRecusa] = useState<string | null>(null);
  const [cabecalhoSalvo, setCabecalhoSalvo] = useState<"salvo" | "salvando" | "conflito" | "erro">("salvo");
  const [desfazer, setDesfazer] = useState<Acao[]>([]);
  const [refazer, setRefazer] = useState<Acao[]>([]);
  const enviando = useRef(false);
  const filaRef = useRef<Pendente[]>([]);
  const tentativa = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A fila que ficou de uma queda de conexão ou de uma aba fechada volta aqui.
  useEffect(() => {
    const salva = lerFila(folhaInicial.id);
    if (salva.length) {
      filaRef.current = salva;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a fila mora no aparelho, só existe depois de montar
      setPendentes(salva);
    }
  }, [folhaInicial.id]);

  const mudarFila = useCallback((nova: Pendente[]) => {
    filaRef.current = nova;
    setPendentes(nova);
    gravarFila(folhaInicial.id, nova);
  }, [folhaInicial.id]);

  const recarregar = useCallback(async () => {
    const supabase = createClient();
    const [{ data: f }, { data: r }] = await Promise.all([
      supabase.from("evolucoes_anestesicas")
        .select("id, institution_id, patient_id, avaliacao_id, status, dados, lock_version, versao, intervalo_minutos, inicio_em, encerrada_em, created_at")
        .eq("id", folhaInicial.id).maybeSingle(),
      supabase.from("evolucao_registros").select("*").eq("evolucao_id", folhaInicial.id).order("momento").limit(5000),
    ]);
    if (f) setFolha(f as Folha);
    if (r) setRegistros(r as Registro[]);
  }, [folhaInicial.id]);

  const enviar = useCallback(async () => {
    if (enviando.current) return;
    enviando.current = true;
    if (tentativa.current) { clearTimeout(tentativa.current); tentativa.current = null; }
    try {
      while (filaRef.current.some((p) => !p.recusado)) {
        const p = filaRef.current.find((x) => !x.recusado)!;
        setSincronia("salvando");
        let resposta: Response;
        try {
          resposta = await fetch("/api/evolucao/registrar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          });
        } catch {
          // Sem rede: tenta de novo com espera crescente.
          const atualizado = filaRef.current.map((x) => x.id === p.id ? { ...x, tentativas: x.tentativas + 1 } : x);
          mudarFila(atualizado);
          setSincronia("sem_conexao");
          tentativa.current = setTimeout(() => { void enviar(); }, esperaMs(p.tentativas));
          return;
        }
        const corpo = await resposta.json().catch(() => ({}));
        if (resposta.ok && corpo.registro) {
          setRegistros((atual) => atual.some((r) => r.id === corpo.registro.id) ? atual : [...atual, corpo.registro]);
          mudarFila(filaRef.current.filter((x) => x.id !== p.id));
          continue;
        }
        if (resposta.status === 409) {
          mudarFila(filaRef.current.filter((x) => x.id !== p.id));
          setRecusa(corpo.error ?? "Outra pessoa alterou este registro.");
          await recarregar();
          continue;
        }
        if (resposta.status === 422 || resposta.status === 400 || resposta.status === 403 || resposta.status === 404) {
          mudarFila(filaRef.current.map((x) => x.id === p.id ? { ...x, recusado: corpo.error ?? "Registro recusado." } : x));
          setRecusa(corpo.error ?? "Registro recusado.");
          continue;
        }
        if (resposta.status === 401) {
          setSincronia("erro");
          setRecusa("Sua sessão expirou. Entre de novo — os registros pendentes ficam guardados neste aparelho.");
          return;
        }
        const atualizado = filaRef.current.map((x) => x.id === p.id ? { ...x, tentativas: x.tentativas + 1 } : x);
        mudarFila(atualizado);
        setSincronia("sem_conexao");
        tentativa.current = setTimeout(() => { void enviar(); }, esperaMs(p.tentativas));
        return;
      }
      setSincronia(filaRef.current.some((x) => x.recusado) ? "erro" : "salvo");
    } finally {
      enviando.current = false;
    }
  }, [mudarFila, recarregar]);

  useEffect(() => {
    const volta = () => { void enviar(); };
    window.addEventListener("online", volta);
    if (filaRef.current.length) void enviar();
    return () => window.removeEventListener("online", volta);
  }, [enviar]);

  // O que os colegas lançam no mesmo caso aparece sem recarregar a página.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden || enviando.current) return;
      const ultimo = registros.reduce((m, r) => (r.created_at && r.created_at > m ? r.created_at : m), "");
      let q = createClient().from("evolucao_registros").select("*").eq("evolucao_id", folhaInicial.id);
      if (ultimo) q = q.gt("created_at", ultimo);
      const { data } = await q.limit(500);
      if (data?.length) {
        setRegistros((atual) => {
          const ids = new Set(atual.map((r) => r.id));
          const novos = (data as Registro[]).filter((r) => !ids.has(r.id));
          return novos.length ? [...atual, ...novos] : atual;
        });
      }
    }, 20000);
    return () => clearInterval(t);
  }, [folhaInicial.id, registros]);

  const registrar = useCallback((n: NovoRegistro, opcoes: { semDesfazer?: boolean } = {}) => {
    const id = crypto.randomUUID();
    const p: Pendente = {
      id, evolucao_id: folhaInicial.id, tipo: n.tipo, momento: n.momento, dados: n.dados ?? {},
      origem: n.origem ?? "manual", substitui_id: n.substitui_id ?? null, anulado: n.anulado ?? false,
      motivo: n.motivo ?? null, tentativas: 0,
    };
    mudarFila([...filaRef.current, p]);
    void enviar();
    if (!opcoes.semDesfazer) {
      setDesfazer((d) => [...d.slice(-49), { tipo: "criar", id, copia: n }]);
      setRefazer([]);
    }
    return id;
  }, [enviar, folhaInicial.id, mudarFila]);

  const corrigir = useCallback((antigo: Registro, novo: Omit<NovoRegistro, "tipo" | "substitui_id">) => {
    const n: NovoRegistro = { ...novo, tipo: antigo.tipo, substitui_id: antigo.id };
    const novoId = registrar(n, { semDesfazer: true });
    setDesfazer((d) => [...d.slice(-49), { tipo: "corrigir", antigo, novoId, novo: n }]);
    setRefazer([]);
    return novoId;
  }, [registrar]);

  const excluir = useCallback((alvo: Registro, motivo: string) => {
    registrar({ tipo: alvo.tipo, momento: alvo.momento, substitui_id: alvo.id, anulado: true, motivo }, { semDesfazer: true });
    setDesfazer((d) => [...d.slice(-49), { tipo: "excluir", alvo }]);
    setRefazer([]);
  }, [registrar]);

  // Desfazer não apaga: registra o contrário. O histórico mostra os dois.
  const desfazerUltimo = useCallback(() => {
    const a = desfazer[desfazer.length - 1];
    if (!a) return;
    setDesfazer((d) => d.slice(0, -1));
    if (a.tipo === "criar") {
      registrar({ tipo: a.copia.tipo, momento: a.copia.momento, substitui_id: a.id, anulado: true, motivo: "Desfeito" },
        { semDesfazer: true });
    } else if (a.tipo === "corrigir") {
      registrar({ tipo: a.antigo.tipo, momento: a.antigo.momento, dados: a.antigo.dados, origem: a.antigo.origem,
        substitui_id: a.novoId, motivo: "Desfeito" }, { semDesfazer: true });
    } else {
      registrar({ tipo: a.alvo.tipo, momento: a.alvo.momento, dados: a.alvo.dados, origem: a.alvo.origem,
        motivo: "Exclusão desfeita" }, { semDesfazer: true });
    }
    setRefazer((r) => [...r, a]);
  }, [desfazer, registrar]);

  const refazerUltimo = useCallback(() => {
    const a = refazer[refazer.length - 1];
    if (!a) return;
    setRefazer((r) => r.slice(0, -1));
    if (a.tipo === "criar") {
      const id = registrar(a.copia, { semDesfazer: true });
      setDesfazer((d) => [...d, { tipo: "criar", id, copia: a.copia }]);
    } else {
      // Refazer correção ou exclusão sobre o estado que mudou desde então é
      // ambíguo; a folha prefere pedir o gesto de novo a adivinhar.
      setRecusa("Para refazer esta alteração, faça-a de novo no ponto.");
    }
  }, [refazer, registrar]);

  // ---- Cabeçalho -------------------------------------------------------
  const cabecalhoPendente = useRef<Record<string, unknown> | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockRef = useRef(folhaInicial.lock_version);
  const gravarDeNovo = useRef<() => void>(() => {});

  const gravarCabecalho = useCallback(async () => {
    const dados = cabecalhoPendente.current;
    if (!dados) return;
    cabecalhoPendente.current = null;
    setCabecalhoSalvo("salvando");
    const { data, error } = await createClient().rpc("salvar_cabecalho_evolucao", {
      p_id: folhaInicial.id, p_lock_version: lockRef.current, p_dados: dados,
    });
    if (error) {
      if (error.message.includes("CONFLITO_DE_EDICAO")) setCabecalhoSalvo("conflito");
      else {
        // Sem rede: guarda para a próxima tentativa.
        cabecalhoPendente.current = cabecalhoPendente.current ?? dados;
        setCabecalhoSalvo("erro");
        temporizador.current = setTimeout(() => gravarDeNovo.current(), 5000);
      }
      return;
    }
    const linha = Array.isArray(data) ? data[0] : data;
    if (linha?.lock_version !== undefined) {
      lockRef.current = linha.lock_version;
      setFolha((f) => ({ ...f, lock_version: linha.lock_version }));
    }
    if (cabecalhoPendente.current) gravarDeNovo.current();
    else setCabecalhoSalvo("salvo");
  }, [folhaInicial.id]);
  useEffect(() => { gravarDeNovo.current = () => { void gravarCabecalho(); }; }, [gravarCabecalho]);

  const mudarCabecalho = useCallback((mudanca: Record<string, unknown>) => {
    setFolha((f) => {
      const dados = { ...f.dados, ...mudanca };
      cabecalhoPendente.current = dados;
      return { ...f, dados };
    });
    setCabecalhoSalvo("salvando");
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => { void gravarCabecalho(); }, 700);
  }, [gravarCabecalho]);

  const recarregarTudo = useCallback(async () => {
    await recarregar();
    setCabecalhoSalvo("salvo");
  }, [recarregar]);

  useEffect(() => { lockRef.current = folha.lock_version; }, [folha.lock_version]);

  // ---- Visão para a tela ---------------------------------------------
  const pendentesComoRegistro: Registro[] = useMemo(() => pendentes.filter((p) => !p.recusado).map((p) => ({
    id: p.id, evolucao_id: p.evolucao_id, tipo: p.tipo as TipoDeRegistro, momento: p.momento,
    dados: p.dados, origem: p.origem as Origem, substitui_id: p.substitui_id, anulado: p.anulado,
    motivo: p.motivo, created_by: null, created_at: null,
  })), [pendentes]);
  const todos = useMemo(() => [...registros, ...pendentesComoRegistro], [registros, pendentesComoRegistro]);
  const atuais = useMemo(() => vigentes(todos), [todos]);
  const idsPendentes = useMemo(() => new Set(pendentesComoRegistro.map((p) => p.id)), [pendentesComoRegistro]);

  const descartarRecusados = useCallback(() => {
    mudarFila(filaRef.current.filter((p) => !p.recusado));
    setRecusa(null);
    setSincronia(filaRef.current.length ? "salvando" : "salvo");
  }, [mudarFila]);

  return {
    folha, setFolha, todos, atuais, idsPendentes, pendentes, sincronia, recusa, setRecusa,
    registrar, corrigir, excluir, desfazerUltimo, refazerUltimo,
    podeDesfazer: desfazer.length > 0, podeRefazer: refazer.length > 0,
    mudarCabecalho, cabecalhoSalvo, recarregarTudo, descartarRecusados,
  };
}
