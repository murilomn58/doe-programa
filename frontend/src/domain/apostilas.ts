/**
 * Cadernos de planejamento de experimentos. Os PDFs são compilados por
 * `apostilas/build.ps1` e copiados para `public/conteudo/pdf/`.
 *
 * O campo `pdf` é o único ponto que conhece a hospedagem: enquanto os arquivos
 * moram em `public/`, são cinco caminhos relativos; se o total passar de 25 MB
 * e a migração para o Vercel Blob acontecer, são cinco URLs absolutas e nada
 * mais muda no frontend.
 */
export interface Apostila {
  numero: 1 | 2 | 3 | 4 | 5;
  slug: string;
  titulo: string;
  resumo: string;
  topicos: string[];
  paginas: number; // preenchido após a primeira compilação
  pdf: string;
}

export const APOSTILAS: Apostila[] = [
  {
    numero: 1,
    slug: "por-que-planejar",
    titulo: "Por que planejar experimentos",
    resumo:
      "Fator, nível e resposta; a falha do método de um fator por vez; erro experimental; réplicas, aleatorização e blocagem; o custo de cada ensaio quando o material é escasso.",
    topicos: ["fator e nível", "erro experimental", "réplicas", "aleatorização", "blocagem"],
    paginas: 20,
    pdf: "/conteudo/pdf/por-que-planejar.pdf",
  },
  {
    numero: 2,
    slug: "fatorial-2k",
    titulo: "Planejamento fatorial 2^k",
    resumo:
      "A matriz de ensaios e a codificação em ±1; efeitos principais e interações; o erro do efeito e o critério de significância; o gráfico de Pareto e a alternativa quando não há réplica.",
    topicos: ["codificação ±1", "ortogonalidade", "efeitos e interações", "Pareto dos efeitos", "gráfico normal"],
    paginas: 20,
    pdf: "/conteudo/pdf/fatorial-2k.pdf",
  },
  {
    numero: 3,
    slug: "regressao-e-anova",
    titulo: "Regressão e análise de variância",
    resumo:
      "Mínimos quadrados e o modelo ajustado; a decomposição da variância; R² e R² ajustado; testes F e t; o valor-p; resíduos, falta de ajuste e erro puro.",
    topicos: ["mínimos quadrados", "R² e R² ajustado", "valor-p", "resíduos", "falta de ajuste", "PRESS"],
    paginas: 22,
    pdf: "/conteudo/pdf/regressao-e-anova.pdf",
  },
  {
    numero: 4,
    slug: "curvatura-e-superficie",
    titulo: "Curvatura e superfície de resposta",
    resumo:
      "Por que dois níveis não medem curvatura; pontos centrais e o teste de curvatura; modelo linear contra modelo quadrático; composição central, Box-Behnken e a leitura da superfície.",
    topicos: ["pontos centrais", "teste de curvatura", "modelo quadrático", "CCD", "Box-Behnken", "ponto ótimo"],
    paginas: 20,
    pdf: "/conteudo/pdf/curvatura-e-superficie.pdf",
  },
  {
    numero: 5,
    slug: "economia-de-ensaios",
    titulo: "Economia de ensaios e uso científico",
    resumo:
      "Fatoriais fracionados, resolução e confundimento; triagem e dobramento; o orçamento de material como restrição de projeto; como relatar o planejamento de experimentos num artigo.",
    topicos: ["fracionado 2^(k−p)", "resolução III, IV e V", "triagem", "dobramento", "orçamento de material", "relato no artigo"],
    paginas: 20,
    pdf: "/conteudo/pdf/economia-de-ensaios.pdf",
  },
];

/** PDFs originais das aulas de referência, oferecidos como leitura de apoio. */
export const MATERIAL_APOIO: { titulo: string; arquivo: string; fonte: string }[] = [];
