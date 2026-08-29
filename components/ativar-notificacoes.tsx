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

/**
 * O convite já foi feito neste aparelho?
 *
 * O cartão do topo é um CONVITE, e convite se faz uma vez. Sem esta memória
 * ele reaparecia a cada carregamento de página para quem tivesse desligado de
 * propósito — perguntando de novo, todo dia, algo que a pessoa já respondeu.
 * Aviso que insiste depois do "não" é aviso que ensina a ignorar avisos.
 *
 * Fica no `localStorage`, e não no banco, porque a decisão é DESTE aparelho:
 * quem desligou no computador do consultório pode muito bem querer o convite
 * no celular. O try/catch existe porque a janela anônima e o bloqueio de
 * dados de site fazem o acessor lançar, e não devolver vazio.
 */
const CHAVE_CONVITE = "avanest-push-convite";

const jaConvidado = () => {
  try { return localStorage.getItem(CHAVE_CONVITE) === "visto"; } catch { return false; }
};

const marcarConvidado = () => {
  try { localStorage.setItem(CHAVE_CONVITE, "visto"); } catch { /* janela anônima */ }
};

/** base64url → bytes, que é o formato que `subscribe` exige da chave VAPID. */
function chaveEmBytes(base64url: string) {
  const preenchido = base64url.replace(/-/g, "+").replace(/_/g, "/")
    .padEnd(base64url.length + (4 - (base64url.length % 4)) % 4, "=");
  const binario = atob(preenchido);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/**
 * Liga as notificações neste aparelho.
 *
 * Fora de qualquer componente porque DOIS lugares precisam dela: o cartão do
 * topo, que convida quem nunca ligou, e o interruptor do menu, que religa quem
 * desligou. Quando a lógica morava só no cartão, desligar era caminho de mão
 * única — o cartão não voltava sem recarregar a página.
 */
export async function ligarPush(chavePublica: string): Promise<{ ok: true } | { ok: false; erro: string; bloqueado?: boolean }> {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    return { ok: false, bloqueado: permissao === "denied", erro: "Permissão não concedida." };
  }
  const registro = await navigator.serviceWorker.register("/sw.js");
  // `ready` porque `subscribe` num worker que ainda está instalando falha com
  // um erro que não diz isso.
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
    return { ok: false, erro: dados.error ?? "Não foi possível ligar agora." };
  }
  marcarConvidado();
  return { ok: true };
}

/**
 * Desliga neste aparelho.
 *
 * O SERVIDOR PRIMEIRO. Na ordem inversa, uma falha de rede no meio deixaria o
 * navegador sem inscrição e o banco com um endereço morto, recebendo envio a
 * cada troca de plantão até o serviço de push devolver 410.
 */
export async function desligarPush() {
  // Desligar é uma resposta, e das mais claras. O cartão não volta a perguntar.
  marcarConvidado();
  const registro = await navigator.serviceWorker.getRegistration("/sw.js");
  const inscricao = await registro?.pushManager.getSubscription();
  if (!inscricao) return;
  await fetch("/api/push/inscrever", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: inscricao.endpoint, sair: true }),
  });
  await inscricao.unsubscribe().catch(() => {});
}

/** Se este navegador já está inscrito. */
export async function estaLigado() {
  if (!("serviceWorker" in navigator)) return false;
  const registro = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => null);
  return Boolean(await registro?.pushManager.getSubscription().catch(() => null));
}

export function AtivarNotificacoes({ chavePublica }: { chavePublica: string }) {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  // Começa dispensado quando o convite já foi feito neste aparelho. Guardar o
  // "não quero" deixou de esconder o recurso no dia em que o menu do perfil
  // ganhou o interruptor: agora existe onde religar, e o cartão pode calar.
  //
  // `useState` com função porque o localStorage não existe no servidor — lê-lo
  // durante o render do Next quebraria a página inteira.
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      // A leitura da memória mora DENTRO do efeito assíncrono, junto do resto.
      // Num inicializador de useState ela quebraria a hidratação — o servidor
      // não tem localStorage e renderizaria o cartão que o navegador esconde.
      if (jaConvidado() && vivo) setDispensado(true);
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
      const r = await ligarPush(chavePublica);
      if (r.ok) { setEstado("ligado"); return; }
      if (r.bloqueado) { setEstado("bloqueado"); return; }
      if (r.erro !== "Permissão não concedida.") setErro(r.erro);
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
        <button type="button" className="pushDepois"
          onClick={() => { marcarConvidado(); setDispensado(true); }}>
          {estado === "desligado" ? "Agora não" : "Entendi"}
        </button>
      </div>
    </div>
  );
}

/**
 * O interruptor das notificações, no menu do perfil.
 *
 * LIGA E DESLIGA, e não só desliga. A primeira versão só desligava, e isso
 * fazia do menu um caminho de mão única: quem desligasse não tinha por onde
 * voltar — o cartão do topo só reaparece ao recarregar a página, e some de vez
 * se a pessoa tiver clicado em "Agora não". Preferência que se muda num
 * sentido só não é preferência, é armadilha.
 *
 * Some inteiro quando não há o que oferecer: sem chave configurada, sem
 * suporte do navegador, ou com a permissão já negada — nesse último caso quem
 * resolve é a configuração do site no navegador, e um botão aqui só daria a
 * impressão de estar quebrado.
 */
export function NotificacoesNoMenu({ chavePublica, aoMudar }: {
  chavePublica: string; aoMudar?: () => void;
}) {
  const [ligado, setLigado] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const disponivel = Boolean(chavePublica)
        && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
        && Notification.permission !== "denied";
      const atual = disponivel ? await estaLigado() : null;
      if (vivo) setLigado(disponivel ? atual : null);
    })();
    return () => { vivo = false; };
  }, [chavePublica]);

  if (ligado === null) return null;

  return (
    <button role="menuitemcheckbox" aria-checked={ligado} disabled={ocupado}
      onClick={() => void (async () => {
        setOcupado(true);
        try {
          if (ligado) { await desligarPush(); setLigado(false); }
          else {
            const r = await ligarPush(chavePublica);
            if (r.ok) setLigado(true);
            // Negou agora: o item some, porque o navegador não pergunta de novo
            // e insistir com um botão que não faz nada é pior que não ter botão.
            else if (r.bloqueado) setLigado(null);
          }
          aoMudar?.();
        } finally {
          setOcupado(false);
        }
      })()}>
      <Icone nome="sino"/> {ocupado ? "Aguarde..."
        : ligado ? "Desligar notificações" : "Ativar notificações"}
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
