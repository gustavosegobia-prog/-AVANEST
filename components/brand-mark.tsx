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
      <path d="M13 108 48 24c3-8 8-13 14-13s11 5 15 14l18 45" fill="none" stroke="#0879db" strokeLinecap="round" strokeLinejoin="round" strokeWidth="13" />
      <path d="M15 108c20-14 36-15 49-3 9 8 18 9 25 2" fill="none" stroke="#1dc7d3" strokeLinecap="round" strokeWidth="10" />
      <path d="M76 83h13l5-19 7 35 8-22 6 10h11" fill="none" stroke="#24d2cf" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
    </svg>
  );
}
