"""Golden tests das AULAS (auditoria 2026-07): o motor deve reproduzir os
números impressos no material didático (contexto aulas/) e bater com a
recomputação manual em numpy puro.

Casos:
  1. Peixoto Cap.3 — 2x2 clássico com dados brutos (efeitos 22.5/-13.5/-8.5).
  2. OriginPro 'DOE Analysis.pdf' — 2^2 main-effects (R2, PRESS, ANOVA, ICs).
  3. OriginPro superfície — CCD em blocos: identidades + partição LoF/PE.

A lógica vive em tests/audit/verify_aulas.py (rodável standalone:
``python -m tests.audit.verify_aulas``); aqui cada caso vira um teste.
"""

from tests.audit import verify_aulas


def _run(caso) -> None:
    verify_aulas.FAILS.clear()
    caso()
    assert not verify_aulas.FAILS, "Divergências: " + "; ".join(verify_aulas.FAILS)


def test_golden_peixoto_2x2_dados_brutos():
    _run(verify_aulas.caso_peixoto)


def test_golden_originpro_2x2_main_effects():
    _run(verify_aulas.caso_originpro_2x2)


def test_golden_originpro_ccd_blocos_lof():
    _run(verify_aulas.caso_originpro_ccd)
