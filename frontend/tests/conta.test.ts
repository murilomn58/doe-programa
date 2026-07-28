import { describe, expect, it } from "vitest";
import {
  devePedirEmail, dispensarCapa, getConta, marcarPerguntado,
  salvarEmailLocal, validarEmail,
} from "@/lib/conta";

describe("conta local", () => {
  it("valida email", () => {
    expect(validarEmail("nome.sobrenome+tag@ime.eb.br")).toBe(true);
    expect(validarEmail("aluno@ime")).toBe(false);
    expect(validarEmail("")).toBe(false);
    expect(validarEmail("a b@c.com")).toBe(false);
  });

  it("nunca lanca ao ler storage corrompido", () => {
    expect(getConta()).toBeNull();
    window.localStorage.setItem("doe-conta", "{quebrado");
    expect(getConta()).toBeNull();
  });

  it("faz merge sem sobrescrever campo anterior", () => {
    dispensarCapa();
    salvarEmailLocal("  Aluno@IME.EB.BR  ");
    const conta = getConta();
    expect(conta?.email).toBe("aluno@ime.eb.br");
    expect(conta?.dispensadaEm).toBeTruthy();
  });

  it("controla o re-prompt de email", () => {
    expect(devePedirEmail()).toBe(true);
    dispensarCapa();
    expect(devePedirEmail()).toBe(true); // dispensar a capa nao dispensa o prompt
    marcarPerguntado();
    expect(devePedirEmail()).toBe(false);
  });
});
