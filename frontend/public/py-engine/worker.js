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
    status("export-failed", String(err && err.message ? err.message : err));
  }
}

const bootPromise = bootStage1()
  .then(() => {
    // estágio 2 em seguida, sem bloquear as chamadas de análise
    bootStage2();
  })
  .catch((err) => {
    bootError = String(err && err.message ? err.message : err);
    status("boot-failed", bootError);
  });

/** Converte um resultado PyProxy (dict) em objeto JS puro e libera o proxy. */
function toJs(pyResult) {
  if (pyResult && typeof pyResult.toJs === "function") {
    const js = pyResult.toJs({ dict_converter: Object.fromEntries, create_pyproxies: false });
    pyResult.destroy();
    return js;
  }
  return pyResult;
}

async function dispatch(op, args) {
  if (op === "ping") return { ready: engine !== null, exportReady };

  await bootPromise;
  if (bootError) throw new Error(`Motor não iniciou: ${bootError}`);

  const asPy = (obj) => pyodide.toPy(obj);

  switch (op) {
    case "taguchi_catalog":
      return toJs(engine.taguchi_catalog());
    case "generate_design": {
      const req = asPy(args.req);
      try {
        return toJs(engine.generate_design(req));
      } finally {
        req.destroy();
      }
    }
    case "analyze": {
      const bundle = asPy(args.bundle);
      const req = asPy(args.req);
      try {
        return toJs(await engine.analyze(bundle, req));
      } finally {
        bundle.destroy();
        req.destroy();
      }
    }
    case "profiler": {
      const bundle = asPy(args.bundle);
      const req = asPy(args.req);
      try {
        return toJs(await engine.profiler(bundle, req));
      } finally {
        bundle.destroy();
        req.destroy();
      }
    }
    case "export_plot": {
      if (!exportReady) {
        throw new Error(
          "O exportador de figuras ainda está carregando. Tenta de novo em alguns segundos.",
        );
      }
      const bundle = asPy(args.bundle);
      try {
        return toJs(
          await engine.export_plot(
            bundle,
            args.experiment_id,
            args.response_name,
            args.model,
            args.plot,
            args.fmt,
            args.dpi || 600,
            args.factor_x || null,
            args.factor_y || null,
          ),
        );
      } finally {
        bundle.destroy();
      }
    }
    case "export_plot_report": {
      if (!exportReady) {
        throw new Error("O exportador de figuras ainda está carregando.");
      }
      const bundle = asPy(args.bundle);
      try {
        const out = await engine.export_plot_report(
          bundle,
          args.experiment_id,
          args.response_name,
          args.model,
          args.plot,
          args.factor_x || null,
          args.factor_y || null,
        );
        return out === undefined || out === null ? null : toJs(out);
      } finally {
        bundle.destroy();
      }
    }
    case "retro_diagnose": {
      const req = asPy(args.req);
      try {
        return toJs(engine.retro_diagnose(req));
      } finally {
        req.destroy();
      }
    }
    case "retro_materialize": {
      const req = asPy(args.req);
      try {
        return toJs(engine.retro_materialize(req));
      } finally {
        req.destroy();
      }
    }
    default:
      throw new Error(`Operação desconhecida: ${op}`);
  }
}

self.onmessage = async (event) => {
  const { id, op, args } = event.data || {};
  if (!id) return;
  try {
    const result = await dispatch(op, args || {});
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
