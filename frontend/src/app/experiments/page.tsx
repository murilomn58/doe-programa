import type { Metadata } from "next";

import { Experimentos } from "@/containers/Experimentos";

export const metadata: Metadata = {
  title: "Experimentos · Design of Experiments",
  description:
    "Crie um experimento passo a passo, retome uma análise retrospectiva ou continue de onde parou.",
};

export default function ExperimentsPage() {
  return <Experimentos />;
}
