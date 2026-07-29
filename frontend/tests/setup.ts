import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * Ponte para o @testing-library reconhecer os timers falsos do Vitest.
 *
 * `jestFakeTimersAreEnabled()` do @testing-library/dom exige o global `jest`
 * antes de olhar para o `setTimeout`; sem ele o `asyncWrapper` do RTL tenta
 * drenar as microtasks com um `setTimeout(…, 0)` real que nunca dispara sob
 * `vi.useFakeTimers()`, e todo `findBy*` trava até o teste estourar. O
 * `hasOwnProperty(setTimeout, "clock")` que ele checa em seguida só é
 * verdadeiro com os timers falsos instalados, então este shim fica inerte nos
 * testes de timer real. Fica aqui, e não no arquivo de teste, porque qualquer
 * suíte que use `vi.useFakeTimers()` com `findBy*`/`userEvent` precisa dela.
 */
const globalComJest = globalThis as typeof globalThis & {
  jest?: { advanceTimersByTime: (ms: number) => void };
};
globalComJest.jest = {
  advanceTimersByTime: (ms: number) => void vi.advanceTimersByTime(ms),
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
