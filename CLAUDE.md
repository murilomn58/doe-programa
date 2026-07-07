# DoE_programa — Regras do Projeto (ADP)

> Projeto operado pelo **Agent-Driven Protocol (ADP)**. Este marcador é o que o `/adp` usa pra detectar a instalação — não remover esta linha.

## Stack
- Backend: Python 3.12 + FastAPI + SQLAlchemy + numpy + scipy + statsmodels + **pyDOE3 1.6.2** (lib ÚNICA de geração: clássico + Taguchi + D/I-optimal) + **definitive-screening-design 0.5.0** (vendorada, DSD) + matplotlib + SciencePlots + pandas + XlsxWriter
- Frontend: Next.js 15 + TypeScript + Tailwind CSS + Plotly.js (`dynamic`, `ssr:false`) para gráficos 2D/3D interativos
- Relatório PDF: Playwright (Chromium headless) renderiza rota `/report` → PDF pixel-perfect
- Infra/banco: SQLite local (dev) → PostgreSQL (produção Vercel/Railway)
- Deploy futuro: Vercel (frontend) + Railway (backend Python)
- ⚠️ NÃO usar pyDOE2/pydoe (sem Taguchi). **pyDOE3 1.6.2 verificado empiricamente** — ver `docs/adp/design-libs-decision.md`. Demais ADRs em `docs/adp/CONTEXT.md`.

## Domínio — Design of Experiments (DoE)
Termos-chave do domínio:
- **Fator** (Factor): variável de entrada controlada (ex: % de fibra, tipo de fibra, % cimento)
- **Nível** (Level): valor específico atribuído a um fator (quantitativo ou qualitativo)
- **Resposta** (Response): variável de saída medida (ex: Módulo de Resiliência, deformação)
- **Ensaio / Run**: combinação de níveis de fatores para um experimento
- **Réplica** (Replicate): repetição de um ensaio (mesma combinação de fatores)
- **Planejamento Fatorial 2^k**: k fatores em 2 níveis cada → 2^k ensaios
- **Fatorial Fracionado 2^(k-p)**: fração do fatorial completo (triagem de fatores)
- **RSM (Response Surface Methodology)**: CCD (Central Composite Design) e Box-Behnken
- **ANOVA**: análise de variância para significância dos efeitos
- **R²**: coeficiente de determinação do modelo ajustado
- **Efeito principal**: influência direta de um fator na resposta
- **Interação**: efeito combinado de dois ou mais fatores

## Como o Claude trabalha aqui (protocolo ADP)
- Feature grande ou requisito ainda incerto: rode `/adp-spec`.
- Mudança pequena, direta e já compreendida: plan mode direto, sem spec.

Ponteiros de skill (abra a skill só quando a tarefa pedir):
- Descobrir/refinar requisitos → skill `grill-me`
- Virar requisito em PRD → `to-prd` · Fatiar PRD em issues → `to-issues`
- Executar as issues em sequência → `tech-lead` · Verificar e testar → `qa`
- Mexeu no BACKEND → SEMPRE abra `backend-layers` (variante `python-fastapi`) antes de codar.
- Mexeu no FRONTEND/UI → SEMPRE abra `frontend-react` (variante `next`) antes de codar
- Precisa de dado externo / preço / OSINT / doc de lib → `web-buscador` (+ context7 para docs)

## Convenções deste projeto (do / don't)
- Backend em camadas: `router → controller → service → repository`. Dependência só aponta para baixo, via porta (interface), nunca pulando camada. Arquivo passou de ~500 linhas, quebre por responsabilidade.
- Frontend: `api → hook de domínio → container → presentational`. Estado de servidor via TanStack Query, nunca espelhado em `useState`. Container e presentational separados.
- TypeScript estrito, sem `any`. Commits pequenos e focados, um assunto por commit.
- NUNCA commitar `.env`, chave ou segredo (o hook do ADP barra automaticamente).
- Cálculos matemáticos SEMPRE no backend Python (scipy/numpy/statsmodels) — nunca reimplementar álgebra linear no frontend.
- Plotly.js no frontend apenas para renderização; TODO array (grid Z, efeitos, resíduos, quantis) calculado no backend. Uma fonte de verdade.
- **Guard de estimabilidade obrigatório**: checar `np.linalg.matrix_rank(X)` vs `n_params` antes de reportar (statsmodels OLS não retorna NaN em design singular — devolve números plausíveis porém errados). Ver ADR-007.
- Codificação ±1 explícita (não patsy Sum coding — inverte sinal silenciosamente). Ver ADR-005.
- SQLite em dev via arquivo `doe.db` na raiz do backend; não commitar o `.db`.
- Golden test: os cálculos DEVEM reproduzir os números da aula (`docs/adp/reference-outputs.md`) — já validado que statsmodels bate com OriginPro em 5 casas. Divergência = bug bloqueante.

## Rodar e testar localmente
- Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
- Frontend: `cd frontend && npm install && npm run dev`
- Testes backend: `cd backend && pytest`
- Testes frontend: `cd frontend && npm test`
- Lint backend: `cd backend && ruff check .`
- Lint frontend: `cd frontend && npm run lint`
- Typecheck frontend: `cd frontend && npm run typecheck`
- Build frontend: `cd frontend && npm run build`

## Gate humano (não pular)
Nada entra no `main` sem QA verde + revisão do PR pelo Murilo. Mesmo com tech-lead e QA atuando, o PR é revisado antes do merge. Sem revisar = voltou pro vibe coding.

## Mapa vivo
Este projeto tem um `arquitetura_doe_programa.html` na raiz (canvas estilo n8n): features e dependências, endpoints, webhooks e integrações externas, cada nó linkando o arquivo real (`C:\dev\DoE_programa\...`). Atualizado pela skill `gerar-mapa` no fim de cada `/adp-spec`. Use-o pra achar rápido qual arquivo mexer.
