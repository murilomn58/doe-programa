/** label + dica em volta de um controle de formulário (padrão empilhado do app). */

import type { ReactNode } from "react";

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, htmlFor, className = "", children }: FieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label ? (
        <label htmlFor={htmlFor} className="text-sm text-foreground-soft">
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </div>
  );
}
