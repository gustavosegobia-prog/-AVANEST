"use client";

import { useEffect, useRef } from "react";

// CAPTCHA no login — Cloudflare Turnstile.
//
// POR QUE AQUI E NÃO NUMA ROTA NOSSA. A autenticação vai do navegador direto
// para o Supabase; nenhuma chamada de login passa pelo nosso servidor, então o
// `enforceRateLimit` que protege as outras rotas não alcança o login. Quem
// segura tentativa em massa de senha é o próprio Supabase, e o jeito que ele
// oferece para apertar isso é o CAPTCHA: o token viaja junto da chamada de
// auth e é conferido do lado dele, com a chave secreta que nunca sai da Vercel.
//
// `interaction-only`: o quadro só aparece quando o Turnstile desconfia. Para
// quem entra todo dia do mesmo lugar, no mesmo computador, não há nada na
// tela — e essa é a diferença entre uma proteção que fica e uma que alguém
// pede para desligar na primeira semana.
//
// SEM CHAVE, NÃO ATRAPALHA. Mesma regra do e-mail e das notificações: se a
// variável não estiver configurada, o componente não desenha nada e não
// devolve token. Enquanto o CAPTCHA estiver desligado no painel do Supabase,
// o login funciona igual — e é isso que permite subir este código antes de
// ligar a chave, em vez de ter que fazer as duas coisas no mesmo minuto.

const CHAVE = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Verdadeiro quando há chave configurada. */
export const captchaLigado = () => Boolean(CHAVE);

type Api = {
  render: (alvo: HTMLElement, opcoes: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: Api }
}

let carregando: Promise<void> | null = null;

/** Carrega o script uma vez só, mesmo com dois formulários na mesma página. */
function carregarScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise<void>((resolver, recusar) => {
    const tag = document.createElement("script");
    tag.src = SCRIPT;
    tag.async = true;
    tag.onload = () => resolver();
    tag.onerror = () => { carregando = null; recusar(new Error("Turnstile não carregou")); };
    document.head.appendChild(tag);
  });
  return carregando;
}

/**
 * O quadro do CAPTCHA.
 *
 * O TOKEN VALE UMA VEZ SÓ, e é aí que mora o defeito clássico: a pessoa erra a
 * senha, o token é gasto na tentativa, ela corrige a senha e a segunda
 * tentativa é recusada pelo CAPTCHA — mas a tela diz "senha inválida" de novo,
 * porque é isso que o Supabase responde. A pessoa jura que a senha está certa,
 * e está mesmo.
 *
 * Por isso quem chama passa `key={tentativa}` e incrementa a cada erro: o
 * componente é remontado, o quadro antigo é removido e nasce um token novo.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  // O callback numa ref para o efeito não depender da identidade dele — sem
  // isso, cada render do formulário destruiria e recriaria o quadro. A ref é
  // atualizada num efeito, e não durante o render: escrever em ref no meio do
  // render quebra a renderização concorrente do React.
  const aviso = useRef(onToken);
  useEffect(() => { aviso.current = onToken; });

  useEffect(() => {
    if (!CHAVE || !caixa.current) return;
    let id: string | null = null;
    let vivo = true;

    carregarScript()
      .then(() => {
        if (!vivo || !caixa.current || !window.turnstile) return;
        id = window.turnstile.render(caixa.current, {
          sitekey: CHAVE,
          language: "pt-BR",
          theme: "auto",
          appearance: "interaction-only",
          callback: (token: string) => aviso.current(token),
          // Token vencido ou erro de rede zeram o que temos. Melhor mandar
          // vazio e o Supabase recusar com clareza do que mandar um token
          // morto e receber uma mensagem que não explica nada.
          "expired-callback": () => aviso.current(""),
          "error-callback": () => aviso.current(""),
        });
      })
      .catch(() => aviso.current(""));

    return () => {
      vivo = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, []);

  if (!CHAVE) return null;
  return <div className="avnCaptcha" ref={caixa} />;
}
