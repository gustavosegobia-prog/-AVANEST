type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className = "" }: BrandMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 128 128"
      role="img"
    >
      <defs>
        <linearGradient id="avanest-a-gradient" x1="18" y1="16" x2="104" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0879c9" />
          <stop offset=".55" stopColor="#0d8ce1" />
          <stop offset="1" stopColor="#2bc5a8" />
        </linearGradient>
      </defs>
      {/* pathLength="1" normaliza o comprimento do traço para 1. Não muda nada
          no desenho; serve para a animação de abertura poder escrever
          stroke-dasharray:1 sem precisar medir o caminho em pixels — medida
          que mudaria sozinha no dia em que alguém ajustasse o "d". */}
      <path pathLength="1" d="M15 110 51 25c3-8 8-13 14-13s11 5 15 14l32 84" fill="none" stroke="url(#avanest-a-gradient)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="14" />
    </svg>
  );
}
