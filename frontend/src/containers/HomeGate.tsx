"use client";

/**
 * Porta de entrada do app: capa imersiva na primeira visita, portal de duas
 * portas (Início) depois.
 * O gate `montado` evita flash/hydration mismatch (localStorage só no client):
 * até montar, mostra um fundo navy neutro em vez de piscar a capa pra quem
 * já tem conta ou já dispensou.
 *
 * A capa também reabre a pedido, por `?capa=1` na URL (CTAs do hub e o link
 * "Rever a apresentação" do rodapé). O marcador é lido de
 * `window.location.search` dentro do efeito que já existe, e não com
 * `useSearchParams()`: no Next 15 esse hook num componente cliente sem
 * `<Suspense>` faz o `next build` falhar na pré-renderização estática de `/`.
 */

import { useEffect, useState } from "react";

import { CapaEntrada } from "@/containers/CapaEntrada";
import { Inicio } from "@/containers/Inicio";
import { capaPedidaNaUrl, getConta, limparParamCapa } from "@/lib/conta";

export function HomeGate() {
  const [montado, setMontado] = useState(false);
  const [mostrarCapa, setMostrarCapa] = useState(false);
  const [temConta, setTemConta] = useState(false);

  useEffect(() => {
    const conta = getConta();
    setTemConta(conta !== null);
    setMostrarCapa(capaPedidaNaUrl() || conta === null);
    setMontado(true);
  }, []);

  /**
   * A limpeza do parâmetro fica aqui, e não dentro de `CapaEntrada.sair()`,
   * para manter a capa ignorante de semântica de URL: ela só sabe avisar que
   * terminou.
   */
  function entrar() {
    limparParamCapa();
    setMostrarCapa(false);
  }

  if (!montado) {
    return <div className="fixed inset-0 bg-[#04101F]" aria-hidden />;
  }

  if (mostrarCapa) {
    return <CapaEntrada onEntrar={entrar} jaTemConta={temConta} />;
  }

  return <Inicio onVoltarCapa={() => setMostrarCapa(true)} />;
}
