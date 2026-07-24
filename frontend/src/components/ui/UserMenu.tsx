"use client";

import { signOut, useSession } from "next-auth/react";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-pulse rounded-full bg-surface-2"
      />
    );
  }

  if (!session?.user) {
    return null;
  }

  const { name, email, image } = session.user;
  const label = name ?? email ?? "Usuário";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={label}
          width={32}
          height={32}
          className="h-8 w-8 rounded-full border border-border"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 font-mono text-xs text-foreground-soft">
          {initial}
        </span>
      )}
      <span className="hidden text-sm text-foreground-soft sm:inline">
        {label}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground-soft transition-colors hover:bg-surface-2"
      >
        Sair
      </button>
    </div>
  );
}
