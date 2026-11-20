// O iPhone dá zoom na página quando se toca num campo com letra menor que
// 16 px, e não desfaz sozinho: a ficha anestésica fica ampliada e cortada
// (19/11/2026: "quando vai clicar nos campos do peso, dos exames, dá zoom na
// página, fica esquisito, corta"). Os campos da ficha têm 14,5 px de
// propósito — é o tamanho que cabe na grade do papel.
//
// O CONSERTO É SÓ NO iOS. Com `maximum-scale=1` no viewport, o Safari (e todo
// navegador do iPhone e do iPad, que são WebKit) deixa de dar esse zoom ao
// tocar no campo — e o zoom de pinça continua: desde o iOS 10 ele ignora essa
// trava para o gesto da pessoa. No Android a mesma trava BLOQUEARIA a pinça
// (e o Android nem tem o zoom do campo), por isso ela não vai para todos: o
// roteiro olha o aparelho antes.
//
// Reaplica se o viewport for trocado ao navegar: o Next monta a meta, e uma
// troca dela não pode trazer o zoom de volta.

/** A parte que o roteiro acrescenta ao viewport. */
export const SEM_ZOOM = "maximum-scale=1";

/** iPhone, iPod e iPad (o iPadOS se apresenta como Mac, com tela de toque). */
export function ehIos(nav: { userAgent?: string; platform?: string; maxTouchPoints?: number }): boolean {
  return /iP(hone|ad|od)/.test(nav.userAgent ?? "")
    || (nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1);
}

/** O viewport com a trava do zoom do campo; sem repetir quando ela já está lá. */
export function comSemZoom(conteudo: string): string {
  if (/maximum-scale\s*=/.test(conteudo)) return conteudo;
  const base = conteudo.trim().replace(/,\s*$/, "");
  return base ? `${base}, ${SEM_ZOOM}` : `width=device-width, initial-scale=1, ${SEM_ZOOM}`;
}

/**
 * O roteiro que vai no <head>, antes de a pessoa tocar em qualquer campo.
 * Mesma regra de ehIos e comSemZoom, escrita em JavaScript puro e curto: roda
 * antes do React, e erro nenhum aqui pode derrubar a página.
 */
export const ROTEIRO_SEM_ZOOM_NO_IPHONE =
  "(function(){try{var n=navigator;" +
  "if(!(/iP(hone|ad|od)/.test(n.userAgent||'')||(n.platform==='MacIntel'&&(n.maxTouchPoints||0)>1)))return;" +
  "var p=function(){var ms=document.querySelectorAll('meta[name=\"viewport\"]');" +
  "for(var i=0;i<ms.length;i++){var c=ms[i].getAttribute('content')||'';" +
  "if(!/maximum-scale\\s*=/.test(c))ms[i].setAttribute('content',(c.trim().replace(/,\\s*$/,'')||'width=device-width, initial-scale=1')+', " + SEM_ZOOM + "')}};" +
  "p();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',p);" +
  "if(window.MutationObserver)new MutationObserver(p).observe(document.head||document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['content']})" +
  "}catch(e){}})();";
