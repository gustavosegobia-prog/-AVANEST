type BrandMarkProps = {
  className?: string;
  /**
   * Sufixo do id do gradiente. Existe por causa de um defeito real.
   *
   * O id de um `<linearGradient>` é global à PÁGINA, e não ao SVG que o contém.
   * Na primeira vez que duas marcas apareceram no mesmo documento, a segunda
   * passou a apontar para o gradiente da primeira — que estava dentro de um
   * bloco `display:none`. O traço sumiu: logo invisível em todas as telas.
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
      <path d="M15 110 51 25c3-8 8-13 14-13s11 5 15 14l32 84" fill="none" stroke={`url(#${id})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="14" />
    </svg>
  );
}
