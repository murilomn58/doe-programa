import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "DoE Programa",
  description: "Planejamento de Experimentos (Design of Experiments)",
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
