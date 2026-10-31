"""Assistente de sugestões (Fase B, auditoria 2026-07) — heurísticas do motor.

Puro e SEM recálculo: recebe o resultado da análise já serializado (o mesmo
``AnalysisResultRead`` que a UI exibe) + metadados do design e devolve
comentários interpretativos e sugestões ACIONÁVEIS. Nada aqui entra no
relatório exportado: é material de bancada, não de publicação.

Regras baseadas no material das aulas (curvatura → CCD; falta de ajuste →
modelo maior; réplicas → erro puro; R² preditivo → overfitting; Lenth →
efeitos ativos em design saturado).
"""

from __future__ import annotations

ALPHA = 0.05


def _sig(p: float | None) -> bool:
    return p is not None and p < ALPHA


def advise(result: dict, design_meta: dict) -> dict:
    """``result``: AnalysisResultRead (dict). ``design_meta``:
    ``{"has_center": bool, "has_axial": bool, "max_replicate": int,
       "all_quantitative": bool, "n_runs_measured": int, "n_blocks": int}``.
    ``n_blocks`` (fix 3+ blocos): numero de blocos distintos do design; usado
    so para enriquecer o comentario sobre blocos abaixo (a analise em si ja
    veio pronta em ``result``, esta funcao nao recalcula nada).
    Retorna ``{"comments": [...], "suggestions": [...]}``."""
    comments: list[dict] = []
    suggestions: list[dict] = []
    model = result.get("model", "linear")
    stats = result.get("stats") or {}
    r2 = result.get("r_squared")
    r2_pred = stats.get("predicted_r_squared")

    def comment(topic: str, text: str) -> None:
        comments.append({"topic": topic, "text": text})

    def suggest(sid: str, title: str, rationale: str, action: str | None, severity: str = "info") -> None:
        suggestions.append(
            {"id": sid, "title": title, "rationale": rationale, "action": action, "severity": severity}
        )

    # --- casos estruturais -----------------------------------------------------
    if not result.get("estimable", True):
        suggest(
            "nao-estimavel",
            "O modelo escolhido não é estimável com estes ensaios",
            "Há mais parâmetros que informação independente na matriz. Ou simplifique o "
            "modelo (menos termos), ou adicione ensaios que tragam informação nova.",
            "extend_ccd" if design_meta.get("all_quantitative") and not design_meta.get("has_axial") else None,
            "warn",
        )
        if model in ("linear_quadratic", "full") and not design_meta.get("has_axial"):
            suggest(
                "quadratico-sem-axial",
                "Termos quadráticos pedem pontos axiais ou 3 níveis",
                "Num fatorial de 2 níveis o termo z² é constante e se confunde com a média. "
                "Estenda para CCD (pontos axiais) para estimar curvatura de verdade.",
                "extend_ccd",
                "warn",
            )
        return {"comments": comments, "suggestions": suggestions}

    if result.get("saturated", False):
        comment(
            "Modelo saturado",
            "Os graus de liberdade acabaram: o modelo passa por todos os pontos e não "
            "sobra erro para testes F. A triagem de efeitos usa o método de Lenth "
            "(pseudo-erro): barras além da margem são candidatos reais.",
        )
        suggest(
            "saturado-replicas",
            "Adicione réplicas ou pontos centrais",
            "Com réplicas o erro puro fica estimável e a ANOVA completa (F e p) destrava. "
            "Pontos centrais também dão o teste de curvatura de quebra.",
            "add_replicates",
            "warn",
        )
        return {"comments": comments, "suggestions": suggestions}

    # --- curvatura e falta de ajuste ------------------------------------------
    curv = result.get("curvature")
    if curv and _sig(curv.get("p")):
        suggest(
            "curvatura",
            "Curvatura significativa: a região não é plana",
            f"O teste dos pontos centrais deu F = {curv.get('f'):.2f} (p = {curv.get('p'):.4f}). "
            "Um modelo só com termos lineares vai errar no meio da região. Estenda para "
            "CCD e ajuste o modelo Linear + Quadrático.",
            "extend_ccd" if not design_meta.get("has_axial") else "switch_model:linear_quadratic",
            "warn",
        )
    elif curv:
        comment(
            "Curvatura",
            f"O teste de curvatura não acusou desvio do plano (p = {curv.get('p'):.3f}): "
            "na região estudada, o modelo de primeira ordem descreve bem o centro.",
        )

    lof = result.get("lack_of_fit")
    if lof and _sig(lof.get("p")):
        alvo = "linear_quadratic" if design_meta.get("has_axial") else "linear_interactions"
        suggest(
            "lof",
            "Falta de ajuste significativa: o modelo atual não basta",
            f"F(LoF) = {lof.get('f'):.2f} com p = {lof.get('p'):.4f}: a variação que o modelo "
            "não explica é maior que o erro puro das réplicas. Experimente um modelo com "
            "mais termos"
            + (
                " (os pontos axiais já permitem o quadrático)."
                if design_meta.get("has_axial")
                else " ou estenda o planejamento para CCD."
            ),
            f"switch_model:{alvo}" if model != alvo else ("extend_ccd" if not design_meta.get("has_axial") else None),
            "warn",
        )
    elif lof:
        comment(
            "Falta de ajuste",
            f"Teste de falta de ajuste não significativo (p = {lof.get('p'):.3f}): o modelo "
            "descreve os dados dentro do erro experimental.",
        )

    # --- qualidade do ajuste ---------------------------------------------------
    if r2 is not None:
        if r2 >= 0.9:
            comment("R²", f"R² = {r2:.3f}: o modelo explica {r2 * 100:.1f}% da variação. Ajuste forte.")
        elif r2 >= 0.7:
            comment("R²", f"R² = {r2:.3f}: ajuste razoável; veja os resíduos antes de confiar em predições finas.")
        else:
            comment(
                "R²",
                f"R² = {r2:.3f}: o modelo explica pouco. Pode ser ruído experimental alto, "
                "fator importante fora do estudo, ou a resposta não é linear nos fatores.",
            )
            if design_meta.get("max_replicate", 1) < 2:
                suggest(
                    "r2-replicas",
                    "Réplicas ajudam a separar ruído de efeito",
                    "Sem réplicas não dá para saber quanto do desajuste é erro de medição. "
                    "Repetir a matriz uma vez estima o erro puro e destrava a falta de ajuste.",
                    "add_replicates",
                    "info",
                )

    if r2 is not None and r2_pred is not None:
        if r2_pred < 0 or (r2 - r2_pred) > 0.3:
            suggest(
                "overfit",
                "R² previsto bem menor que o R²: sinal de sobreajuste",
                f"R² = {r2:.3f} mas R² previsto = {r2_pred:.3f}. O modelo se apoia demais em "
                "pontos individuais. Simplifique (menos termos) ou acrescente ensaios.",
                "switch_model:linear" if model != "linear" else None,
                "warn",
            )
        else:
            comment("Predição", f"R² previsto = {r2_pred:.3f}: capacidade de prever pontos novos preservada.")

    # --- efeitos ----------------------------------------------------------------
    # Filtro por substring ("Bloco" in term): continua correto com 3+ blocos
    # (fix analysis_service), pois cada termo sintetico de bloco se chama
    # "Bloco <id>" -- o "in" pega qualquer quantidade deles sem mudanca aqui.
    effects = result.get("effects") or []
    non_block = [e for e in effects if "Bloco" not in (e.get("term") or "")]
    sig_terms = [e["term"] for e in non_block if _sig(e.get("p"))]
    ns_terms = [e["term"] for e in non_block if e.get("p") is not None and not _sig(e.get("p"))]
    if sig_terms:
        comment(
            "Efeitos dominantes",
            "Significativos a 5%: " + ", ".join(sig_terms) + ". Estes fatores mandam na resposta.",
        )
    if ns_terms and len(ns_terms) >= 2 and model != "linear":
        comment(
            "Modelo enxuto",
            "Termos sem significância (" + ", ".join(ns_terms[:4]) + ("…" if len(ns_terms) > 4 else "") +
            ") podem sair num modelo reduzido: sobra grau de liberdade para o erro e as "
            "estimativas ficam mais firmes.",
        )

    anova = result.get("anova") or []
    bloco = next((row for row in anova if "Bloco" in (row.get("source") or "")), None)
    if bloco is not None:
        n_blocks = design_meta.get("n_blocks")
        blocos_txt = f" ({n_blocks} blocos)" if isinstance(n_blocks, int) and n_blocks > 2 else ""
        if _sig(bloco.get("p")):
            comment(
                "Blocos",
                f"O efeito de bloco é significativo (p = {bloco.get('p'):.4f}){blocos_txt}: as "
                "condições mudaram entre os blocos e a análise já descontou isso. Bom sinal ter "
                "blocado.",
            )
        else:
            comment(
                "Blocos",
                f"Efeito de bloco não significativo (p = {bloco.get('p'):.3f}){blocos_txt}: os "
                "blocos saíram parecidos; o ajuste por bloco fica de seguro.",
            )

    # --- próximos passos otimização ---------------------------------------------
    if design_meta.get("has_axial") and model in ("linear_quadratic", "full") and r2 is not None and r2 >= 0.7:
        lofok = not (lof and _sig(lof.get("p")))
        if lofok:
            comment(
                "Otimização",
                "Superfície ajustada e sem falta de ajuste: use o profiler para localizar o "
                "ponto ótimo e o intervalo de confiança da predição nesse ponto.",
            )

    if not design_meta.get("has_center") and design_meta.get("all_quantitative") and model == "linear" and not (curv):
        suggest(
            "centrais",
            "Pontos centrais são baratos e informativos",
            "Alguns ensaios no centro da região testam curvatura sem crescer o plano. Se a "
            "curvatura acusar, você já sabe que precisa de um CCD antes de otimizar.",
            "add_center_points",
            "info",
        )

    return {"comments": comments, "suggestions": suggestions}
