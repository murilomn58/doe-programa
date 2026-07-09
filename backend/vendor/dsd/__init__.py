"""Vendored Definitive Screening Design generator (numpy-only).

Wraps the vendored pure-numpy core ``_compute_dsd`` (from
``definitive-screening-design==0.5.0``, BSD-3, see ``_generalized_dsd.py`` for
the full attribution and license). The upstream ``design.generate`` returns a
pandas DataFrame and maps levels to user values; here we expose ONLY the coded
matrix so the DoE service owns coding/naming. No pandas/matplotlib at runtime.
"""

import numpy as np

from . import _generalized_dsd
from ._generalized_dsd import _compute_dsd

__all__ = ["compute_dsd", "_compute_dsd", "_generalized_dsd"]


def compute_dsd(n_num: int, n_cat: int = 0, method: str = "dsd") -> np.ndarray:
    """Coded DSD matrix for ``n_num`` continuous + ``n_cat`` 2-level categoricals.

    Continuous columns come first, coded as -1/0/+1; the ``n_cat`` categorical
    columns follow, coded as 1/2 level indices. Row order is not randomized.

    Mirrors ``definitive_screening_design.generate(...).values`` for the same
    factors WITHOUT the ``min_13`` fake-factor augmentation, so the run count is
    the minimal conference-matrix construction (2k+1 or 2k+3 with categoricals).
    """
    if n_num + n_cat < 1:
        raise ValueError("DSD requer ao menos um fator.")
    return np.asarray(_compute_dsd(n_num, n_cat, method), dtype=float)
