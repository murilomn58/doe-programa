/** Área de texto estilizada ao vocabulário de controles. */

import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const BASE =
  "rounded-md border border-border-strong bg-surface-0 px-3 py-2 text-foreground outline-none transition placeholder:text-faint focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50";

export function Textarea({ className = "", ...rest }: TextareaProps) {
  return <textarea className={`${BASE} ${className}`} {...rest} />;
}
