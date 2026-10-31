"""Gera o planejamento pronto do experimento do Tanabe.

Cimento e rejeito em três níveis cada, sete tipos de solo como BLOCO. O tipo de
solo não é objeto do estudo: é fonte de variação conhecida, e tratá-lo como
bloco tira a variação entre solos da estimativa de erro em vez de deixá-la
inflar a dispersão e mascarar o efeito dos teores. Como fator qualitativo seria
impossível de declarar, porque a plataforma aceita duas categorias.

Três níveis, e não dois, porque a pergunta é qual o teor ótimo. Com dois níveis
o experimento só diria se a resposta sobe ou desce; o termo quadrático, que é o
que localiza um máximo interior, exige um nível intermediário.

O arranjo sai do MESMO motor que a plataforma usa, com semente fixa, para a
matriz aqui e a do site serem a mesma. Saídas:

  planejamento-tanabe.csv   folha de bancada, vírgula decimal, abre no Excel
  tanabe.ts                 experimento semeável no app (copiado para o frontend)

Uso:
    cd C:\\dev\\iacommurilo\\DoE_programa\\backend
    .\\.venv\\Scripts\\python.exe ..\\exemplos_site\\tanabe\\gerar_planejamento.py
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
sys.path.insert(0, str(RAIZ / "backend"))

from domain.schemas import DesignGenerateRequest  # noqa: E402
from services import design_service  # noqa: E402

SEMENTE = 20260729

SOLOS = [
    "Residual",
    "Laterítico",
    "Saprolítico",
    "Aluvionar",
    "Orgânico",
    "Arenoso",
    "Siltoso",
]

FATORES = [
    {
        "name": "Cimento",
        "factor_type": "quantitative",
        "unit": "%",
        "low": 0.0,
        "high": 10.0,
        "levels": [0.0, 5.0, 10.0],
    },
    {
        "name": "Rejeito",
        "factor_type": "quantitative",
        "unit": "%",
        "low": 0.0,
        "high": 40.0,
        "levels": [0.0, 20.0, 40.0],
    },
]

RESPOSTAS = [{"name": "Módulo de resiliência", "unit": "MPa"}]


def gerar():
    req = DesignGenerateRequest.model_validate(
        {
            "name": "Tanabe: solo-cimento-rejeito",
            "design_type": "full_factorial_general",
            "factors": FATORES,
            "responses": RESPOSTAS,
            "replicates": 1,
            "blocks": len(SOLOS),
            "block_labels": SOLOS,
            "block_name": "Tipo de solo",
            "seed": SEMENTE,
        }
    )
    return design_service._build_design(req)


def escrever_csv(design) -> Path:
    destino = AQUI / "planejamento-tanabe.csv"
    with destino.open("w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, delimiter=";")
        w.writerow(
            [
                "Ordem de execução",
                "Ordem padrão",
                "Tipo de solo",
                "Cimento_%",
                "Rejeito_%",
                "Módulo de resiliência (MPa)",
            ]
        )
        for r in sorted(design.runs, key=lambda x: x.run_order):
            solo = design.block_labels[r.block - 1]
            w.writerow(
                [
                    r.run_order,
                    r.std_order,
                    solo,
                    f"{r.cells['Cimento'].natural:.0f}".replace(".", ","),
                    f"{r.cells['Rejeito'].natural:.0f}".replace(".", ","),
                    "",  # a preencher na bancada
                ]
            )
    return destino


def escrever_ts(design) -> Path:
    """Emite o experimento semeável, no formato que `engine/store.ts` persiste."""
    linhas = [
        {
            "ordem": r.run_order,
            "std": r.std_order,
            "bloco": r.block,
            "cimento": r.cells["Cimento"].natural,
            "rejeito": r.cells["Rejeito"].natural,
            "cimentoCod": r.cells["Cimento"].coded,
            "rejeitoCod": r.cells["Rejeito"].coded,
        }
        for r in sorted(design.runs, key=lambda x: x.run_order)
    ]
    dados = {
        "solos": SOLOS,
        "linhas": linhas,
    }
    destino = AQUI / "tanabe.dados.json"
    destino.write_text(
        json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return destino


def main() -> int:
    design = gerar()
    n = len(design.runs)
    por_solo = n // len(SOLOS)

    csv_path = escrever_csv(design)
    json_path = escrever_ts(design)

    print(f"Arranjo: fatorial completo 3^2 em {len(SOLOS)} blocos")
    print(f"Ensaios: {por_solo} por solo, {n} no total")
    print(f"Blocos:  {', '.join(SOLOS)}")
    print()
    print(f"  {csv_path.relative_to(RAIZ)}")
    print(f"  {json_path.relative_to(RAIZ)}")

    # Conferências que valem falhar: cada bloco precisa do arranjo completo, e
    # a ordem de execução precisa intercalar os solos. Um planejamento que sai
    # com os sete solos em sequência não é aleatorizado de verdade, e qualquer
    # deriva do laboratório ao longo das semanas viraria "efeito de solo".
    por_bloco: dict[int, list[tuple[float, float]]] = {}
    for r in design.runs:
        combo = (r.cells["Cimento"].coded, r.cells["Rejeito"].coded)
        por_bloco.setdefault(r.block, []).append(combo)
    assert all(len(set(v)) == 9 for v in por_bloco.values()), "bloco incompleto"
    primeiro_terco = [
        r.block for r in sorted(design.runs, key=lambda x: x.run_order)[: n // 3]
    ]
    assert len(set(primeiro_terco)) > 3, "solos saíram em sequência, não sorteados"
    print()
    print("Conferido: cada bloco tem as 9 combinações, e os solos saem intercalados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
