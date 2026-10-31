/** Marca do Design of Experiments: círculo com losango (agulha de bússola). */

interface LogoDoEProps {
  size?: number;
  /** Cor do traço/losango. Padrão = azul claro da capa (fundos escuros). */
  cor?: string;
  /** Cor do círculo; por padrão acompanha `cor` com transparência. */
  corBorda?: string;
  className?: string;
}

export function LogoDoE({
  size = 30,
  cor = "#B5D4F4",
  corBorda,
  className,
}: LogoDoEProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      className={className}
      aria-hidden
    >
      <circle
        cx="15"
        cy="15"
        r="14"
        fill="none"
        stroke={corBorda ?? cor}
        strokeOpacity={corBorda ? 1 : 0.75}
        strokeWidth="1.4"
      />
      <rect
        x="10.5"
        y="10.5"
        width="9"
        height="9"
        fill={cor}
        transform="rotate(45 15 15)"
      />
    </svg>
  );
}
