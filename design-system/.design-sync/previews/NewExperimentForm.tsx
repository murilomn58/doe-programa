import { NewExperimentForm } from "doe-design-system";

/** Formulário vazio, pronto para o usuário digitar nome e descrição. */
export function Padrao() {
  return (
    <div className="max-w-md bg-surface-0 p-6">
      <NewExperimentForm onCreate={() => {}} isPending={false} errorMessage={null} />
    </div>
  );
}

/** Requisição em andamento: botão desabilitado exibindo "Criando…". */
export function Enviando() {
  return (
    <div className="max-w-md bg-surface-0 p-6">
      <NewExperimentForm onCreate={() => {}} isPending={true} errorMessage={null} />
    </div>
  );
}

/** Falha ao criar: mensagem de erro do servidor abaixo dos campos. */
export function ComErroDeServidor() {
  return (
    <div className="max-w-md bg-surface-0 p-6">
      <NewExperimentForm
        onCreate={() => {}}
        isPending={false}
        errorMessage="Não foi possível criar o experimento. Verifique se o servidor está rodando."
      />
    </div>
  );
}

/** Composição realista: formulário no topo da página de experimentos. */
export function NaPaginaDeExperimentos() {
  return (
    <div className="flex max-w-lg flex-col gap-6 bg-surface-0 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground-strong">Experimentos</h1>
        <p className="text-sm text-muted">
          Planeje um fatorial 2^k — ex.: % Fibra (0 / 1.5) e % Cimento (4 / 7) sobre o
          Módulo de Resiliência (MPa).
        </p>
      </header>
      <NewExperimentForm onCreate={() => {}} isPending={false} errorMessage={null} />
    </div>
  );
}
