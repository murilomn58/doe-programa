/**
 * Cartão de um caderno das apostilas: número, título, resumo, tópicos, número de
 * páginas e os dois caminhos para o PDF (abrir em nova aba ou baixar).
 *
 * Presentational puro: recebe a apostila pronta, não busca nem calcula nada.
 */

import type { Apostila } from "@/domain/apostilas";

interface ApostilaCardProps {
  apostila: Apostila;
}

const ACAO_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1";

export function ApostilaCard({ apostila }: ApostilaCardProps) {
  const { numero, titulo, resumo, topicos, paginas, pdf } = apostila;
  const identificacao = `caderno ${numero}, ${titulo}`;

  return (
    <article className="rounded-2xl border border-border bg-surface-1 p-6 shadow-sm transition-colors hover:border-accent-border sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-7">
        {/* Trilho do número: mono teal, na linguagem das pílulas do hub. */}
        <div
          aria-hidden
          className="flex items-center gap-3 sm:w-16 sm:shrink-0 sm:flex-col sm:items-start sm:gap-1.5"
        >
          <span className="font-mono text-[40px] font-semibold leading-none tracking-tighter text-accent-strong sm:text-[46px]">
            {String(numero).padStart(2, "0")}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            caderno
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold leading-snug tracking-tight text-foreground-strong sm:text-[22px]">
            <span className="sr-only">Caderno {numero}. </span>
            {titulo}
          </h3>

          <p className="mt-2 text-[15px] leading-relaxed text-muted">{resumo}</p>

          <ul aria-label={`Tópicos do ${identificacao}`} className="mt-4 flex flex-wrap gap-2">
            {topicos.map((topico) => (
              <li
                key={topico}
                className="rounded-full border border-border bg-surface-2 px-2.5 py-1 font-mono text-[11px] leading-4 text-foreground-soft"
              >
                {topico}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
            <a
              href={pdf}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir o ${identificacao}, em PDF, numa nova aba`}
              className={`${ACAO_BASE} bg-primary-strong text-on-primary hover:bg-primary focus-visible:ring-primary-strong`}
            >
              Abrir
              <span aria-hidden>↗</span>
            </a>
            <a
              href={pdf}
              download
              aria-label={`Baixar o ${identificacao} em PDF`}
              className={`${ACAO_BASE} border border-border-strong text-foreground hover:border-accent-strong hover:text-accent-strong focus-visible:ring-accent-strong`}
            >
              Baixar
              <span aria-hidden>↓</span>
            </a>
            <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              {paginas} páginas · pdf
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
