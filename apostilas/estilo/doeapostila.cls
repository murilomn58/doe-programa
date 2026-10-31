\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{doeapostila}[2026/07/28 Apostilas de Planejamento de Experimentos]
\LoadClass[11pt,a4paper,oneside]{article}

\RequirePackage[T1]{fontenc}
\RequirePackage[utf8]{inputenc}
\RequirePackage[brazil]{babel}
\RequirePackage{amsmath,amssymb}
\RequirePackage{newtxtext,newtxmath}
\RequirePackage{microtype}
\RequirePackage[a4paper,top=2.8cm,bottom=2.8cm,left=2.7cm,right=2.7cm]{geometry}
\RequirePackage{booktabs}
\RequirePackage{siunitx}
\RequirePackage{graphicx}
\RequirePackage{float}
\RequirePackage[font=small,labelfont=bf,labelsep=period]{caption}
\RequirePackage{subcaption}
\RequirePackage{enumitem}
\RequirePackage{titlesec}
\RequirePackage{fancyhdr}
\RequirePackage{xcolor}
\RequirePackage[hidelinks]{hyperref}
\RequirePackage{tikz}
\RequirePackage{pgfplots}
\pgfplotsset{compat=1.18}

\definecolor{azulDoE}{HTML}{1B4E79}
\hypersetup{colorlinks=true,linkcolor=azulDoE,urlcolor=azulDoE,citecolor=azulDoE}

% O sumário permanece em preto, embora continue clicável. Com o linkcolor
% padrão a página inteira do sumário sai azul, o que é a maior mancha de cor
% do documento e destoa da regra "cor de apoio apenas em regras de destaque,
% links no corpo do texto e séries de gráfico". Para reverter, basta apagar
% este bloco.
\makeatletter
\let\doe@tableofcontents\tableofcontents
\renewcommand{\tableofcontents}{%
  \begingroup\hypersetup{linkcolor=black}\doe@tableofcontents\endgroup}
\makeatother

\titleformat{\section}{\normalfont\large\bfseries\color{black}}{\thesection}{0.7em}{}
\titleformat{\subsection}{\normalfont\normalsize\bfseries\color{black}}{\thesubsection}{0.6em}{}
\titleformat{\subsubsection}{\normalfont\normalsize\itshape}{\thesubsubsection}{0.6em}{}
\titlespacing*{\section}{0pt}{1.6\baselineskip}{0.7\baselineskip}

% group-digits=integer é obrigatório: sem ele o siunitx v3 agrupa também a
% parte decimal, e \num{0.777873} sai como "0,777.873" em vez de "0,777873".
\sisetup{output-decimal-marker={,},group-separator={.},group-minimum-digits=4,
  group-digits=integer}

\newcommand{\doenumero}{0}
\newcommand{\doetitulocurto}{Planejamento de Experimentos}
\newcommand{\definecaderno}[2]{\renewcommand{\doenumero}{#1}\renewcommand{\doetitulocurto}{#2}}

\pagestyle{fancy}
\fancyhf{}
\renewcommand{\headrulewidth}{0.4pt}
\fancyhead[L]{\footnotesize\itshape\doetitulocurto}
\fancyhead[R]{\footnotesize Caderno \doenumero}
\fancyfoot[C]{\footnotesize\thepage}

\newenvironment{aplicacao}[1]
  {\par\medskip\noindent\begin{minipage}{\linewidth}%
   \color{azulDoE}\rule{\linewidth}{0.8pt}\par\smallskip
   \color{black}\textbf{Exemplo de aplicação. #1}\par\smallskip\small}
  {\par\smallskip\color{azulDoE}\rule{\linewidth}{0.4pt}\end{minipage}\par\medskip}

\newcommand{\paginadireitos}{%
  \clearpage\thispagestyle{empty}\null\vfill
  \begin{center}\small
  \copyright{} 2026 Murilo Miguel Narciso. Todos os direitos reservados.\par\smallskip
  Instituto Militar de Engenharia, Rio de Janeiro.\par\smallskip
  Reprodução autorizada para fins didáticos, mantida a indicação de autoria.\par
  \end{center}\vfill}

\endinput
