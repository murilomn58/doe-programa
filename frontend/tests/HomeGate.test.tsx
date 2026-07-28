import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Dashboard ainda é o que o HomeGate renderiza nesta altura. A Task 1.5 troca
// por Início e atualiza este mock junto.
vi.mock("@/containers/Dashboard", () => ({ Dashboard: () => <div>portal</div> }));
vi.mock("@/api/conta", () => ({ registrarConta: vi.fn().mockResolvedValue(undefined) }));

import { HomeGate } from "@/containers/HomeGate";
import { dispensarCapa } from "@/lib/conta";

/**
 * Ponte para o @testing-library reconhecer os timers falsos do Vitest.
 *
 * `jestFakeTimersAreEnabled()` do @testing-library/dom exige o global `jest`
 * antes de olhar para o `setTimeout`; sem ele o `asyncWrapper` do RTL tenta
 * drenar as microtasks com um `setTimeout(…, 0)` real que nunca dispara sob
 * `vi.useFakeTimers()`, e todo `findBy*` trava até o teste estourar. O
 * `hasOwnProperty(setTimeout, "clock")` que ele checa em seguida só é
 * verdadeiro com os timers falsos instalados, então este shim fica inerte nos
 * testes de timer real.
 */
const globalComJest = globalThis as typeof globalThis & {
  jest?: { advanceTimersByTime: (ms: number) => void };
};
globalComJest.jest = {
  advanceTimersByTime: (ms: number) => void vi.advanceTimersByTime(ms),
};

function irPara(busca: string) {
  window.history.replaceState(null, "", `/${busca}`);
}

describe("HomeGate", () => {
  beforeEach(() => irPara(""));

  it("mostra a capa quando não há conta gravada", async () => {
    render(<HomeGate />);
    expect(await screen.findByRole("heading", { name: /palpite/i })).toBeInTheDocument();
  });

  it("mostra o portal quando já há conta", async () => {
    dispensarCapa();
    render(<HomeGate />);
    expect(await screen.findByText("portal")).toBeInTheDocument();
  });

  it("volta a mostrar a capa com ?capa=1 mesmo com conta gravada", async () => {
    dispensarCapa();
    irPara("?capa=1");
    render(<HomeGate />);
    expect(await screen.findByRole("heading", { name: /palpite/i })).toBeInTheDocument();
  });

  it("limpa o parâmetro ao entrar, preservando os demais", async () => {
    vi.useFakeTimers();
    dispensarCapa();
    irPara("?capa=1&utm_source=hub");
    render(<HomeGate />);
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await usuario.click(await screen.findByRole("button", { name: /entrar na plataforma/i }));
    act(() => { vi.advanceTimersByTime(450); });
    expect(await screen.findByText("portal")).toBeInTheDocument();
    expect(window.location.search).toBe("?utm_source=hub");
    vi.useRealTimers();
  });
});
