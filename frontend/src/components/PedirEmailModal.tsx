"use client";

/**
 * Re-prompt de email (no máximo 1x por navegador): aparece ao salvar o
 * primeiro experimento ou ao exportar, se o usuário entrou sem conta.
 * Nunca bloqueia: "Agora não" segue o fluxo normalmente.
 */

import { useState } from "react";

import { registrarConta } from "@/api/conta";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { marcarPerguntado, salvarEmailLocal, validarEmail } from "@/lib/conta";

interface PedirEmailModalProps {
  aberto: boolean;
  /** "salvar" (wizard) ou "exportar" (análise) — muda só o texto. */
  contexto: "salvar" | "exportar";
  /** Chamado sempre ao resolver (com ou sem email); o fluxo original continua. */
  onFechar: () => void;
}

export function PedirEmailModal({ aberto, contexto, onFechar }: PedirEmailModalProps) {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function resolver() {
    marcarPerguntado();
    onFechar();
  }

  async function salvar() {
    const limpo = email.trim();
    if (!validarEmail(limpo)) {
      setErro("Confere o email? Ex.: nome@dominio.com");
      return;
    }
    setErro(null);
    setEnviando(true);
    salvarEmailLocal(limpo);
    await registrarConta(limpo);
    setEnviando(false);
    resolver();
  }

  return (
    <Modal aberto={aberto} onFechar={resolver} titulo="Guarde seu lugar na beta">
      <p className="mb-4 text-sm text-foreground-soft">
        {contexto === "salvar"
          ? "Seu experimento fica salvo neste navegador. Deixe seu email pra criar sua conta grátis: quem entrar agora não paga quando as novas features chegarem."
          : "Antes de exportar, deixe seu email pra criar sua conta grátis: quem entrar agora não paga quando as novas features chegarem."}
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
          />
        </Field>
        {erro ? <p className="text-sm text-danger">{erro}</p> : null}
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={resolver}>
            Agora não
          </Button>
          <Button type="submit" disabled={enviando}>
            {enviando ? "Salvando…" : "Criar conta grátis"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
