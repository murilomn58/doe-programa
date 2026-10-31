"use client";

/**
 * Diálogo modal simples sobre backdrop. Esc ou clique fora fecham.
 * Renderiza via portal no body: ancestrais com transform (gráficos/animações)
 * quebrariam o position:fixed se o modal ficasse no fluxo da página.
 */

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  children: ReactNode;
}

export function Modal({ aberto, onFechar, titulo, children }: ModalProps) {
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-md rounded-xl border border-border bg-surface-0 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {titulo ? (
          <h2 className="mb-3 text-lg font-semibold text-foreground-strong">
            {titulo}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
