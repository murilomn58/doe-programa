import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  // Fase 2 (previsto, NÃO implementar agora): adicionar
  //   Credentials (email/senha) e/ou Email (magic link) aqui.
});
