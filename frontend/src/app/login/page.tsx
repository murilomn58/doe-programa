import { SignInButton } from "@/components/ui/SignInButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return (
    <main className="sci-grid-bg flex min-h-screen items-center justify-center bg-surface-0">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface-1 p-8 text-center">
        <h1 className="font-mono text-xs uppercase tracking-widest text-accent-strong">
          IA Research Labs
        </h1>
        <p className="mt-2 text-lg font-semibold text-foreground-strong">
          Planejamento de experimentos assistido
        </p>
        <p className="mt-2 text-sm text-muted">
          Entre para acessar seus experimentos.
        </p>
        <div className="mt-6 flex justify-center">
          <SignInButton callbackUrl={callbackUrl ?? "/"} />
        </div>
        {/* Fase 2 (previsto): email/senha e magic link entram aqui. */}
      </div>
    </main>
  );
}
