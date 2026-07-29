"use client";

import { signIn } from "next-auth/react";

import { PRIMARY_SURFACE } from "./Button";

export function SignInButton({ callbackUrl = "/" }: { callbackUrl?: string }) {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl })}
      className={`inline-flex items-center gap-3 rounded-lg ${PRIMARY_SURFACE} px-5 py-3 font-medium transition-colors`}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        className="shrink-0"
      >
        <path
          fill="#FFFFFF"
          d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2582h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.6151z"
        />
        <path
          fill="#FFFFFF"
          d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2582c-.8059.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
          opacity="0.85"
        />
        <path
          fill="#FFFFFF"
          d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 000 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
          opacity="0.7"
        />
        <path
          fill="#FFFFFF"
          d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"
          opacity="0.55"
        />
      </svg>
      <span>Entrar com Google</span>
    </button>
  );
}
