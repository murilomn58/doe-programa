import type { Metadata } from "next";

import { ConteudoIndice } from "@/containers/ConteudoIndice";

// Canonical absoluta de propósito: o projeto não define `metadataBase` no
// layout, e uma canonical relativa seria resolvida contra localhost no build.
export const metadata: Metadata = {
  title: "Material didático · cinco cadernos de planejamento de experimentos",
  description:
    "Cinco cadernos em PDF sobre planejamento de experimentos: por que planejar, fatorial 2^k, regressão e ANOVA, curvatura e superfície de resposta, e economia de ensaios.",
  alternates: { canonical: "https://research.iacommurilo.com.br/conteudo" },
};

export default function ConteudoPage() {
  return <ConteudoIndice />;
}
