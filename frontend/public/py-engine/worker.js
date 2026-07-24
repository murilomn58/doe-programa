/* worker.js — Web Worker do motor científico (Pyodide).
 *
 * Roda o MESMO Python validado do backend (statsmodels/scipy/pyDOE3) no
 * browser, em 2 estágios:
 *   estágio 1 (analysis): numpy/pandas/scipy/statsmodels + pyDOE3 + módulos
 *                         do engine → análise/geração habilitadas;
 *   estágio 2 (export):   matplotlib + Pillow + scienceplots → export 600 DPI.
 *
 * Classic worker de propósito (fora do bundler Next): importScripts do CDN.
 * Protocolo: { id, op, args } → { id, ok, result | error } + broadcasts
 * { type: "status", stage, detail }.
 */

/* global loadPyodide, importScripts */

const PYODIDE_VERSION = "0.28.3";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

importScripts(`${PYODIDE_CDN}pyodide.js`);

let pyodide = null;
let engine = null; // módulo engine_api importado
let exportReady = false;
let bootError = null;

const post = (msg) => self.postMessage(msg);
const status = (stage, detail) => post({ type: "status", stage, detail: detail || null });

async function mountEngineFiles() {
  const res = await fetch("/py-engine/manifest.json");
  if (!res.ok) throw new Error(`manifest.json ${res.status}`);
  const manifest = await res.json();
  pyodide.FS.mkdirTree("/engine");
  await Promise.all(
    manifest.files.map(async (rel) => {
      const r = await fetch(`/py-engine/${rel}`);
      if (!r.ok) throw new Error(`${rel} ${r.status}`);
      const text = await r.text();
      const parts = rel.split("/");
      if (parts.length > 1) {
        pyodide.FS.mkdirTree("/engine/" + parts.slice(0, -1).join("/"));
      }
      pyodide.FS.writeFile("/engine/" + rel, text);
    }),
  );
  return manifest;
}

async function bootStage1() {
  status("loading-runtime", "Baixando o ambiente Python (WebAssembly)");
  pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });

  status("loading-packages", "Carregando numpy, pandas, scipy e statsmodels");
  await pyodide.loadPackage(["numpy", "pandas", "scipy", "statsmodels", "pydantic", "micropip"]);

  status("loading-engine", "Instalando o gerador de planejamentos (pyDOE3)");
  const manifest = await mountEngineFiles();
  const micropip = pyodide.pyimport("micropip");
  const pyDoeWheel = manifest.wheels.find((w) => w.toLowerCase().startsWith("pydoe3"));
  await micropip.install(`${self.location.origin}/py-engine/wheels/${pyDoeWheel}`);

  status("importing", "Iniciando o motor de análise");
  pyodide.runPython(`import sys; sys.path.insert(0, "/engine")`);
  engine = pyodide.pyimport("engine_api");
  status("ready-analysis", "Análise e geração de planos prontas");
}

let exportError = null;

async function bootStage2() {
  try {
    status("loading-export", "Carregando o renderizador de figuras (matplotlib)");
    await pyodide.loadPackage(["matplotlib", "Pillow"]);
    const res = await fetch("/py-engine/manifest.json");
    const manifest = await res.json();
    const sciWheel = manifest.wheels.find((w) => w.toLowerCase().startsWith("scienceplots"));
    const micropip = pyodide.pyimport("micropip");
    await micropip.install(`${self.location.origin}/py-engine/wheels/${sciWheel}`);
    // aquece o import (registra o estilo "science")
    pyodide.runPython("from services.publication_service import PublicationService  # noqa");
    exportReady = true;
    status("ready-export", "Exportação em qualidade de publicação pronta");
  } catch (err) {
    // export é opcional: análise continua funcionando
    exportError = String(err && err.message ? err.message : err);
    status("export-failed", exportError);
  }
}

let stage2Promise = null;
const bootPromise = bootStage1()
  .then(() => {
    // estágio 2 em seguida, sem bloquear as chamadas de análise
    stage2Promise = bootStage2();
  })
  .catch((err) => {
    bootError = String(err && err.message ? err.message : err);
    status("boot-failed", bootError);
  });

async function dispatch(op, args) {
  if (op === "ping") return { ready: engine !== null, exportReady };

  await bootPromise;
  if (bootError) throw new Error(`Motor não iniciou: ${bootError}`);

  if (op === "export_plot" || op === "export_plot_report") {
    // Espera o estágio 2 terminar em vez de falhar: o /report e o clique de
    // exportar chegam legitimamente antes do matplotlib acabar de carregar.
    if (stage2Promise) await stage2Promise;
    if (!exportReady) {
      throw new Error(
        exportError
          ? `O exportador de figuras não carregou: ${exportError}`
          : "O exportador de figuras não está disponível.",
      );
    }
  }

  // Fronteira única JS<->Python: strings JSON dos dois lados (sem JsProxy).
  const out = await engine.call_json(op, JSON.stringify(args));
  return out == null || out === "null" ? null : JSON.parse(out);
}

self.onmessage = async (event) => {
  const { id, op, args } = event.data || {};
  if (!id) return;
  try {
    // Normaliza pra JSON puro: remove `undefined` (que o pydantic rejeitaria
    // como valor) e garante objetos planos antes do toPy.
    const cleanArgs = JSON.parse(JSON.stringify(args || {}));
    const result = await dispatch(op, cleanArgs);
    post({ id, ok: true, result });
  } catch (err) {
    // erros de domínio Python chegam como PythonError com a mensagem no fim
    let message = String((err && err.message) || err);
    const marker = message.lastIndexOf("Error: ");
    if (marker >= 0 && message.includes("Traceback")) {
      message = message.slice(marker + "Error: ".length).trim();
    }
    post({ id, ok: false, error: message });
  }
};
