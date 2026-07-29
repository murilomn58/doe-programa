/** Cabeçalho de página: título acento, subtítulo, link de voltar e ações à direita. */

import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Link de voltar (href para navegação, ou onClick para passos internos). */
  back?: { label: string; href?: string; onClick?: () => void };
  right?: ReactNode;
  /** Marca à esquerda do título (ex.: LogoDoE). */
  logo?: ReactNode;
  /** Pílula ao lado do título (ex.: Badge "beta"). */
  badge?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  back,
  right,
  logo,
  badge,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      {back ? (
        back.href ? (
          <Link
            href={back.href}
            className="mb-2 inline-block text-sm text-muted transition hover:text-accent"
          >
            ← {back.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={back.onClick}
            className="mb-2 inline-block text-sm text-muted transition hover:text-accent"
          >
            ← {back.label}
          </button>
        )
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            {logo ?? null}
            <h1 className="font-display text-3xl font-bold tracking-tight text-accent-mid">
              {title}
            </h1>
            {badge ?? null}
          </div>
          {subtitle ? (
            <p className="mt-2 max-w-[60ch] text-base text-foreground-soft">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="flex gap-3">{right}</div> : null}
      </div>
    </header>
  );
}
