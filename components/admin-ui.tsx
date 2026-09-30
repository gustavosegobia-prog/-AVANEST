"use client";

import { useEffect, useId, useRef } from "react";
import { Icone } from "@/components/icone";

// Peças de tela comuns da Administração: o painel lateral, o diálogo de
// confirmação e a etiqueta de escopo. Acessibilidade vem de fábrica: o foco
// entra no painel ao abrir, não escapa dele com Tab, Esc pede para fechar e,
// ao fechar, volta para o botão que abriu.

const FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useFocoPreso(aberto: boolean, caixa: React.RefObject<HTMLElement | null>, onEsc: () => void) {
  const onEscRef = useRef(onEsc);
  useEffect(() => { onEscRef.current = onEsc; }, [onEsc]);
  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const el = caixa.current;
    (el?.querySelector<HTMLElement>("[data-foco-inicial]") ?? el?.querySelector<HTMLElement>(FOCAVEIS))?.focus();
    const tecla = (e: KeyboardEvent) => {
      // Um diálogo aberto por cima do painel resolve as próprias teclas: sem
      // isto, o Tab no último botão do diálogo pulava para dentro do painel.
      if (e.key === "Tab" || e.key === "Escape") e.stopPropagation();
      if (e.key === "Escape") { onEscRef.current(); return; }
      if (e.key !== "Tab" || !el) return;
      const itens = [...el.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((x) => x.offsetParent !== null);
      if (!itens.length) return;
      const primeiro = itens[0], ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    el?.addEventListener("keydown", tecla);
    return () => { el?.removeEventListener("keydown", tecla); anterior?.focus?.(); };
  }, [aberto, caixa]);
}

let travas = 0;

/**
 * Trava a rolagem da página enquanto houver janela aberta. Conta as janelas:
 * um diálogo aberto sobre outra janela não destrava a página ao fechar.
 */
export function useTravaDeRolagem(ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    if (travas++ === 0) document.documentElement.classList.add("rolagemTravada");
    return () => {
      if (--travas === 0) document.documentElement.classList.remove("rolagemTravada");
    };
  }, [ativo]);
}

/**
 * Painel lateral no computador; tela inteira no celular (CSS).
 * `onPedirFechar` é chamado por Esc, pelo X e pelo fundo — quem usa decide
 * se fecha ou se pergunta antes (alterações não salvas).
 */
export function Gaveta({
  titulo, subtitulo, onPedirFechar, rodape, children, largura = "normal",
}: {
  titulo: string;
  subtitulo?: React.ReactNode;
  onPedirFechar: () => void;
  rodape?: React.ReactNode;
  children: React.ReactNode;
  largura?: "normal" | "larga";
}) {
  const caixa = useRef<HTMLElement>(null);
  const id = useId();
  useFocoPreso(true, caixa, onPedirFechar);
  useTravaDeRolagem(true);
  return (
    <div className="admGavetaFundo" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onPedirFechar(); }}>
      <aside ref={caixa} className={`admGaveta ${largura}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
        <header className="admGavetaTopo">
          <div>
            <h2 id={`${id}-t`}>{titulo}</h2>
            {subtitulo && <div className="admGavetaSub">{subtitulo}</div>}
          </div>
          <button type="button" className="admFechar" onClick={onPedirFechar} aria-label="Fechar">
            <Icone nome="fechar" tamanho={18} />
          </button>
        </header>
        <div className="admGavetaCorpo">{children}</div>
        {rodape && <div className="admGavetaRodape">{rodape}</div>}
      </aside>
    </div>
  );
}

/** Confirmação com o texto do que vai acontecer. */
export function Dialogo({
  titulo, children, confirmar, cancelar = "Voltar", perigo = false, ocupado = false, erro, onConfirmar, onCancelar,
}: {
  titulo: string;
  children: React.ReactNode;
  confirmar: string;
  cancelar?: string;
  perigo?: boolean;
  ocupado?: boolean;
  erro?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const caixa = useRef<HTMLElement>(null);
  const id = useId();
  useFocoPreso(true, caixa, () => { if (!ocupado) onCancelar(); });
  useTravaDeRolagem(true);
  return (
    <div className="admDialogoFundo" role="presentation">
      {/* Contorno por fora, rolagem por dentro — ver components/janela.tsx. */}
      <section ref={caixa} className="admDialogo" role="alertdialog" aria-modal="true"
        aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <div className="admDialogoRolagem">
          <h2 id={`${id}-t`}>{titulo}</h2>
          <div id={`${id}-d`} className="admDialogoTexto">{children}</div>
          {erro && <p className="clinicalError" role="alert">{erro}</p>}
        </div>
        <div className="admDialogoAcoes">
          <button type="button" className="outlineClinical" onClick={onCancelar} disabled={ocupado} data-foco-inicial>{cancelar}</button>
          <button type="button" className={perigo ? "primaryClinical compact admPerigo" : "primaryClinical compact"}
            onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? "Salvando…" : confirmar}
          </button>
        </div>
      </section>
    </div>
  );
}

export type Escopo = "organizacao" | "local" | "pessoal";
const ESCOPO: Record<Escopo, string> = {
  organizacao: "Aplica-se a toda a organização",
  local: "Aplica-se a este local",
  pessoal: "Preferência pessoal",
};

/** Onde a configuração vale — dito em cada tela, e não deduzido do cabeçalho. */
export function EtiquetaDeEscopo({ escopo }: { escopo: Escopo }) {
  return <span className={`admEscopo ${escopo}`}><Icone nome={escopo === "pessoal" ? "pessoa" : "confirmado"} tamanho={13} />{ESCOPO[escopo]}</span>;
}

/** Cabeçalho de seção: título, escopo e a ação principal. */
export function CabecalhoDeSecao({
  titulo, descricao, escopo, acao,
}: { titulo: string; descricao?: string; escopo?: Escopo; acao?: React.ReactNode }) {
  return (
    <header className="admSecaoTopo">
      <div>
        <h2>{titulo}</h2>
        {descricao && <p>{descricao}</p>}
        {escopo && <EtiquetaDeEscopo escopo={escopo} />}
      </div>
      {acao}
    </header>
  );
}
