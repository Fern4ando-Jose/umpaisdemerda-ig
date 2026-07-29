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

  it("runs agendados = só os com cron ligado (0,1,4,5); 2 e 3 fora", () => {
    expect(Object.keys(RUN_HOUR_UTC).map(Number).sort((a, b) => a - b)).toEqual([0, 1, 4, 5]);
    expect(RUN_HOUR_UTC[2]).toBeUndefined();
    expect(RUN_HOUR_UTC[3]).toBeUndefined();
  });

  it("pendingRuns nunca emite es nem run 2/3, mesmo com dia inteiro vencido", () => {
    const nowMin = 24 * 60 - 1; // fim do dia UTC → todo run vencido
    const missing = pendingRuns({}, nowMin); // nada publicado ainda
    expect(missing.every((m) => m.lang === "pt")).toBe(true);
    expect(missing.some((m) => m.run === 2 || m.run === 3)).toBe(false);
    expect(missing.map((m) => m.run).sort((a, b) => a - b)).toEqual([0, 1, 4, 5]);
  });

  it("run já publicado (pt) sai da lista de faltantes", () => {
    const nowMin = 24 * 60 - 1;
    const missing = pendingRuns({ pt: [0, 4] }, nowMin);
    expect(missing.map((m) => m.run).sort((a, b) => a - b)).toEqual([1, 5]);
  });

  it("antes de vencer (carência) o run não conta como faltante", () => {
    // run 4 vence às 12:00 UTC + 75min = 13:15 UTC (795 min). Logo antes: nada dele.
    const justBefore = RUN_HOUR_UTC[4] * 60 + GRACE_MIN - 1;
    const missing = pendingRuns({}, justBefore);
    expect(missing.some((m) => m.run === 4)).toBe(false);
  });
});
