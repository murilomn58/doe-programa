import Link from "next/link";

import { Retrospective } from "@/containers/Retrospective";

export default function RetrospectivePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs text-slate-400 transition hover:text-cyan-400"
        >
          ← Voltar ao dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-cyan-400">
          Análise retrospectiva
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Já tem os resultados? Cole a tabela de ensaios (ou importe um CSV) e o
          programa detecta o planejamento por trás dos dados, avalia quais
          modelos são estimáveis e sugere como completar o desenho.
        </p>
      </header>

      <Retrospective />
    </main>
  );
}
