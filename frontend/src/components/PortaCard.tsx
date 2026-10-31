/**
 * Uma das duas portas de entrada do portal (`/`): aprender ou planejar, cada
 * uma levando a uma rota inteira.
 *
 * Presentational puro. Reaproveita a estrutura do cartão que já existia no
 * antigo `Dashboard.tsx` (borda, fundo com o acento a 10%, transição no
 * hover, seta à direita), agora parametrizada por `tom` — teal para o lado
 * didático, terracota para o programa, por ser a ação primária.
 */

import Link from "next/link";

export interface PortaCardProps {
  titulo: string;
  subtitulo: string;
  href: string;
  tom: "accent" | "primary";
}

const TONS: Record<PortaCardProps["tom"], { borda: string; fundo: string; seta: string }> = {
  accent: {
    borda: "border-accent-strong",
    fundo: "bg-accent-strong/10 hover:bg-accent-strong/15",
    seta: "text-accent",
  },
  primary: {
    borda: "border-primary-strong",
    fundo: "bg-primary-strong/10 hover:bg-primary-strong/15",
    seta: "text-primary",
  },
};

export function PortaCard({ titulo, subtitulo, href, tom }: PortaCardProps) {
  const cor = TONS[tom];

  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-4 rounded-xl border ${cor.borda} ${cor.fundo} px-6 py-6 transition`}
    >
      <span>
        <span className="block font-display text-lg font-bold text-foreground-strong">
          {titulo}
        </span>
        <span className="mt-1 block text-sm text-foreground-soft">{subtitulo}</span>
      </span>
      <span className={`shrink-0 text-2xl ${cor.seta}`} aria-hidden>
        →
      </span>
    </Link>
  );
}
