/** Cliente do motor científico local (Web Worker + Pyodide).
 *
 * Singleton no main thread: cria o worker uma vez, faz request/response por id
 * e expõe o estado de boot pra UI (banner de status). Nenhum componente fala
 * com o worker diretamente; a camada src/api/* usa `callEngine`.
 */

export type EngineStage =
  | "idle"
  | "loading-runtime"
  | "loading-packages"
  | "loading-engine"
  | "importing"
  | "ready-analysis"
  | "loading-export"
  | "ready-export"
  | "export-failed"
  | "boot-failed";

export interface EngineStatus {
  stage: EngineStage;
  detail: string | null;
  analysisReady: boolean;
  exportReady: boolean;
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

let currentStatus: EngineStatus = {
  stage: "idle",
  detail: null,
  analysisReady: false,
  exportReady: false,
};
const listeners = new Set<(s: EngineStatus) => void>();

function notify() {
  for (const fn of listeners) fn(currentStatus);
}

function ensureWorker(): Worker {
  if (worker) return worker;
  if (typeof window === "undefined") {
    throw new Error("O motor local só roda no navegador.");
  }
  worker = new Worker("/py-engine/worker.js");
  worker.onmessage = (event) => {
    const data = event.data || {};
    if (data.type === "status") {
      const stage = data.stage as EngineStage;
      currentStatus = {
        stage,
        detail: data.detail ?? null,
        analysisReady:
          currentStatus.analysisReady ||
          stage === "ready-analysis" ||
          stage === "loading-export" ||
          stage === "ready-export" ||
          stage === "export-failed",
        exportReady: currentStatus.exportReady || stage === "ready-export",
      };
      notify();
      return;
    }
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) entry.resolve(data.result);
    else entry.reject(new Error(data.error || "Falha no motor local."));
  };
  worker.onerror = (event) => {
    currentStatus = {
      ...currentStatus,
      stage: "boot-failed",
      detail: event.message || "Falha ao iniciar o worker.",
    };
    notify();
  };
  return worker;
}

/** Dispara o boot do motor (idempotente). Chamar cedo no app. */
export function warmUpEngine(): void {
  try {
    ensureWorker();
  } catch {
    // SSR: ignora
  }
}

export function getEngineStatus(): EngineStatus {
  return currentStatus;
}

export function subscribeEngineStatus(fn: (s: EngineStatus) => void): () => void {
  listeners.add(fn);
  fn(currentStatus);
  return () => listeners.delete(fn);
}

export function callEngine<T>(op: string, args?: Record<string, unknown>): Promise<T> {
  const w = ensureWorker();
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ id, op, args: args ?? {} });
  });
}
