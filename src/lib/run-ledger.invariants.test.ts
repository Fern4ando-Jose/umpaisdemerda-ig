import { describe, it, expect } from "vitest";
import { ACTIVE_LANGS, RUN_HOUR_UTC, GRACE_MIN, pendingRuns } from "./run-ledger";

// ─── Cronograma: só o que o UPM realmente publica ────────────────────────────
// @umpaisdemerda é CONTA ÚNICA PT-BR. O clone do DR trazia idioma "es" e todos os
// 6 runs (0..5); "es" nunca publica e os runs 2/3 estão com cron desligado
// (cadência 2 reels/dia). runs-status fabricava essas "vagas fantasmas" e o
// catch-up as redisparava — bug fechado aqui. Ver /api/runs-status e /api/catchup.
describe("cronograma — sem vaga fantasma (es / runs desligados)", () => {
  it("idioma ativo é só pt (nunca es)", () => {
    expect([...ACTIVE_LANGS]).toEqual(["pt"]);
    expect(ACTIVE_LANGS).not.toContain("es");
  });

  // Grade de 29/07/2026 (ordem do dono: "deixa 3 reel e apenas 1 carrossel"):
  // reels 0 (12:17), 1 (17:17), 2 (19:47) + carrossel 4 (09:17). Runs 5 (2º
  // carrossel) e 3 (reel clássico) desligados.
  it("runs agendados = só os com cron ligado (0,1,2,4); 3 e 5 fora", () => {
    expect(Object.keys(RUN_HOUR_UTC).map(Number).sort((a, b) => a - b)).toEqual([0, 1, 2, 4]);
    expect(RUN_HOUR_UTC[3]).toBeUndefined();
    expect(RUN_HOUR_UTC[5]).toBeUndefined();
  });

  it("pendingRuns nunca emite es nem run 3/5, mesmo com dia inteiro vencido", () => {
    const nowMin = 24 * 60 - 1; // fim do dia UTC → todo run vencido
    const missing = pendingRuns({}, nowMin); // nada publicado ainda
    expect(missing.every((m) => m.lang === "pt")).toBe(true);
    expect(missing.some((m) => m.run === 3 || m.run === 5)).toBe(false);
    expect(missing.map((m) => m.run).sort((a, b) => a - b)).toEqual([0, 1, 2, 4]);
  });

  it("run já publicado (pt) sai da lista de faltantes", () => {
    const nowMin = 24 * 60 - 1;
    const missing = pendingRuns({ pt: [0, 4] }, nowMin);
    expect(missing.map((m) => m.run).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("antes de vencer (carência) o run não conta como faltante", () => {
    // run 4 vence às 12:00 UTC + 75min = 13:15 UTC (795 min). Logo antes: nada dele.
    const justBefore = RUN_HOUR_UTC[4] * 60 + GRACE_MIN - 1;
    const missing = pendingRuns({}, justBefore);
    expect(missing.some((m) => m.run === 4)).toBe(false);
  });
});
