"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { warmUpEngine } from "@/engine/client";
import { EngineStatusBar } from "@/components/EngineStatusBar";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  // Boot do motor científico local (Pyodide) assim que o app abre, e registro
  // do service worker que cacheia o runtime pra visita seguinte abrir rápido.
  useEffect(() => {
    warmUpEngine();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/engine-sw.js").catch(() => {
        // cache é otimização: sem SW o app continua funcionando online
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <EngineStatusBar />
      {children}
    </QueryClientProvider>
  );
}
