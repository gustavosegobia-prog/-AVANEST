"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { hoje } from "@/lib/data-local";
import { VERSAO_DO_SITE, deveRecarregar } from "@/lib/versao";
import {
  CAMPOS_DO_CASO, contagemPorEtapa, duracao, horaDe, horaNoMapa, linhasDaTv, nomeNaTv,
  type Caso, type LinhaDaTv, type Sala,
} from "@/lib/centro-cirurgico";
import { MarcaDagua } from "./marca-dagua";
import { AssinaturaAvanest } from "./assinatura";
import estilos from "./tv.module.css";

const RELOGIO = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const DATA = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });

/** A altura de cada linha, em fração da largura da tela — a mesma do CSS (--linha). */
const LINHA_VW = 0.036;
/** Quanto tempo cada página fica na tela quando a lista não cabe numa só. */
const TROCA_DE_PAGINA_MS = 12000;
/** De quanto em quanto tempo a TV pergunta se saiu versão nova do site. */
const CONFERE_VERSAO_MS = 5 * 60_000;
/** A versão pela qual a TV já recarregou (lib/versao.ts, deveRecarregar). */
const CHAVE_VERSAO = "avanest:tv-recarregou-para";
/** A TV estava em tela cheia quando recarregou: o primeiro toque volta a ela. */
const CHAVE_TELA_CHEIA = "avanest:tv-voltar-tela-cheia";

const idade = (c: Caso) => (c.idade == null ? "" : `${c.idade}a`);

function situacao(l: LinhaDaTv): string {
  const c = l.caso;
  if (l.situacao === "em_sala") return `Em sala · ${duracao(l.minutos)}`;
  if (l.situacao === "rpa") return `RPA · ${duracao(l.minutos)}`;
  if (l.situacao === "atrasado") return `Atrasada ${duracao(l.minutos)}`;
  if (l.situacao === "agendado") return "Aguardando";
  if (l.situacao === "cancelado") return "Cancelada";
  return c.destino === "uti" ? `UTI ${horaDe(c.saida_sala_em)}` : `Alta ${horaDe(c.alta_rpa_em ?? c.saida_sala_em)}`;
}

/** A velocidade do letreiro: 3% da largura da tela por segundo, em qualquer TV. */
const LETREIRO_VW_POR_S = 0.03;
/** A parte de cada volta em que o começo do texto fica parado, para ler — a mesma do CSS. */
const LETREIRO_PAUSA = 0.2;

/**
 * O texto que não cabe na coluna passa devagar da direita para a esquerda,
 * como letreiro; o que cabe fica parado (pedido de 22/10/2026: a cirurgia
 * comprida saía cortada com reticências). Duas cópias seguidas, com um
 * respiro entre elas, e a faixa anda meia largura: a volta emenda sem salto.
 * A cada volta, o começo do texto fica um instante parado, para ler.
 * Quem prefere menos movimento no sistema vê o texto parado, com reticências.
 */
function Letreiro({ texto, className }: { texto: string; className: string }) {
  const caixa = useRef<HTMLSpanElement>(null);
  const copia = useRef<HTMLSpanElement>(null);
  const [duracaoS, setDuracaoS] = useState(0);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    // O ResizeObserver mede logo ao começar a observar, e de novo se a TV mudar de tamanho.
    const observador = new ResizeObserver(() => {
      const largura = copia.current?.offsetWidth ?? 0;
      const respiro = parseFloat(getComputedStyle(el).fontSize) * 3;
      const andando = (largura + respiro) / (window.innerWidth * LETREIRO_VW_POR_S);
      setDuracaoS(largura > el.clientWidth + 1 ? andando / (1 - LETREIRO_PAUSA) : 0);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, [texto]);

  const rola = duracaoS > 0;
  return (
    <span ref={caixa} role="cell" className={`${className} ${rola ? estilos.letreiro : ""}`}
      style={rola ? ({ "--volta": `${duracaoS.toFixed(1)}s` } as React.CSSProperties) : undefined}>
      <span className={estilos.faixa}>
        <span ref={copia} className={estilos.copia}>{texto}</span>
        {rola && <span className={estilos.copia} aria-hidden="true">{texto}</span>}
      </span>
    </span>
  );
}

/**
 * O mapa na TV do corredor do centro cirúrgico.
 *
 * Uma lista só, com todos os pacientes do dia, em blocos (linhasDaTv) — e a
 * cor conta a história: verde é em sala, amarelo é RPA, vermelho é cancelada,
 * azul apagado é alta, e o horário em vermelho é quem passou da hora e ainda
 * não entrou. Quando o dia não cabe
 * numa tela, a lista vira páginas que trocam sozinhas, como no painel do
 * aeroporto.
 *
 * Sem botão. Sem nome completo: o primeiro e o segundo nome e a idade, porque
 * quem passa no corredor lê a TV. Atualiza a cada meio minuto e pede para a
 * tela não apagar.
 */
export function PainelTv({ institutionId, dia, nomeDaCasa, salasIniciais, casosIniciais, apelidos, agora: agoraDoServidor, marca = null }: {
  institutionId: string;
  dia: string;
  nomeDaCasa: string;
  salasIniciais: Sala[];
  casosIniciais: Caso[];
  apelidos: Record<string, string>;
  agora: number;
  /** O logo do hospital (cadastro de locais), em marca d'água. */
  marca?: string | null;
}) {
  const [salas, setSalas] = useState(salasIniciais);
  const [casos, setCasos] = useState(casosIniciais);
  const [agora, setAgora] = useState(agoraDoServidor);
  const [atualizado, setAtualizado] = useState(agoraDoServidor);
  // O dia que a TV mostra. Começa no do servidor e vira sozinho à meia-noite:
  // a TV fica ligada dias seguidos, e com o dia fixo na abertura ela seguia
  // mostrando os pacientes de ontem na manhã seguinte.
  const diaAtual = useRef(dia);
  const [voltarTelaCheia, setVoltarTelaCheia] = useState(false);
  const [semRede, setSemRede] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [porPagina, setPorPagina] = useState(12);
  const [pagina, setPagina] = useState(0);
  const lista = useRef<HTMLDivElement>(null);

  const recarregar = useCallback(async () => {
    const sb = createClient();
    const [s, c] = await Promise.all([
      sb.from("centro_salas").select("id, nome, ordem, ativa").eq("institution_id", institutionId).order("ordem"),
      sb.from("centro_casos").select(CAMPOS_DO_CASO).eq("institution_id", institutionId).eq("data", diaAtual.current),
    ]);
    if (s.error || c.error) { setSemRede(true); return; }
    setSalas((s.data ?? []) as Sala[]);
    setCasos((c.data ?? []) as unknown as Caso[]);
    setSemRede(false);
    setAtualizado(Date.now());
  }, [institutionId]);

  useEffect(() => {
    const relogio = window.setInterval(() => {
      setAgora(Date.now());
      // Virou o dia: o mapa novo entra na hora, sem esperar o próximo meio minuto.
      const d = hoje();
      if (d !== diaAtual.current) { diaAtual.current = d; void recarregar(); }
    }, 15000);
    const dados = window.setInterval(() => { void recarregar(); }, 30000);
    return () => { window.clearInterval(relogio); window.clearInterval(dados); };
  }, [recarregar]);

  // VERSÃO NOVA DO SITE. Os dados chegam sozinhos, mas o código da página não:
  // uma melhoria publicada só aparecia na TV com alguém apertando F5 (22/10/2026,
  // a assinatura que não apareceu). A cada cinco minutos ela pergunta a versão
  // ao servidor e, se mudou, recarrega — uma vez por versão. Sem cookie na
  // pergunta, para a resposta ser a da versão publicada, e não a da que a
  // sessão abriu.
  useEffect(() => {
    const conferir = async () => {
      try {
        const r = await fetch(`/api/versao?t=${Date.now()}`, { cache: "no-store", credentials: "omit" });
        if (!r.ok) return;
        const { versao } = (await r.json()) as { versao?: string };
        let tentada: string | null = null;
        try { tentada = sessionStorage.getItem(CHAVE_VERSAO); } catch { /* sem memória da aba: segue */ }
        if (!versao || !deveRecarregar(VERSAO_DO_SITE, versao, tentada)) return;
        try {
          sessionStorage.setItem(CHAVE_VERSAO, versao);
          if (document.fullscreenElement) sessionStorage.setItem(CHAVE_TELA_CHEIA, "1");
        } catch { /* recarrega mesmo assim */ }
        window.location.reload();
      } catch { /* sem rede: pergunta de novo na próxima */ }
    };
    const id = window.setInterval(() => { void conferir(); }, CONFERE_VERSAO_MS);
    return () => window.clearInterval(id);
  }, []);

  // Depois de recarregar, a tela cheia se perde: o navegador só a devolve com
  // um toque de alguém. Se ela estava em tela cheia, o primeiro clique ou
  // tecla em qualquer lugar da TV volta para ela, e um aviso diz isso.
  useEffect(() => {
    let voltar = false;
    try { voltar = sessionStorage.getItem(CHAVE_TELA_CHEIA) === "1"; } catch { /* sem memória da aba: fica o botão Tela cheia */ }
    if (!voltar || document.fullscreenElement) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memória da aba, só existe depois de montar
    setVoltarTelaCheia(true);
    // A marca só sai com o toque: até lá, outra recarga ainda volta à tela cheia.
    const aoTocar = () => {
      try { sessionStorage.removeItem(CHAVE_TELA_CHEIA); } catch { /* segue */ }
      setVoltarTelaCheia(false);
      void document.documentElement.requestFullscreen?.().catch(() => {});
    };
    document.addEventListener("pointerdown", aoTocar, { once: true });
    document.addEventListener("keydown", aoTocar, { once: true });
    return () => {
      document.removeEventListener("pointerdown", aoTocar);
      document.removeEventListener("keydown", aoTocar);
    };
  }, []);

  // Quantas linhas cabem: a altura da lista dividida pela altura de uma linha,
  // que é fixa (em vw) justamente para esta conta dar certo em qualquer TV.
  useEffect(() => {
    const el = lista.current;
    if (!el) return;
    const medir = () => {
      const cabeca = el.querySelector("[data-cabeca]")?.getBoundingClientRect().height ?? 0;
      setPorPagina(Math.max(3, Math.floor((el.clientHeight - cabeca) / (window.innerWidth * LINHA_VW))));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const linhas = linhasDaTv(casos, agora);
  const paginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  useEffect(() => {
    if (paginas <= 1) return;
    const id = window.setInterval(() => setPagina((p) => (p + 1) % paginas), TROCA_DE_PAGINA_MS);
    return () => window.clearInterval(id);
  }, [paginas]);
  const atual = Math.min(pagina, paginas - 1);
  const naTela = linhas.slice(atual * porPagina, (atual + 1) * porPagina);

  // A TV não pode apagar sozinha no meio da manhã. Onde o navegador não
  // oferece a trava, segue sem ela.
  useEffect(() => {
    let trava: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        trava = (await nav.wakeLock?.request("screen")) ?? null;
      } catch { trava = null; }
    };
    void pedir();
    const aoVoltar = () => { if (document.visibilityState === "visible") void pedir(); };
    const aoMudarTela = () => setTelaCheia(Boolean(document.fullscreenElement));
    document.addEventListener("visibilitychange", aoVoltar);
    document.addEventListener("fullscreenchange", aoMudarTela);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      document.removeEventListener("fullscreenchange", aoMudarTela);
      void trava?.release();
    };
  }, []);

  const contagem = contagemPorEtapa(casos);
  const nomeDaSala = (id: string | null) => salas.find((s) => s.id === id)?.nome ?? "—";
  const quem = (id: string | null) => (id ? apelidos[id] ?? "" : "");

  return (
    <div className={`clinicalDark ${estilos.tv}`}>
      <MarcaDagua src={marca} className={estilos.marcaDagua} />
      <header className={estilos.topo}>
        <div className={estilos.casa}>
          {nomeDaCasa ? <><span>Centro cirúrgico</span><strong>{nomeDaCasa}</strong></> : <strong>Centro cirúrgico</strong>}
        </div>
        {/* Os números são também a legenda: cada um na cor da sua linha. */}
        <ul className={estilos.numeros} aria-label="Pacientes por etapa">
          <li className={estilos.n_em_sala}><b>{contagem.em_sala}</b> em sala</li>
          <li className={estilos.n_agendado}><b>{contagem.agendado}</b> aguardando</li>
          <li className={estilos.n_rpa}><b>{contagem.rpa}</b> na RPA</li>
          <li className={estilos.n_concluido}><b>{contagem.concluido}</b> {contagem.concluido === 1 ? "alta" : "altas"}</li>
          {contagem.cancelado > 0 && (
            <li className={estilos.n_cancelado}><b>{contagem.cancelado}</b> {contagem.cancelado === 1 ? "cancelada" : "canceladas"}</li>
          )}
        </ul>
        <div className={estilos.relogio}>
          <strong>{RELOGIO.format(agora)}</strong>
          <span>{DATA.format(agora)}</span>
        </div>
      </header>

      <div ref={lista} className={estilos.lista} role="table" aria-label="Pacientes do dia">
        <div className={`${estilos.linha} ${estilos.cabeca}`} role="row" data-cabeca>
          <span role="columnheader">Horário</span>
          <span role="columnheader">Paciente</span>
          <span role="columnheader">Cirurgia</span>
          <span role="columnheader">Sala</span>
          <span role="columnheader">Cirurgião</span>
          <span role="columnheader">Anestesista</span>
          <span role="columnheader">Situação</span>
        </div>
        {naTela.length === 0 ? (
          <p className={estilos.vazio}>Nenhum paciente no mapa de hoje.</p>
        ) : naTela.map((l) => {
          const c = l.caso;
          return (
            <div key={c.id} className={`${estilos.linha} ${estilos[`s_${l.situacao}`]}`} role="row">
              <span role="cell" className={estilos.hora}>{horaNoMapa(c)}</span>
              <span role="cell" className={estilos.paciente}>{nomeNaTv(c.paciente)} <small>{idade(c)}</small></span>
              <Letreiro texto={c.procedimento} className={estilos.texto} />
              <span role="cell" className={estilos.texto}>{nomeDaSala(c.sala_id)}</span>
              <span role="cell" className={estilos.texto}>{c.cirurgiao ?? ""}</span>
              <span role="cell" className={estilos.texto}>{quem(c.anestesista_id)}</span>
              <span role="cell" className={estilos.situacao}>{situacao(l)}</span>
            </div>
          );
        })}
      </div>

      <div className={estilos.rodape}>
        <span>{semRede ? "Sem conexão: mostrando o último mapa recebido" : `Atualizado às ${RELOGIO.format(atualizado)} · atualiza sozinho`}</span>
        {paginas > 1 && <span className={estilos.paginas}>Página {atual + 1} de {paginas}</span>}
        {voltarTelaCheia && (
          <span className={estilos.atualizou} role="status">Sistema atualizado · clique em qualquer lugar para voltar à tela cheia</span>
        )}
        <span className={estilos.privacidade}>Só o primeiro e o segundo nome, por privacidade</span>
        {!telaCheia && (
          <button type="button" onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}>
            Tela cheia
          </button>
        )}
        <AssinaturaAvanest naTv />
      </div>
    </div>
  );
}
