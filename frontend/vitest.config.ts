import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  css: {
    // Config inline (vazia) para o Vite NAO procurar o postcss.config.mjs da raiz.
    // Aquele arquivo usa a forma abreviada do Next (`plugins: ["@tailwindcss/postcss"]`),
    // que o carregador de PostCSS do Vite rejeita com "Invalid PostCSS Plugin".
    // Os testes nao dependem de CSS processado, entao zero plugin basta.
    postcss: { plugins: [] },
  },
  test: {
    environment: "jsdom",
    // globals: false de proposito. Ligar exigiria "types": ["vitest/globals"]
    // no tsconfig, e um campo `types` explicito desliga a inclusao automatica
    // de @types/node e @types/react, quebrando o `npm run typecheck`.
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    alias: {
      // next/font/google so e transformado pelo compilador do Next; fora dele
      // lanca "Font loaders are only allowed in Next.js".
      "next/font/google": fileURLToPath(new URL("./tests/mocks/next-font.ts", import.meta.url)),
    },
  },
  resolve: {
    // fileURLToPath, nao `new URL(".", import.meta.url).pathname`: no Windows
    // o segundo devolve "/C:/dev/..." e o alias nunca resolve.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
