"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  /** O jeito oficial de pedir outro token sem destruir o quadro. */
  reset: (id: string) => void;
  // `ready` existe no objeto do Cloudflare e NÃO entra neste tipo de
  // propósito: chamá-lo com o script carregado em `async` lança exceção, e é
  // assim que este arquivo carrega. Fora do tipo, ninguém chama por engano.
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
export function Turnstile({ onToken, onFalha, aoMontar, tema = "auto" }: {
  onToken: (token: string) => void;
  /** O código de erro do Turnstile, quando ele recusa. Ver `explicarErro`. */
  onFalha?: (codigo: string) => void;
  /** Entrega ao pai a função de pedir outro token. Ver `useCaptcha`. */
  aoMontar?: (resetar: () => void) => void;
  /**
   * Claro, escuro ou pelo sistema.
   *
   * O padrão `auto` segue o SISTEMA OPERACIONAL, não o fundo em que o quadro
   * está — então num computador em modo escuro ele saía preto em cima do
   * cartão branco do login. Quem sabe a cor do fundo é quem coloca o
   * componente na tela, e por isso a escolha vem de fora.
   */
  tema?: "auto" | "light" | "dark";
}) {
  const caixa = useRef<HTMLDivElement>(null);
  // O callback numa ref para o efeito não depender da identidade dele — sem
  // isso, cada render do formulário destruiria e recriaria o quadro. A ref é
  // atualizada num efeito, e não durante o render: escrever em ref no meio do
  // render quebra a renderização concorrente do React.
  const aviso = useRef(onToken);
  const falha = useRef(onFalha);
  const montou = useRef(aoMontar);
  useEffect(() => { aviso.current = onToken; falha.current = onFalha; montou.current = aoMontar; });

  useEffect(() => {
    if (!CHAVE || !caixa.current) return;
    let id: string | null = null;
    let vivo = true;

    // Espera a biblioteca existir, SONDANDO — e nunca com `turnstile.ready()`.
    //
    // O `ready` parece o caminho certo e é uma armadilha aqui: ele LANÇA quando
    // o script foi carregado com `async`, que é exatamente como este arquivo o
    // carrega. Está escrito no próprio api.js do Cloudflare:
    //
    //   ready: function(i){ g.scriptWasLoadedAsync && (…, E("Remove async/defer
    //   from the Turnstile api.js script tag before using turnstile.ready()", 3857))
    //
    // O erro caía no catch abaixo e a tela acusava "o script não carregou" —
    // com o script carregado e funcionando. Custou caro: mandou procurar
    // bloqueador de anúncios e problema de rede que não existiam.
    //
    // E o `ready` não faz falta: ele serve ao script SÍNCRONO, em que o objeto
    // aparece antes de terminar de inicializar. Carregado dinamicamente, quando
    // o `onload` dispara o módulo já rodou até o fim e se registrou.
    const quandoPronto = (fazer: () => void) => {
      let tentativas = 0;
      const olhar = () => {
        if (!vivo) return;
        if (window.turnstile) { fazer(); return; }
        if (++tentativas < 40) setTimeout(olhar, 100);
        else falha.current?.("script-nao-carregou");
      };
      olhar();
    };

    carregarScript()
      .then(() => quandoPronto(() => {
        if (!vivo || !caixa.current || !window.turnstile) return;
        const api = window.turnstile;
        id = api.render(caixa.current, {
          sitekey: CHAVE,
          language: "pt-BR",
          theme: tema,
          // VISÍVEL, e não mais "interaction-only".
          //
          // Invisível é melhor quando funciona e péssimo quando não funciona:
          // não há o que olhar, e a pessoa presa na tela de login não tem
          // nenhuma pista. O quadro do Turnstile mostra sozinho o que está
          // acontecendo — resolvendo, pedindo clique ou recusando o domínio.
          appearance: "always",
          callback: (token: string) => aviso.current(token),
          // Token vencido ou erro de rede zeram o que temos. Melhor mandar
          // vazio e o Supabase recusar com clareza do que mandar um token
          // morto e receber uma mensagem que não explica nada.
          "expired-callback": () => aviso.current(""),
          // O CÓDIGO DO ERRO SOBE. A primeira versão jogava fora, e o
          // resultado foi meia hora de adivinhação com o login travado: a tela
          // dizia "a verificação falhou" sem dizer se o domínio não estava
          // autorizado, se a chave era de outro widget ou se era a rede. O
          // Turnstile diz exatamente qual é — só faltava alguém escutar.
          "error-callback": (codigo: string) => {
            aviso.current("");
            falha.current?.(String(codigo ?? "sem código"));
          },
        });
        // Entrega o "me dê outro token" para quem usa o componente. É o método
        // do próprio Cloudflare, e é por isso que ele existe: destruir e
        // recriar o quadro a cada erro — o que este código fazia antes — faz o
        // desafio seguinte falhar com "Falha na verificação", porque o widget
        // é arrancado no meio do trabalho dele.
        if (id) montou.current?.(() => api.reset(id!));
      }))
      .catch(() => {
        aviso.current("");
        falha.current?.("script-nao-carregou");
      });

    return () => {
      vivo = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
    // `tema` entra nas dependências, e na prática é constante: cada formulário
    // passa um valor fixo. Se um dia virar dinâmico, trocar de cor exige
    // desenhar o quadro de novo mesmo — e a limpeza acima já cuida disso.
  }, [tema]);

  if (!CHAVE) return null;
  return <div className="avnCaptcha" ref={caixa} />;
}

/**
 * Quanto esperar por um token antes de mandar sem ele.
 *
 * Existe porque o contrário é pior. Se o script do Turnstile não carregar —
 * bloqueador de anúncios, rede do hospital, domínio fora da lista do widget —
 * e o envio ficasse preso, a pessoa não entraria NUNCA e a tela não diria por
 * quê. Mandando sem token, ela ao menos lê o motivo real vindo do servidor.
 */
const ESPERA = 6000;

/**
 * O CAPTCHA inteiro, pronto para um formulário.
 *
 * Nasceu de dois defeitos em produção, nesta ordem:
 *
 * 1. O token vale UMA vez. Depois de uma senha errada, a segunda tentativa
 *    saía sem token — o novo ainda estava sendo gerado quando a pessoa clicou
 *    de novo — e a tela dizia "a verificação de segurança falhou" para quem
 *    tinha acabado de digitar a senha CERTA.
 *
 * 2. A primeira correção foi desabilitar o botão até o token chegar. Pior: o
 *    token nunca chegava (o domínio não estava na lista do widget), e o botão
 *    ficava eternamente em "Verificando segurança...". Uma proteção opcional
 *    virou uma tranca — inclusive com o CAPTCHA DESLIGADO no Supabase, porque
 *    a trava era do lado de cá.
 *
 * QUEM ESPERA É O ENVIO, NÃO A PESSOA. O botão está sempre disponível; ao
 * clicar, o formulário aguarda alguns segundos por um token e vai de qualquer
 * jeito depois disso. Nunca há um beco sem saída, e o pior caso é uma
 * mensagem de erro honesta em vez de uma tela morta.
 *
 * Fica num hook, e não repetido em cada formulário, porque são quatro telas
 * (entrar, criar conta, recuperar senha, trocar senha) e a que ficasse de fora
 * seria justamente a que ninguém testa.
 */
export function useCaptcha(tema: "auto" | "light" | "dark" = "auto") {
  const [token, setToken] = useState("");
  const [erro, setErro] = useState("");
  // O mesmo token numa ref: `esperarToken` roda dentro do envio, fora do
  // ciclo de render, e lá o valor do estado estaria congelado no do clique.
  const agora = useRef("");
  const resetar = useRef<(() => void) | null>(null);

  const guardar = useCallback((valor: string) => {
    agora.current = valor;
    setToken(valor);
  }, []);

  const registrar = useCallback((fn: () => void) => { resetar.current = fn; }, []);

  return {
    /**
     * O quadro. Montado UMA vez e reaproveitado.
     *
     * A versão anterior o remontava a cada erro, com uma `key` que mudava.
     * Parecia certo — quadro novo, token novo — e produzia "Falha na
     * verificação" na segunda tentativa: o widget era arrancado no meio do
     * desafio. Renovar é `reset`, e é o Cloudflare quem oferece.
     */
    widget: <Turnstile onToken={guardar} onFalha={setErro} aoMontar={registrar} tema={tema} />,
    /**
     * Espera um token por alguns segundos e devolve o que houver.
     *
     * Devolver "" é um resultado legítimo, não uma falha: significa "não
     * consegui, siga assim mesmo e deixe o servidor explicar".
     */
    async esperarToken() {
      if (!CHAVE) return "";
      const limite = Date.now() + ESPERA;
      while (!agora.current && Date.now() < limite) {
        await new Promise((r) => setTimeout(r, 120));
      }
      return agora.current;
    },
    /**
     * A recusa do Turnstile, já em português, quando houve uma.
     *
     * Vale mais do que parece: sem isto a tela diz "a verificação falhou" e
     * pronto — e domínio fora da lista, chave de outro widget e queda de rede
     * pedem coisas completamente diferentes.
     */
    recusa: erro ? explicarErro(erro) : "",
    /** Chame depois de CADA erro: gasta o token velho e pede outro. */
    reiniciar: () => { guardar(""); setErro(""); resetar.current?.(); },
    /** Só para depuração e testes. */
    token,
  };
}

/**
 * O que o código de erro do Turnstile quer dizer, em português.
 *
 * Os que aparecem de verdade numa instalação nova. `110200` é o campeão: a
 * chave existe, o script carrega, tudo parece certo — e o domínio simplesmente
 * não está na lista do widget no painel do Cloudflare.
 */
export function explicarErro(codigo: string): string {
  const c = String(codigo ?? "");
  if (c.startsWith("1102")) {
    return `o domínio deste site não está na lista do widget, no painel do Cloudflare (${c})`;
  }
  if (c.startsWith("1100") || c.startsWith("1101")) {
    return `a chave do site (Site Key) é inválida ou é de outro widget (${c})`;
  }
  if (c.startsWith("1060") || c.startsWith("3000") || c.startsWith("6")) {
    return `o desafio expirou ou foi recusado; recarregar a página costuma resolver (${c})`;
  }
  if (c === "script-nao-carregou") {
    return "o script do Cloudflare não carregou nesta rede ou foi bloqueado por uma extensão do navegador";
  }
  if (c.startsWith("2")) return `falha de rede ao falar com o Cloudflare (${c})`;
  // O código cru sempre acompanha. Uma tradução que engole o número original
  // devolve o problema de onde ele veio: dá para procurar "300010" na
  // documentação do Cloudflare, não dá para procurar "falhou".
  return `o Cloudflare recusou o desafio (código ${c})`;
}
