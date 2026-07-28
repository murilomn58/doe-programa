import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Mesmas declarações do hub (iacommurilo-hub/app/layout.tsx) — mesmos pesos e
// mesmos nomes de variável, para os arquivos de fonte e as métricas baterem
// entre www.iacommurilo.com.br e research.iacommurilo.com.br.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-grotesk", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const jb = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-jbmono", display: "swap" });

export const metadata: Metadata = {
  title: "Design of Experiments",
  description:
    "Planejamento de experimentos no navegador: matriz, ANOVA, superfície de resposta e ponto ótimo. Grátis na versão beta.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${grotesk.variable} ${plex.variable} ${jb.variable}`}>
      <body className="min-h-screen bg-surface-0 font-sans text-foreground-strong antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
