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
      <path
        d="M14 111 52 22c4-9 9-13 16-13 8 0 13 5 17 14l17 39"
        fill="none"
        stroke="#0879c9"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="23"
      />
      <path
        d="m102 62 22 49"
        fill="none"
        stroke="#2bc5a8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="23"
      />
    </svg>
  );
}
