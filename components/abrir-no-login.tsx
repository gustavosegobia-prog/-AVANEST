"use client";

import { useEffect } from "react";

/**
 * Quando o AVANEST é aberto pelo atalho da tela de início, pula a vitrine.
 *
 * O manifesto declara `start_url: "/login"`, mas o iOS ignora isso: ao usar
 * "Adicionar à Tela de Início" ele guarda o endereço que estava aberto naquele
 * momento. Quem adicionou estando na página inicial fica com um atalho que
 * abre na página de vendas — e quem instalou o atalho já conhece o produto.
 *
 * A checagem é do modo de exibição, não do aparelho: só desvia quem entrou
 * pelo atalho, em janela própria. No navegador comum a página inicial continua
 * sendo a página inicial, que é o que o visitante novo precisa ver.
 *
 * `navigator.standalone` é a forma antiga, do iOS; `display-mode: standalone`
 * é a atual, e vale para Android e para os iOS recentes. As duas juntas cobrem
 * os aparelhos em uso hoje.
 *
 * O destino é a tela de login porque ela já resolve o resto: quem está
 * autenticado é mandado dali direto para o painel.
 */
export function AbrirNoLogin() {
  useEffect(() => {
    const emJanelaPropria =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (emJanelaPropria) window.location.replace("/login");
  }, []);

  return null;
}
