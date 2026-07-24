import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname !== "/login") {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(url);
  }
});

export const config = {
  // Protege tudo exceto: login, rotas de auth, estáticos e a rota /report.
  // Nota CRÍTICA: /report e /api ficam FORA do matcher. O backend usa Playwright
  // (Chromium headless no Railway) para renderizar /report e gerar o PDF; se
  // ficasse atrás do login, o headless não teria sessão e o PDF quebraria.
  // O ID no path de /report é o único "segredo" (aceitável para MVP). Endurecer
  // com token de serviço fica para a Fase 2.
  matcher: [
    "/((?!login|api|report|_next/static|_next/image|favicon.ico|assets).*)",
  ],
};
