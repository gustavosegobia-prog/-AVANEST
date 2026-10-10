"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CHAVE_DO_CONSENTIMENTO, ID_GOOGLE_ADS, idValido, lerConsentimento, registrarConversao,
  rotaAceitaAnuncios, type Consentimento,
} from "@/lib/anuncios";

// O aviso de cookies e a tag do Google Ads. As regras estão em lib/anuncios.ts.
//
// Fica no layout, mas só age nas páginas públicas. A tag é baixada uma vez, e
// só depois do "aceito"; quem recusa não vê o aviso de novo e não baixa nada.

type JanelaComGtag = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

function carregarTag() {
  const w = window as JanelaComGtag;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag("js", new Date());
  w.gtag("config", ID_GOOGLE_ADS);
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID_GOOGLE_ADS)}`;
  document.head.appendChild(s);
}

export function MedicaoDeAnuncios() {
  const caminho = usePathname() ?? "";
  const ativa = idValido(ID_GOOGLE_ADS) && rotaAceitaAnuncios(caminho);
  // undefined = ainda não leu (servidor e primeiro quadro): não mostra nada,
  // para o aviso não piscar em quem já respondeu.
  const [escolha, setEscolha] = useState<Consentimento | null | undefined>(undefined);

  useEffect(() => {
    if (!ativa) {
      // A navegação do Next troca de tela sem recarregar: a tag carregada na
      // capa continuaria viva dentro do sistema depois do login. Recarregar
      // aqui é o que garante que ela não entra onde há dado de paciente.
      if (idValido(ID_GOOGLE_ADS) && (window as JanelaComGtag).gtag) window.location.reload();
      return;
    }
    const atual = lerConsentimento();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado do aparelho, só existe depois de montar
    setEscolha(atual);
    if (atual !== "aceito") return;
    carregarTag();
    // O botão do WhatsApp é a outra porta de entrada de cliente: quem prefere
    // conversar antes de testar. Conta como conversão secundária.
    const aoClicar = (e: MouseEvent) => {
      const alvo = (e.target as Element | null)?.closest?.('a[href^="https://wa.me/"]');
      if (alvo) registrarConversao("whatsapp");
    };
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, [ativa, caminho]);

  function responder(valor: Consentimento) {
    try { localStorage.setItem(CHAVE_DO_CONSENTIMENTO, valor); } catch { /* navegação privada */ }
    setEscolha(valor);
    if (valor === "aceito") carregarTag();
  }

  if (!ativa || escolha !== null) return null;
  return (
    <div className="avisoCookies" role="region" aria-label="Aviso de cookies">
      <p>
        Usamos o cookie do Google Ads só nas páginas do site, para medir os anúncios. Nenhum dado de
        paciente é enviado.{" "}
        <a href="/privacidade#cookies">Política de Privacidade</a>
      </p>
      <div>
        <button type="button" className="avisoCookiesRecusar" onClick={() => responder("recusado")}>
          Recusar
        </button>
        <button type="button" className="avisoCookiesAceitar" onClick={() => responder("aceito")}>
          Aceitar
        </button>
      </div>
    </div>
  );
}

/** Na política de privacidade: desfaz a escolha e mostra o aviso de novo. */
export function MudarEscolhaDeCookies() {
  function mudar() {
    try { localStorage.removeItem(CHAVE_DO_CONSENTIMENTO); } catch { /* nada a desfazer */ }
    window.location.reload();
  }
  return (
    <button type="button" className="avnSecondary mudarCookies" onClick={mudar}>
      Mudar minha escolha de cookies
    </button>
  );
}
