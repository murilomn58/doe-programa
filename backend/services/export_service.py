"""Table + report export (issue 09).

Three concerns, kept in one lane and framework-free:

1. **CSV PT-BR** (:func:`to_csv_ptbr`): generic tabular writer with the
   Brazilian conventions — ``;`` field separator, ``,`` decimal, ``utf-8-sig``
   (BOM so Excel opens it correctly). Serves ANOVA, coefficients and the design
   matrix through the same ``(headers, rows)`` shape.
2. **Excel multi-aba** (:func:`to_xlsx`): XlsxWriter workbook in memory with the
   sheets "ANOVA", "Coeficientes" and "Matriz de projeto" (coded + natural
   factor columns + measured responses), bold header, PT-BR number format.
3. **PDF report** (:func:`build_report_pdf`): drives Playwright (Chromium
   headless) against the Next.js ``/report`` route, waits for the
   ``#report-ready`` sentinel (Plotly rendered), then ``page.pdf`` -> bytes.
   Playwright is isolated HERE.

Only :class:`ExportService` knows the repository/analysis; the writers above are
pure functions over already-computed numbers (single source of truth: the same
``AnalysisResultData`` the ``/analysis`` endpoint serves).
"""

from __future__ import annotations

import io
from typing import Protocol

from domain.analysis import AnalysisResultData, AnovaRow
from domain.errors import ExperimentNotFoundError, InsufficientDataError
from domain.models import Experiment, Factor, Response, Run
from domain.types import RSMModel
from services.analysis_service import AnalysisService

# --- media types + filenames -------------------------------------------------

CSV_MEDIA_TYPE = "text/csv; charset=utf-8"
XLSX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)
PDF_MEDIA_TYPE = "application/pdf"

# The three tables a CSV export can render.
TABLE_KINDS = {"anova", "coefficients", "design_matrix"}

_TABLE_SLUG = {
    "anova": "anova",
    "coefficients": "coeficientes",
    "design_matrix": "matriz-de-projeto",
}


class TableExportError(ValueError):
    """A table cannot be exported as requested (bad ``table`` token, saturated
    model without the requested table, etc.). Routed to HTTP 422."""


# --- PT-BR formatting --------------------------------------------------------


def _pt(value: object) -> str:
    """Render one cell for CSV: floats with ``,`` decimal, ``None`` -> empty."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Sim" if value else "Nao"
    if isinstance(value, float):
        if value != value:  # NaN
            return ""
        if value in (float("inf"), float("-inf")):
            return ""
        return format(value, ".6f").replace(".", ",")
    if isinstance(value, int):
        return str(value)
    return str(value)


def _csv_field(text: str) -> str:
    """Quote a field if it contains the separator, a quote or a newline."""
    if any(ch in text for ch in (";", '"', "\n", "\r")):
        return '"' + text.replace('"', '""') + '"'
    return text


def to_csv_ptbr(rows: list[list[object]], headers: list[str]) -> bytes:
    """Serialize a generic table to PT-BR CSV bytes.

    ``sep=';'``, ``decimal=','``, ``utf-8-sig`` (BOM). Floats formatted to 6
    decimals; ``None``/NaN become empty cells. Serves ANOVA, coefficients and
    the design matrix — every table funnels through this one function.
    """
    lines: list[str] = []
    lines.append(";".join(_csv_field(str(h)) for h in headers))
    for row in rows:
        lines.append(";".join(_csv_field(_pt(cell)) for cell in row))
    text = "\r\n".join(lines) + "\r\n"
    return text.encode("utf-8-sig")


# --- tabular projections of the analysis result ------------------------------

ANOVA_HEADERS = ["Fonte", "SQ", "GL", "QM", "F", "p-valor"]
COEF_HEADERS = [
    "Termo",
    "Coef. (codificado)",
    "Coef. (natural)",
    "Erro padrao",
    "t",
    "p-valor",
    "IC inferior",
    "IC superior",
    "VIF",
]


def _anova_rows(result: AnalysisResultData) -> list[AnovaRow]:
    """ANOVA lines in display order: model terms, then the pooled rows."""
    rows: list[AnovaRow] = list(result.anova)
    for extra in (result.lack_of_fit, result.pure_error, result.total):
        if extra is not None:
            rows.append(extra)
    return rows


def anova_table(result: AnalysisResultData) -> tuple[list[str], list[list[object]]]:
    rows = [
        [r.source, r.ss, r.df, r.ms, r.f, r.p] for r in _anova_rows(result)
    ]
    return ANOVA_HEADERS, rows


def coefficients_table(
    result: AnalysisResultData,
) -> tuple[list[str], list[list[object]]]:
    rows: list[list[object]] = []
    for c in result.coefficients:
        rows.append(
            [
                c.term,
                c.coef_coded,
                c.coef_natural,
                c.std_err,
                c.t,
                c.p,
                c.ci_low,
                c.ci_high,
                c.vif,
            ]
        )
    return COEF_HEADERS, rows


def _coded_of(run: Run, factor_name: str) -> float | None:
    cell = (run.cells or {}).get(factor_name)
    if not cell:
        return None
    return cell.get("coded")


def _natural_of(run: Run, factor_name: str) -> object:
    """Natural value if present, else the coded label / value (qualitative)."""
    cell = (run.cells or {}).get(factor_name)
    if not cell:
        return None
    natural = cell.get("natural")
    if natural is not None:
        return natural
    label = cell.get("label")
    if label is not None:
        return label
    return cell.get("coded")


def design_matrix_table(
    factors: list[Factor],
    responses: list[Response],
    runs: list[Run],
) -> tuple[list[str], list[list[object]]]:
    """Wide OriginPro-style matrix: order + coded/natural factors + responses."""
    headers: list[str] = ["Ensaio", "StdOrder"]
    for f in factors:
        headers.append(f"{f.name} (cod.)")
        unit = f" ({f.unit})" if f.unit else ""
        headers.append(f"{f.name}{unit}")
    for r in responses:
        unit = f" ({r.unit})" if r.unit else ""
        headers.append(f"{r.name}{unit}")

    rows: list[list[object]] = []
    for run in runs:
        row: list[object] = [run.run_order, run.std_order]
        for f in factors:
            row.append(_coded_of(run, f.name))
            row.append(_natural_of(run, f.name))
        for r in responses:
            row.append((run.response_values or {}).get(r.name))
        rows.append(row)
    return headers, rows


def table_for(
    kind: str,
    result: AnalysisResultData,
    factors: list[Factor],
    responses: list[Response],
    runs: list[Run],
) -> tuple[list[str], list[list[object]]]:
    """Dispatch ``kind`` -> ``(headers, rows)``. Raises for an unknown token."""
    if kind == "anova":
        return anova_table(result)
    if kind == "coefficients":
        return coefficients_table(result)
    if kind == "design_matrix":
        return design_matrix_table(factors, responses, runs)
    raise TableExportError(
        f"Tabela '{kind}' desconhecida. Opcoes: {sorted(TABLE_KINDS)}."
    )


def filename_for_table(kind: str, response_name: str, ext: str) -> str:
    slug = _TABLE_SLUG.get(kind, kind)
    safe_resp = _slug(response_name)
    return f"{slug}_{safe_resp}.{ext}"


def _slug(text: str) -> str:
    return "".join(ch if ch.isalnum() else "-" for ch in text).strip("-").lower()


# --- Excel multi-aba (XlsxWriter) --------------------------------------------


def to_xlsx(
    result: AnalysisResultData,
    factors: list[Factor],
    responses: list[Response],
    runs: list[Run],
) -> bytes:
    """Build the multi-sheet workbook in memory and return its bytes.

    Sheets: "ANOVA", "Coeficientes", "Matriz de projeto". Header row bold,
    numbers in the PT-BR ``#.##0,000000`` format. XlsxWriter writes to a
    ``BytesIO`` — nothing touches disk.
    """
    import xlsxwriter  # local import: keeps the module import cheap

    buf = io.BytesIO()
    workbook = xlsxwriter.Workbook(buf, {"in_memory": True})
    header_fmt = workbook.add_format({"bold": True, "border": 1, "bg_color": "#EEEEEE"})
    num_fmt = workbook.add_format({"num_format": "#,##0.000000"})

    anova_headers, anova_rows = anova_table(result)
    _write_sheet(workbook, "ANOVA", anova_headers, anova_rows, header_fmt, num_fmt)

    coef_headers, coef_rows = coefficients_table(result)
    _write_sheet(
        workbook, "Coeficientes", coef_headers, coef_rows, header_fmt, num_fmt
    )

    dm_headers, dm_rows = design_matrix_table(factors, responses, runs)
    _write_sheet(
        workbook, "Matriz de projeto", dm_headers, dm_rows, header_fmt, num_fmt
    )

    workbook.close()
    return buf.getvalue()


def _write_sheet(
    workbook,
    name: str,
    headers: list[str],
    rows: list[list[object]],
    header_fmt,
    num_fmt,
) -> None:
    sheet = workbook.add_worksheet(name[:31])  # Excel caps sheet names at 31
    for col, head in enumerate(headers):
        sheet.write_string(0, col, str(head), header_fmt)
        sheet.set_column(col, col, max(len(str(head)) + 2, 12))
    for r, row in enumerate(rows, start=1):
        for c, value in enumerate(row):
            _write_cell(sheet, r, c, value, num_fmt)
    sheet.freeze_panes(1, 0)


def _write_cell(sheet, row: int, col: int, value: object, num_fmt) -> None:
    if value is None:
        sheet.write_blank(row, col, None)
        return
    if isinstance(value, bool):
        sheet.write_string(row, col, "Sim" if value else "Nao")
        return
    if isinstance(value, float):
        if value != value or value in (float("inf"), float("-inf")):
            sheet.write_blank(row, col, None)
            return
        sheet.write_number(row, col, value, num_fmt)
        return
    if isinstance(value, int):
        sheet.write_number(row, col, value)
        return
    sheet.write_string(row, col, str(value))


# --- PDF report via Playwright (Chromium headless) ---------------------------


async def build_report_pdf(
    url: str,
    ready_selector: str = "#report-ready",
    timeout_ms: int = 30_000,
) -> bytes:
    """Render ``url`` to an A4 PDF via headless Chromium.

    Navigates to the Next.js ``/report`` route, waits for ``ready_selector``
    (the page sets ``#report-ready`` once every Plotly chart has drawn), then
    captures ``page.pdf`` with backgrounds on. Playwright is used ONLY here so
    the rest of the export lane stays sync/pure.

    Raises :class:`ReportRenderError` if the browser cannot start or the page
    never becomes ready (the router maps it to HTTP 502/422).
    """
    from playwright.async_api import async_playwright

    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(args=["--no-sandbox"])
            try:
                page = await browser.new_page()
                await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
                await page.wait_for_selector(ready_selector, timeout=timeout_ms)
                pdf = await page.pdf(
                    format="A4",
                    print_background=True,
                    margin={
                        "top": "12mm",
                        "bottom": "12mm",
                        "left": "10mm",
                        "right": "10mm",
                    },
                )
            finally:
                await browser.close()
    except Exception as exc:  # noqa: BLE001 — wrap any Playwright failure
        raise ReportRenderError(
            f"Falha ao gerar o relatorio PDF a partir de {url}: {exc}"
        ) from exc
    return pdf


class ReportRenderError(RuntimeError):
    """The PDF report could not be rendered (browser missing / page timeout)."""


# --- repository port + service -----------------------------------------------


class ExportRepository(Protocol):
    """Read-only port (same shape as the run/analysis repo)."""

    async def get_experiment(self, experiment_id: int) -> Experiment | None: ...

    async def get_factors(self, experiment_id: int) -> list[Factor]: ...

    async def get_responses(self, experiment_id: int) -> list[Response]: ...

    async def get_runs(self, experiment_id: int) -> list[Run]: ...


class ExportService:
    """Orchestrates table/report export off the shared analysis result.

    Reuses :class:`AnalysisService` for the exact ``AnalysisResultData`` the
    ``/analysis`` endpoint serves, then formats it as CSV/XLSX, or delegates a
    ``/report`` URL to :func:`build_report_pdf` for the PDF.
    """

    def __init__(self, repo: ExportRepository) -> None:
        self._repo = repo
        self._analysis = AnalysisService(repo)

    async def export_table_csv(
        self,
        experiment_id: int,
        response_name: str,
        model: RSMModel,
        table: str,
    ) -> tuple[bytes, str]:
        """Return ``(csv_bytes, filename)`` for the requested table.

        Raises ``ExperimentNotFoundError`` (404), ``InsufficientDataError`` /
        ``TableExportError`` (422) exactly like the analysis flow.
        """
        if table not in TABLE_KINDS:
            raise TableExportError(
                f"Tabela '{table}' desconhecida. Opcoes: {sorted(TABLE_KINDS)}."
            )
        result, factors, responses, runs = await self._load(
            experiment_id, response_name, model
        )
        headers, rows = table_for(table, result, factors, responses, runs)
        content = to_csv_ptbr(rows, headers)
        return content, filename_for_table(table, response_name, "csv")

    async def export_xlsx(
        self,
        experiment_id: int,
        response_name: str,
        model: RSMModel,
    ) -> tuple[bytes, str]:
        """Return ``(xlsx_bytes, filename)`` for the 3-sheet workbook."""
        result, factors, responses, runs = await self._load(
            experiment_id, response_name, model
        )
        content = to_xlsx(result, factors, responses, runs)
        return content, filename_for_table("design_matrix", response_name, "xlsx")

    async def export_report_pdf(
        self, url: str, ready_selector: str = "#report-ready"
    ) -> bytes:
        """Render the given ``/report`` URL to PDF bytes via Playwright."""
        return await build_report_pdf(url, ready_selector=ready_selector)

    async def _load(
        self, experiment_id: int, response_name: str, model: RSMModel
    ) -> tuple[AnalysisResultData, list[Factor], list[Response], list[Run]]:
        result = await self._analysis.analyze(experiment_id, response_name, model)
        factors = await self._repo.get_factors(experiment_id)
        responses = await self._repo.get_responses(experiment_id)
        runs = await self._repo.get_runs(experiment_id)
        return result, factors, responses, runs


# Imported so the router/tests can assert these propagate from the analysis lane.
_DOMAIN_ERRORS = (ExperimentNotFoundError, InsufficientDataError)

__all__ = [
    "ExportService",
    "ExportRepository",
    "TableExportError",
    "ReportRenderError",
    "to_csv_ptbr",
    "to_xlsx",
    "build_report_pdf",
    "table_for",
    "anova_table",
    "coefficients_table",
    "design_matrix_table",
    "filename_for_table",
    "TABLE_KINDS",
    "CSV_MEDIA_TYPE",
    "XLSX_MEDIA_TYPE",
    "PDF_MEDIA_TYPE",
]
