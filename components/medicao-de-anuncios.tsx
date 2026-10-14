"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  CHAVE_DO_CONSENTIMENTO, ID_GOOGLE_ADS, idValido, lerConsentimento, registrarConversao,
  rotaAceitaAnuncios, type Consentimento,
} from "@/lib/anuncios";

// O aviso de cookies e a tag do Google Ads. As regras estão em lib/anuncios.ts;
// o que cada cookie faz, e por quanto tempo, em app/cookies/page.tsx.
//
// Fica no layout, mas só age nas páginas públicas. A tag é baixada uma vez, e
// só depois do "aceito"; quem recusa não vê o aviso de novo e não baixa nada.

type JanelaComGtag = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/** Avisa as outras partes da página (o aviso, o painel de preferências). */
const EVENTO = "avanest:consentimento";

function carregarTag() {
  const w = window as JanelaComGtag;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  // O "aceito" é para MEDIR os anúncios, e é só isso que a tag pode fazer:
  // sem remarketing nem anúncio personalizado (ad_personalization), sem
  // Analytics (analytics_storage), sem os "sinais do Google" de quem está
  // logado na conta Google. Usar para mais que isso exige mudar antes o aviso
  // e a política de cookies — que é o que a pessoa leu ao aceitar.
  w.gtag("consent", "default", {
    ad_storage: "granted", ad_user_data: "granted", ad_personalization: "denied", analytics_storage: "denied",
  });
  w.gtag("js", new Date());
  w.gtag("config", ID_GOOGLE_ADS, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID_GOOGLE_ADS)}`;
  document.head.appendChild(s);
}

/**
 * Retirar o consentimento apaga o que a tag deixou no nosso domínio (`_gcl_au`
 * e companhia). Os cookies que o Google guarda nos domínios dele só ele, ou o
 * navegador, apagam — a política de cookies diz isso.
 */
function apagarCookiesDoGoogle() {
  const nomes = document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => /^_(gcl|ga|gid|gac)/.test(n));
  const partes = location.hostname.split(".");
  const dominios = [""];
  for (let i = 0; i < partes.length - 1; i += 1) dominios.push(`; domain=.${partes.slice(i).join(".")}`);
  for (const nome of nomes) for (const d of dominios) document.cookie = `${nome}=; Max-Age=0; path=/${d}`;
}

function guardar(valor: Consentimento) {
  const antes = lerConsentimento();
  try { localStorage.setItem(CHAVE_DO_CONSENTIMENTO, valor); } catch { /* navegação privada */ }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: valor }));
  if (valor === "aceito") { carregarTag(); return; }
  apagarCookiesDoGoogle();
  // A tag já carregada continuaria viva na página: recarregar é o que a tira.
  if (antes === "aceito" && (window as JanelaComGtag).gtag) window.location.reload();
}

/** A escolha guardada, acompanhando mudanças feitas em outra parte da página. */
function useConsentimento() {
  // undefined = ainda não leu (servidor e primeiro quadro).
  const [escolha, setEscolha] = useState<Consentimento | null | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado do aparelho, só existe depois de montar
    setEscolha(lerConsentimento());
    const aoMudar = (e: Event) => setEscolha((e as CustomEvent<Consentimento>).detail);
    window.addEventListener(EVENTO, aoMudar);
    return () => window.removeEventListener(EVENTO, aoMudar);
  }, []);
  return escolha;
}

export function MedicaoDeAnuncios() {
  const caminho = usePathname() ?? "";
  const ativa = idValido(ID_GOOGLE_ADS) && rotaAceitaAnuncios(caminho);
  const escolha = useConsentimento();

  useEffect(() => {
    if (!ativa) {
      // A navegação do Next troca de tela sem recarregar: a tag carregada na
      // capa continuaria viva dentro do sistema depois do login. Recarregar
      // aqui é o que garante que ela não entra onde há dado de paciente.
      if (idValido(ID_GOOGLE_ADS) && (window as JanelaComGtag).gtag) window.location.reload();
      return;
    }
    if (lerConsentimento() !== "aceito") return;
    carregarTag();
    // O botão do WhatsApp é a outra porta de entrada de cliente: quem prefere
    // conversar antes de testar. Conta como conversão secundária.
    const aoClicar = (e: MouseEvent) => {
      const alvo = (e.target as Element | null)?.closest?.('a[href^="https://wa.me/"]');
      if (alvo) registrarConversao("whatsapp");
    };
    document.addEventListener("click", aoClicar);
    return () => document.removeEventListener("click", aoClicar);
  }, [ativa, caminho, escolha]);

  if (!ativa || escolha !== null) return null;
  return (
    <div className="avisoCookies" role="region" aria-label="Aviso de cookies">
      <p>
        Usamos cookies necessários para o site funcionar. Com a sua permissão, usamos também o
        cookie do Google Ads, só nas páginas públicas, para saber quais anúncios trazem visitas.
        Nenhum dado de paciente é enviado. <a href="/cookies">Política de Cookies</a>
      </p>
      <div>
        <button type="button" onClick={() => guardar("recusado")}>Recusar</button>
        <button type="button" onClick={() => guardar("aceito")}>Aceitar</button>
      </div>
    </div>
  );
}

/**
 * Na política de cookies: cada categoria, o que ela faz e a escolha atual —
 * que pode ser mudada a qualquer momento, nos dois sentidos.
 */
export function PreferenciasDeCookies() {
  const escolha = useConsentimento();
  const medicaoLigada = idValido(ID_GOOGLE_ADS);
  const permitido = escolha === "aceito";
  const situacao = escolha === undefined ? "" : escolha === "aceito" ? "Permitido" : escolha === "recusado" ? "Não permitido" : "ainda sem resposta, então fica desligado";

  return (
    <div className="prefCookies">
      <div className="prefCookiesItem">
        <div>
          <h3>Necessários</h3>
          <p>Login, local de atendimento, segurança e a fila que protege os lançamentos da ficha anestésica. Sem eles o sistema não funciona.</p>
        </div>
        <span className="prefCookiesFixo">Sempre ativos</span>
      </div>
      <div className="prefCookiesItem">
        <div>
          <h3>Preferências no seu aparelho</h3>
          <p>Tema, painéis recolhidos, tutorial visto. Ficam só no seu navegador e não vão para ninguém.</p>
        </div>
        <span className="prefCookiesFixo">Sempre ativos</span>
      </div>
      <div className="prefCookiesItem">
        <div>
          <h3 id="rotuloAnuncios">Medição de anúncios (Google Ads)</h3>
          <p>
            Só nas páginas públicas do site, nunca dentro do sistema. Mostra ao AVANEST quais anúncios
            trouxeram visitas e cadastros.
          </p>
          {medicaoLigada
            ? <p className="prefCookiesSituacao" aria-live="polite">{situacao && <>Sua escolha: <b>{situacao}</b></>}</p>
            : <p className="prefCookiesSituacao">A medição de anúncios está desligada no site agora: nenhum cookie de anúncio é usado.</p>}
        </div>
        {medicaoLigada && (
          <button type="button" role="switch" aria-checked={permitido} aria-labelledby="rotuloAnuncios"
            className="prefCookiesChave" disabled={escolha === undefined}
            onClick={() => guardar(permitido ? "recusado" : "aceito")}>
            <span aria-hidden="true" />
            {permitido ? "Permitido" : "Não permitido"}
          </button>
        )}
      </div>
    </div>
  );
}
