"use client";

/**
 * Capa de entrada (soft gate, design "3a"): cena noturna + modal de captura de
 * email com "Explorar sem conta". Não espera o boot do Pyodide (segue em
 * paralelo) e nunca bloqueia: rede falhou = email fica local e o usuário entra.
 *
 * A capa também é reaberta a pedido (`?capa=1`, "Rever a apresentação"). Nesse
 * caso quem já tem conta recebe `jaTemConta` e entra em um clique, sem digitar
 * nada: a capa vira momento de marca, não pedágio.
 */

import { JetBrains_Mono, Spectral } from "next/font/google";
import { useState } from "react";

import { registrarConta } from "@/api/conta";
import { CenaNoturna } from "@/components/capa/CenaNoturna";
import { LogoDoE } from "@/components/ui/LogoDoE";
import { dispensarCapa, salvarEmailLocal, validarEmail } from "@/lib/conta";

const spectral = Spectral({ subsets: ["latin"], weight: ["500", "600"] });
const jbMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });

const BOTAO_PRIMARIO =
  "h-[54px] w-full rounded-md bg-gradient-to-b from-[#EAF2FB] to-[#BCD7F2] text-base font-semibold text-[#04223F] transition hover:from-white hover:to-[#D6E6F7] disabled:opacity-70";

interface CapaEntradaProps {
  onEntrar: () => void;
  /** Visita de retorno: o formulário dá lugar a um botão de entrada direta. */
  jaTemConta?: boolean;
}

export function CapaEntrada({ onEntrar, jaTemConta = false }: CapaEntradaProps) {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [trocandoEmail, setTrocandoEmail] = useState(false);

  const mostrarFormulario = !jaTemConta || trocandoEmail;
  const rotuloEnvio = jaTemConta
    ? enviando
      ? "Salvando…"
      : "Salvar e entrar"
    : enviando
      ? "Criando…"
      : "Criar conta grátis";

  function sair() {
    setSaindo(true);
    window.setTimeout(onEntrar, 450);
  }

  async function criarConta() {
    const limpo = email.trim();
    if (!validarEmail(limpo)) {
      setErro("Confere o email? Ex.: nome@dominio.com");
      return;
    }
    setErro(null);
    setEnviando(true);
    salvarEmailLocal(limpo);
    await registrarConta(limpo);
    sair();
  }

  function explorarSemConta() {
    dispensarCapa();
    sair();
  }

  return (
    <div
      className={`fixed inset-0 z-[60] transition-opacity duration-500 ${
        saindo ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <CenaNoturna />

      {/* header da capa */}
      <header className="absolute inset-x-0 top-0 z-[8] flex items-center justify-between px-6 pt-6 text-[#EAF2FB] sm:px-16 sm:pt-12">
        <div className="flex items-center gap-3.5">
          <LogoDoE size={30} />
          <span
            className={`${spectral.className} whitespace-nowrap text-lg font-semibold tracking-wide sm:text-xl`}
          >
            Design <span className="text-[#B5D4F4]">of Experiments</span>
          </span>
        </div>
        <span
          className={`${jbMono.className} rounded-full border border-[#B5D4F4]/30 px-3 py-1 text-[11px] uppercase tracking-[.14em] text-[#9CC3EC]`}
        >
          versão beta · grátis
        </span>
      </header>

      {/* modal central */}
      <div className="absolute inset-0 z-[9] flex items-center justify-center overflow-y-auto p-4">
        <div className="flex w-full max-w-[560px] flex-col gap-5 rounded-xl border border-[#B5D4F4]/30 bg-gradient-to-b from-[#07182C]/90 to-[#040F1D]/95 px-7 py-10 text-[#EAF2FB] shadow-[0_40px_90px_-20px_rgba(0,0,0,.6)] backdrop-blur-xl sm:px-13 sm:py-12">
          <div
            className={`${jbMono.className} flex items-center gap-3 text-[11.5px] uppercase tracking-[.3em] text-[#9CC3EC]`}
          >
            <span className="h-px w-6 bg-[#9CC3EC]" aria-hidden />
            Planejamento de experimentos
          </div>

          <h1
            className={`${spectral.className} text-[34px] font-medium leading-[1.06] tracking-[-.015em] text-white sm:text-[44px]`}
          >
            Experimento não se planeja por palpite.
          </h1>

          <p className="text-[16px] leading-relaxed text-[#B5D4F4]">
            {jaTemConta
              ? "Bom te ver de novo. Seus experimentos continuam salvos neste navegador."
              : "Crie sua conta grátis e salve seus experimentos. Quem entrar agora não paga quando as novas features chegarem."}
          </p>

          {jaTemConta && !trocandoEmail ? (
            <>
              <button type="button" onClick={sair} className={BOTAO_PRIMARIO}>
                Entrar na plataforma →
              </button>

              <button
                type="button"
                onClick={() => setTrocandoEmail(true)}
                className="self-center border-b border-[#B5D4F4]/40 pb-px text-[14px] text-[#B5D4F4] transition hover:border-white hover:text-white"
              >
                usar outro email
              </button>

              <p className="text-center text-[12.5px] text-[#B5D4F4]/55">
                Nada sai do seu computador. Sync entre dispositivos vem depois.
              </p>
            </>
          ) : null}

          {mostrarFormulario ? (
            <>
              <form
                className="flex flex-col gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void criarConta();
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  aria-label="Seu email"
                  className="h-[54px] w-full rounded-md border border-[#B5D4F4]/40 bg-[#04101F]/55 px-4 text-base text-white outline-none transition placeholder:text-[#EAF2FB]/45 focus:border-[#B5D4F4] focus:bg-[#04101F]/80"
                />
                {erro ? <p className="text-sm text-[#F2B8B5]">{erro}</p> : null}
                <button type="submit" disabled={enviando} className={BOTAO_PRIMARIO}>
                  {rotuloEnvio}
                </button>
              </form>

              <div className="flex items-center gap-3.5" aria-hidden>
                <span className="h-px flex-1 bg-[#B5D4F4]/20" />
                <span
                  className={`${jbMono.className} text-[11px] tracking-[.14em] text-[#B5D4F4]/55`}
                >
                  OU
                </span>
                <span className="h-px flex-1 bg-[#B5D4F4]/20" />
              </div>

              <button
                type="button"
                onClick={jaTemConta ? sair : explorarSemConta}
                className="self-center border-b border-[#B5D4F4]/50 pb-px text-[15.5px] font-medium text-[#EAF2FB] transition hover:border-white hover:text-white"
              >
                {jaTemConta ? "Entrar na plataforma →" : "Explorar sem conta →"}
              </button>

              <p className="text-center text-[12.5px] text-[#B5D4F4]/55">
                Sem spam. Pedimos de novo só na hora de salvar ou exportar.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
