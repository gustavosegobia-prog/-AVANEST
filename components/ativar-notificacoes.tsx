"use client";

import { useCallback, useEffect, useState } from "react";
import { Icone } from "@/components/icone";

// O convite para ligar as notificações.
//
// TRÊS COISAS TÊM DE SER VERDADE antes de a permissão sequer poder ser pedida,
// e cada uma falha de um jeito diferente:
//
//   1. o navegador precisa ter Push — o Safari do iPhone só tem a partir do
//      iOS 16.4, e SÓ com o site adicionado à tela de início;
//   2. a pessoa não pode ter bloqueado antes — depois de "Bloquear", o
//      navegador nunca mais mostra a caixa, e insistir com um botão que não
//      faz nada é pior que não ter botão;
//   3. o service worker precisa estar registrado.
//
// O CASO DO IPHONE É O MAIS IMPORTANTE AQUI, porque é onde a escala é
// consultada. Numa aba do Safari, `Notification` simplesmente não existe — e
// um componente que só sumisse deixaria o anestesista achando que o AVANEST
// não tem notificação. Então quando é iPhone fora da tela de início, a caixa
// aparece assim mesmo, ensinando a instalar.

type Estado = "carregando" | "indisponivel" | "instalar-ios" | "bloqueado" | "desligado" | "ligado";

const ehIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent)
  // O iPad moderno mente e se diz Mac; o toque o entrega.
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Instalado na tela de início — é o que o iOS exige para entregar push. */
const naTelaDeInicio = () =>
  window.matchMedia("(display-mode: standalone)").matches
  || (window.navigator as { standalone?: boolean }).standalone === true;

/** O nome do aparelho, para a pessoa saber qual desligar depois. */
function apelidoDoAparelho() {
  const ua = navigator.userAgent;
  const sistema = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows" : "Navegador";
  const navegador = /CriOS|Chrome/.test(ua) ? "Chrome" : /Firefox/.test(ua) ? "Firefox"
    : /Safari/.test(ua) ? "Safari" : "";
  return [sistema, navegador].filter(Boolean).join(" · ");
}

/** base64url → bytes, que é o formato que `subscribe` exige da chave VAPID. */
function chaveEmBytes(base64url: string) {
  const preenchido = base64url.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(base64url.length + (4 - (base64url.length % 4)) % 4, "=");
  const binario = atob(preenchido);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export function AtivarNotificacoes({ chavePublica }: { chavePublica: string }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  // Dispensar vale para esta sessão. Guardar "não quero" para sempre esconderia
  // o recurso de quem mudou de ideia, e o menu do usuário não tem onde reabrir.
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      if (!chavePublica) { if (vivo) setEstado("indisponivel"); return; }
      const temPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!temPush) {
        // No iPhone isto quase sempre quer dizer "está numa aba", e não "não dá".
        if (vivo) setEstado(ehIOS() && !naTelaDeInicio() ? "instalar-ios" : "indisponivel");
        return;
      }
      if (Notification.permission === "denied") { if (vivo) setEstado("bloqueado"); return; }
      try {
        const registro = await navigator.serviceWorker.register("/sw.js");
        const inscricao = await registro.pushManager.getSubscription();
        if (!vivo) return;
        setEstado(inscricao ? "ligado" : "desligado");
      } catch {
        if (vivo) setEstado("indisponivel");
      }
    })();
    return () => { vivo = false; };
  }, [chavePublica]);

  const ligar = useCallback(async () => {
    setOcupado(true); setErro("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "bloqueado" : "desligado");
        return;
      }
      const registro = await navigator.serviceWorker.register("/sw.js");
      // `ready` porque `subscribe` num worker que ainda está instalando falha
      // com um erro que não diz isso.
      await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.subscribe({
        // O navegador exige: sem isto, ele recusa por medo de push silencioso.
        userVisibleOnly: true,
        applicationServerKey: chaveEmBytes(chavePublica) as BufferSource,
      });
      const bruto = inscricao.toJSON() as { keys?: { p256dh?: string; auth?: string } };
      const resposta = await fetch("/api/push/inscrever", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: inscricao.endpoint,
          p256dh: bruto.keys?.p256dh, auth: bruto.keys?.auth,
          aparelho: apelidoDoAparelho(),
        }),
      });
      if (!resposta.ok) {
        // Guardar no navegador e não no servidor deixaria a pessoa achando que
        // ligou, sem receber nada. Desfaz para os dois lados contarem a mesma
        // história.
        await inscricao.unsubscribe().catch(() => {});
        const dados = await resposta.json().catch(() => ({}));
        setErro(dados.error ?? "Não foi possível ligar agora.");
        return;
      }
      setEstado("ligado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ligar agora.");
    } finally {
      setOcupado(false);
    }
  }, [chavePublica]);


  // LIGADO NÃO MOSTRA NADA. Uma faixa permanente dizendo "está ligado" ocupa a
  // primeira linha do painel para sempre, todo dia, para informar algo que já
  // se sabe — e a única coisa útil nela, o desligar, é usada uma vez na vida.
  // Ela foi para o menu do perfil, junto do tema e da senha, que é onde se
  // procura uma preferência.
  if (estado === "carregando" || estado === "indisponivel"
      || estado === "ligado" || dispensado) return null;

  return (
    <div className="pushConvite" role="region" aria-label="Notificações">
      <span className="pushSino" aria-hidden="true"><Icone nome="sino" tamanho={20} /></span>
      <div className="pushTexto">
        <strong>
          {estado === "instalar-ios" ? "Para receber avisos no iPhone"
            : estado === "bloqueado" ? "As notificações estão bloqueadas"
              : "Ative os avisos de escala e troca"}
        </strong>
        <p>
          {estado === "instalar-ios"
            ? "O Safari só entrega avisos com o AVANEST na tela de início. Toque em Compartilhar e depois em “Adicionar à Tela de Início” — depois disso o botão aparece aqui."
            : estado === "bloqueado"
              ? "Você recusou antes, e o navegador não pergunta de novo. Para religar, abra as configurações do site no navegador e permita notificações."
              : "Receba aviso quando a escala for publicada e quando alguém oferecer, aceitar ou recusar um plantão — mesmo com o aplicativo fechado."}
        </p>
        {erro && <p className="pushErro">{erro}</p>}
      </div>
      <div className="pushBotoes">
        {estado === "desligado" && (
          <button type="button" className="primaryClinical" disabled={ocupado} onClick={() => void ligar()}>
            {ocupado ? "Ativando..." : "Ativar notificações"}
          </button>
        )}
        <button type="button" className="pushDepois" onClick={() => setDispensado(true)}>
          {estado === "desligado" ? "Agora não" : "Entendi"}
        </button>
      </div>
    </div>
  );
}

/**
 * "Desligar notificações", no menu do perfil.
 *
 * Some quando não há o que desligar, de propósito: um item permanentemente
 * cinza ensina a ignorar o menu inteiro. Mora aqui, e não numa faixa no topo
 * do painel, porque é uma preferência — procura-se junto do tema e da senha,
 * uma vez na vida, e não todo dia na primeira linha da tela.
 */
export function DesligarNotificacoes({ aoDesligar }: { aoDesligar?: () => void }) {
  const [ligado, setLigado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      if (!("serviceWorker" in navigator)) return;
      const registro = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => null);
      const inscricao = await registro?.pushManager.getSubscription().catch(() => null);
      if (vivo) setLigado(Boolean(inscricao));
    })();
    return () => { vivo = false; };
  }, []);

  if (!ligado) return null;

  return (
    <button role="menuitem" disabled={ocupado} onClick={() => void (async () => {
      setOcupado(true);
      try {
        const registro = await navigator.serviceWorker.getRegistration("/sw.js");
        const inscricao = await registro?.pushManager.getSubscription();
        if (inscricao) {
          // O servidor primeiro. Ao contrário, um erro de rede deixaria o
          // navegador sem inscrição e o banco com um endereço morto, que
          // continuaria recebendo envio até o serviço de push devolver 410.
          await fetch("/api/push/inscrever", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: inscricao.endpoint, sair: true }),
          });
          await inscricao.unsubscribe().catch(() => {});
        }
        setLigado(false);
        aoDesligar?.();
      } finally {
        setOcupado(false);
      }
    })()}>
      <Icone nome="sino"/> {ocupado ? "Desligando..." : "Desligar notificações"}
    </button>
  );
}

/**
 * Avisa o servidor de que um fato aconteceu, para ele tocar os telefones.
 *
 * Nunca lança e nunca bloqueia: a troca já foi gravada quando isto roda, e uma
 * falha de notificação não pode fazer a tela dizer que o pedido não foi feito.
 */
export function avisarPush(carga: { tipo: "troca" | "troca_resolvida" | "escala"; id?: string; mes?: string }) {
  void fetch("/api/push/avisar", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(carga),
  }).catch(() => {});
}
