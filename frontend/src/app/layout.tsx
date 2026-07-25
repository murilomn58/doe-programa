import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Design of Experiments",
  description:
    "Planejamento de experimentos no navegador: matriz, ANOVA, superfície de resposta e ponto ótimo. Grátis na versão beta.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-surface-0 font-sans text-foreground-strong antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
