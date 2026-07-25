"use client";

/**
 * Porta de entrada do app: capa imersiva na primeira visita, dashboard depois.
 * O gate `montado` evita flash/hydration mismatch (localStorage só no client):
 * até montar, mostra um fundo navy neutro em vez de piscar a capa pra quem
 * já tem conta ou já dispensou.
 */

import { useEffect, useState } from "react";

import { CapaEntrada } from "@/containers/CapaEntrada";
import { Dashboard } from "@/containers/Dashboard";
import { getConta } from "@/lib/conta";

export function HomeGate() {
  const [montado, setMontado] = useState(false);
  const [mostrarCapa, setMostrarCapa] = useState(false);

  useEffect(() => {
    setMostrarCapa(getConta() === null);
    setMontado(true);
  }, []);

  if (!montado) {
    return <div className="fixed inset-0 bg-[#04101F]" aria-hidden />;
  }

  if (mostrarCapa) {
    return <CapaEntrada onEntrar={() => setMostrarCapa(false)} />;
  }

  return <Dashboard />;
}
