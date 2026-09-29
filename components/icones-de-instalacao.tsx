/**
 * Os glifos do caminho de instalar.
 *
 * DESENHADOS, e não fotografados. A instrução escrita — "toque em
 * Compartilhar" — depende de a pessoa saber qual é o botão de compartilhar, e
 * no iPhone ele é um quadrado com uma seta que ninguém chama por esse nome.
 * Uma captura de tela resolveria, mas envelhece a cada versão do iOS e pesa:
 * em SVG o ícone acompanha o tema, não borra em tela retina e não custa uma
 * requisição.
 *
 * MORAM AQUI, e não dentro da faixa, porque agora são dois lugares que ensinam
 * o mesmo caminho: a faixa que aparece dentro do sistema e a página /app, que
 * é o destino do botão do e-mail da escala. Dois desenhos do mesmo ícone
 * divergem na primeira correção, e aí uma das duas telas mostra um botão que
 * não existe mais.
 *
 * Sem "use client": são funções puras que devolvem SVG, e servem tanto à faixa
 * (que é cliente) quanto à página (que é servidor).
 */

/** O quadrado com a seta para cima, da barra de baixo do Safari. */
export function IconeCompartilhar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v11M12 3l-3.2 3.2M12 3l3.2 3.2" />
      <path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v7A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 18.5 10H17" />
    </svg>
  );
}

/** O quadrado com o "+", do item "Adicionar à Tela de Início". */
export function IconeAdicionar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

/** Os três pontos do menu dos navegadores embutidos — e do Chrome no Android. */
export function IconeMais() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** O glifo certo para um passo, ou nada quando o passo não tem ilustração. */
export function GlifoDoPasso({ nome }: { nome: string | null }) {
  if (nome === "compartilhar") return <IconeCompartilhar />;
  if (nome === "adicionar") return <IconeAdicionar />;
  if (nome === "mais") return <IconeMais />;
  return null;
}
