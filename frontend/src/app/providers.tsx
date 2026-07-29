"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { warmUpEngine } from "@/engine/client";
import { EngineStatusBar } from "@/components/EngineStatusBar";

/**
 * Única rota que não toca o motor científico local (Pyodide) e por isso não
 * o aquece: o índice de apostilas (`/conteudo`) só serve PDFs estáticos.
 */
const ROTAS_SEM_MOTOR = new Set(["/conteudo"]);

/**
 * Rotas onde o boot do motor é assunto de bastidor, não da tela — por isso
 * aquecem sem mostrar a `EngineStatusBar`.
 *
 * A assimetria entre `/` e `/experiments` (aquecem em silêncio) e `/conteudo`
 * (nem aquece) é proposital, não inconsistência: quem está no portal ou na
 * lista de experimentos tende a seguir direto para `/setup` ou para uma
 * análise, e o minuto de boot adiantado é justamente o que salva a aula
 * presencial, com trinta pessoas abrindo a plataforma ao mesmo tempo. Quem
 * está lendo uma apostila, não — e por isso `/conteudo` fica de fora de
 * `ROTAS_SEM_MOTOR` acima também, sem baixar numpy/scipy/statsmodels à toa.
 */
const ROTAS_SEM_FAIXA = new Set(["/", "/conteudo", "/experiments"]);

export function Providers({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  const aquecerMotor = !ROTAS_SEM_MOTOR.has(pathname);
  const mostrarFaixa = !ROTAS_SEM_FAIXA.has(pathname);

  // Boot do motor científico local (Pyodide), condicionado à rota (ver os
  // conjuntos acima), e registro do service worker que cacheia o runtime pra
  // visita seguinte abrir rápido.
  useEffect(() => {
    if (!aquecerMotor) return;
    warmUpEngine();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/engine-sw.js").catch(() => {
        // cache é otimização: sem SW o app continua funcionando online
      });
    }
  }, [aquecerMotor]);

  return (
    <QueryClientProvider client={queryClient}>
      {mostrarFaixa ? <EngineStatusBar /> : null}
      {children}
    </QueryClientProvider>
  );
}
