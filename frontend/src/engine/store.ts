/** Persistência local (IndexedDB) — substitui o SQLite do backend no browser.
 *
 * Modelo simples e migrável: um registro por experimento em `experiments` e o
 * design completo (fatores + níveis + runs + respostas) num único objeto em
 * `designs` (keyPath experiment_id). Ids numéricos preservam o contrato da API
 * antiga. Quando login/sincronização chegarem, esta camada vira o adaptador.
 */

import type { Experiment } from "@/domain/experiment";
import type {
  FactorRead,
  GeneratedDesign,
  ResponseRead,
  RunRead,
  RunsRead,
  ResponseValueUpsert,
} from "@/domain/design";

const DB_NAME = "doe-local";
const DB_VERSION = 1;

interface StoredDesign {
  experiment_id: number;
  design_type: string;
  factors: FactorRead[];
  responses: ResponseRead[];
  runs: RunRead[];
  resolution: number | null;
  aliasing: string[] | null;
  array_name: string | null;
  optimal_efficiency: number | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("experiments")) {
        db.createObjectStore("experiments", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("designs")) {
        db.createObjectStore("designs", { keyPath: "experiment_id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponível."));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha na transação local."));
    tx.onabort = () => reject(tx.error ?? new Error("Transação local abortada."));
  });
}

function reqResult<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao ler o banco local."));
  });
}

// --- experiments ---------------------------------------------------------------

export async function listExperiments(): Promise<Experiment[]> {
  const db = await openDb();
  const tx = db.transaction("experiments", "readonly");
  const all = await reqResult(
    tx.objectStore("experiments").getAll() as IDBRequest<Experiment[]>,
  );
  db.close();
  // mais recente primeiro, como a API fazia
  return all.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}

export async function createExperimentLocal(input: {
  name: string;
  description?: string | null;
}): Promise<Experiment> {
  const db = await openDb();
  const tx = db.transaction("experiments", "readwrite");
  const record = {
    name: input.name,
    description: input.description ?? null,
    created_at: new Date().toISOString(),
  };
  const id = (await reqResult(tx.objectStore("experiments").add(record))) as number;
  await txDone(tx);
  db.close();
  return { id, ...record };
}

// --- designs -------------------------------------------------------------------

/** Persiste um DesignRead vindo do engine, criando o experimento se preciso.
 *  Atribui ids locais a fatores/respostas/runs e devolve o design completo. */
export async function persistGeneratedDesign(
  design: GeneratedDesign,
  opts: { experimentId?: number | null; name?: string | null },
): Promise<GeneratedDesign> {
  let experimentId = opts.experimentId ?? null;
  if (experimentId == null) {
    const created = await createExperimentLocal({
      name: (opts.name ?? "").trim() || "Planejamento fatorial",
    });
    experimentId = created.id;
  }

  const withIds: StoredDesign = {
    experiment_id: experimentId,
    design_type: design.design_type,
    factors: design.factors.map((f, i) => ({ ...f, id: i + 1 })),
    responses: design.responses.map((r, i) => ({ ...r, id: i + 1 })),
    runs: design.runs.map((r, i) => ({
      ...r,
      id: i + 1,
      response_values: r.response_values ?? {},
    })),
    resolution: design.resolution ?? null,
    aliasing: design.aliasing ?? null,
    array_name: design.array_name ?? null,
    optimal_efficiency: design.optimal_efficiency ?? null,
  };

  const db = await openDb();
  const tx = db.transaction("designs", "readwrite");
  tx.objectStore("designs").put(withIds);
  await txDone(tx);
  db.close();

  return {
    ...design,
    experiment_id: experimentId,
    factors: withIds.factors,
    responses: withIds.responses,
    runs: withIds.runs,
  };
}

async function getStoredDesign(experimentId: number): Promise<StoredDesign | null> {
  const db = await openDb();
  const tx = db.transaction("designs", "readonly");
  const design = await reqResult(
    tx.objectStore("designs").get(experimentId) as IDBRequest<StoredDesign | undefined>,
  );
  db.close();
  return design ?? null;
}

export async function getRunsReadLocal(experimentId: number): Promise<RunsRead> {
  const design = await getStoredDesign(experimentId);
  if (!design) {
    throw new Error(`Experimento ${experimentId} não encontrado neste navegador.`);
  }
  return {
    experiment_id: experimentId,
    n_runs: design.runs.length,
    factors: design.factors,
    responses: design.responses,
    runs: design.runs,
  };
}

function parseValue(value: string | null): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveResponsesLocal(
  experimentId: number,
  values: ResponseValueUpsert[],
): Promise<RunsRead> {
  const design = await getStoredDesign(experimentId);
  if (!design) {
    throw new Error(`Experimento ${experimentId} não encontrado neste navegador.`);
  }
  const byRunId = new Map(design.runs.map((r) => [r.id, r]));
  for (const v of values) {
    const run = byRunId.get(v.run_id);
    if (!run) continue;
    run.response_values = {
      ...(run.response_values ?? {}),
      [v.response_name]: parseValue(v.value),
    };
  }
  const db = await openDb();
  const tx = db.transaction("designs", "readwrite");
  tx.objectStore("designs").put(design);
  await txDone(tx);
  db.close();
  return getRunsReadLocal(experimentId);
}

// --- bundle pro motor Python ---------------------------------------------------

/** Monta o bundle que o InMemoryRepo (engine_api.py) hidrata. */
export async function getAnalysisBundle(experimentId: number): Promise<Record<string, unknown>> {
  const design = await getStoredDesign(experimentId);
  if (!design) {
    throw new Error(`Experimento ${experimentId} não encontrado neste navegador.`);
  }
  const db = await openDb();
  const tx = db.transaction("experiments", "readonly");
  const experiment = await reqResult(
    tx.objectStore("experiments").get(experimentId) as IDBRequest<Experiment | undefined>,
  );
  db.close();

  return {
    experiment: {
      id: experimentId,
      name: experiment?.name ?? `Experimento ${experimentId}`,
      description: experiment?.description ?? null,
    },
    factors: design.factors.map((f) => ({
      id: f.id,
      name: f.name,
      factor_type: f.factor_type,
      unit: f.unit,
      position: f.position,
      levels: f.levels,
    })),
    responses: design.responses.map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      position: r.position,
    })),
    runs: design.runs.map((r) => ({
      id: r.id,
      run_order: r.run_order,
      std_order: r.std_order,
      point_type: r.point_type,
      block: r.block,
      replicate: r.replicate,
      cells: r.factors,
      response_values: r.response_values ?? {},
    })),
  };
}
