/**
 * Registro de conta (beta): envia o email pro route handler /api/conta.
 * Única chamada de rede do app além do CDN do Pyodide; nunca bloqueia o uso.
 */

export async function registrarConta(email: string): Promise<boolean> {
  try {
    const res = await fetch("/api/conta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, origem: "doe-app" }),
    });
    return res.ok;
  } catch {
    // offline ou rede indisponível: o email fica salvo localmente mesmo assim
    return false;
  }
}
