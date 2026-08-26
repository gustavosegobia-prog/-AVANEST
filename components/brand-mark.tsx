type BrandMarkProps = {
  className?: string;
  /**
   * Sufixo do id do gradiente. Existe por causa de um defeito real.
   *
   * O id de um `<linearGradient>` é global à PÁGINA, e não ao SVG que o contém.
   * Quando a cortina de abertura entrou no layout, passaram a existir duas
   * marcas no mesmo documento com o mesmo id — e a segunda, a do cabeçalho,
   * ficou apontando para um gradiente que mora dentro de um bloco
   * `display:none`. O traço sumiu: logo invisível em todas as telas.
   *
   * Quem desenha mais de uma marca na mesma página passa um sufixo próprio.
   */
  gradiente?: string;
};

export function BrandMark({ className = "", gradiente = "" }: BrandMarkProps) {
  const id = `avanest-a-gradient${gradiente}`;
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 128 128"
      role="img"
    >
      <defs>
        <linearGradient id={id} x1="18" y1="16" x2="104" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0879c9" />
          <stop offset=".55" stopColor="#0d8ce1" />
          <stop offset="1" stopColor="#2bc5a8" />
        </linearGradient>
      </defs>
      {/* pathLength="1" normaliza o comprimento do traço para 1. Não muda nada
          no desenho; serve para a animação de abertura poder escrever
          stroke-dasharray:1 sem precisar medir o caminho em pixels — medida
          que mudaria sozinha no dia em que alguém ajustasse o "d". */}
      <path pathLength="1" d={"M15 110 51 25c3-8 8-13 14-13s11 5 15 14l32 84"} fill="none" stroke={`url(#${id})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="14" />
    </svg>
  );
}
