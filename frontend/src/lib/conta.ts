/**
 * Conta local (beta): o email fica no navegador junto com os experimentos.
 * Sync entre dispositivos é fase futura; aqui só decidimos se a capa aparece
 * e se o app já pode parar de pedir email.
 */

export type ContaLocal = {
  email?: string;
  /** Quando o usuário escolheu "Explorar sem conta" na capa. */
  dispensadaEm?: string;
  /** Quando o re-prompt (salvar/exportar) já foi mostrado; no máximo 1x por navegador. */
  perguntadoEm?: string;
};

const CHAVE = "doe-conta";
const RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarEmail(email: string): boolean {
  return RE.test(email.trim());
}

export function getConta(): ContaLocal | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    return JSON.parse(bruto) as ContaLocal;
  } catch {
    return null;
  }
}

function gravar(patch: Partial<ContaLocal>): void {
  if (typeof window === "undefined") return;
  try {
    const atual = getConta() ?? {};
    window.localStorage.setItem(CHAVE, JSON.stringify({ ...atual, ...patch }));
  } catch {
    // storage cheio/bloqueado: a capa volta na próxima visita, nada quebra
  }
}

export function salvarEmailLocal(email: string): void {
  gravar({ email: email.trim().toLowerCase() });
}

export function dispensarCapa(): void {
  gravar({ dispensadaEm: new Date().toISOString() });
}

export function marcarPerguntado(): void {
  gravar({ perguntadoEm: new Date().toISOString() });
}

/** O re-prompt de email (ao salvar/exportar) deve aparecer? */
export function devePedirEmail(): boolean {
  const conta = getConta();
  return !conta?.email && !conta?.perguntadoEm;
}
