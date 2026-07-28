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

/** Marcador de URL que força a capa (usado pelos CTAs do hub). */
export const PARAM_CAPA = "capa";

/** A URL atual pede a capa? Ex.: /?capa=1 vindo de iacommurilo.com.br/research */
export function capaPedidaNaUrl(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(PARAM_CAPA) === "1";
}

/**
 * Remove só o ?capa=1 (preserva utm_*), sem recarregar nem navegar.
 *
 * Não limpa o localStorage de propósito: a capa é um momento de marca, não um
 * logout. Zerar `doe-conta` derrubaria o email salvo e rearmaria o pedido de
 * email, punindo quem só queria rever a apresentação.
 */
export function limparParamCapa(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PARAM_CAPA)) return;
  url.searchParams.delete(PARAM_CAPA);
  // `null` no primeiro argumento: o App Router do Next mescla o próprio estado
  // a partir da versão 14.1.
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
