"use client";

import { useState, type FormEvent } from "react";

import type { NewExperiment } from "@/domain/experiment";

interface NewExperimentFormProps {
  onCreate: (input: NewExperiment) => void;
  isPending: boolean;
  errorMessage: string | null;
}

export function NewExperimentForm({
  onCreate,
  isPending,
  errorMessage,
}: NewExperimentFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onCreate({
      name: trimmedName,
      description: description.trim() || undefined,
    });
    setName("");
    setDescription("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg"
    >
      <h2 className="mb-4 text-lg font-medium text-slate-200">
        Novo experimento
      </h2>

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Nome</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Fibra de coco no concreto"
            className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Descrição</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Objetivo do experimento (opcional)"
            rows={2}
            className="resize-y rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>

        {errorMessage ? (
          <p className="text-sm text-red-400">{errorMessage}</p>
        ) : null}

        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="self-start rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Criando…" : "Criar experimento"}
        </button>
      </div>
    </form>
  );
}
