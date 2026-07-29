import { PageHeader } from "@/components/ui/PageHeader";
import { Retrospective } from "@/containers/Retrospective";

export default function RetrospectivePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <PageHeader
        title="Análise retrospectiva"
        subtitle="Já tem os resultados? Cole a tabela de ensaios (ou importe um CSV) e o programa detecta o planejamento por trás dos dados, avalia quais modelos são estimáveis e sugere como completar o desenho."
        back={{ label: "Voltar aos experimentos", href: "/experiments" }}
      />
      <Retrospective />
    </main>
  );
}
