/**
 * Rodapé do app: assinatura, o caminho de volta à capa e o material didático.
 *
 * Rodapé e não o slot `right` do `PageHeader`: o canto superior direito é
 * espaço nobre e fica com a ação do usuário recorrente. "Rever a apresentação"
 * é ação de baixa frequência, com peso de rodapé.
 *
 * A prop `onVoltarCapa` não é preferência de estilo, é a diferença entre
 * funcionar e não funcionar. Em `/`, navegar para `/?capa=1` com `<Link>` é
 * navegação dentro da mesma rota no App Router: o `HomeGate` não desmonta, o
 * `useEffect(…, [])` não re-executa e a capa nunca aparece. Por isso a home
 * passa o callback (vira `<button>`) e as demais rotas usam o `<Link>`, que
 * remonta o `HomeGate` do zero e faz o `?capa=1` valer.
 */

import Link from "next/link";

interface RodapeAppProps {
  /** Presente só em `/`: troca o link pelo callback que reabre a capa. */
  onVoltarCapa?: () => void;
}

const ACAO =
  "rounded-sm underline decoration-border-strong underline-offset-4 transition-colors hover:text-accent-strong hover:decoration-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-strong";

export function RodapeApp({ onVoltarCapa }: RodapeAppProps) {
  return (
    <footer className="mt-12 border-t border-border pt-5 text-xs text-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-medium text-foreground-soft">
          Design of Experiments · beta
        </span>

        {onVoltarCapa ? (
          <button type="button" onClick={onVoltarCapa} className={ACAO}>
            Rever a apresentação
          </button>
        ) : (
          <Link href="/?capa=1" className={ACAO}>
            Rever a apresentação
          </Link>
        )}

        <Link href="/conteudo" className={ACAO}>
          Material didático
        </Link>

        <span className="sm:ml-auto">Seus dados ficam neste navegador</span>
      </div>
    </footer>
  );
}
