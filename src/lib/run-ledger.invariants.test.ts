import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  // ⛔ GRADE DE 11/08/2026 — ordem do dono: "vai sair apenas 2 reel diário e um
  // carrossel". Reels 0 (12:17) e 2 (19:47) + carrossel 4 (09:17). Desligados:
  // 1 (reel das 17:17, desligado agora), 3 (reel clássico) e 5 (2º carrossel).
  it("são 3 peças por dia: 2 reels + 1 carrossel", () => {
    expect(Object.keys(RUN_HOUR_UTC).map(Number).sort((a, b) => a - b)).toEqual([0, 2, 4]);
    expect(RUN_HOUR_UTC[1], "o reel das 17:17 saiu em 11/08").toBeUndefined();
    expect(RUN_HOUR_UTC[3]).toBeUndefined();
    expect(RUN_HOUR_UTC[5]).toBeUndefined();
  });

  it("o cron do workflow espelha a grade — senão nasce vaga fantasma", () => {
    // A grade vive em DOIS arquivos por natureza (o cron é do GitHub, a carência é do
    // código). Desligar num e esquecer o outro é o defeito que o catch-up transforma em
    // publicação a mais: exatamente o que a ordem do dono acabou de proibir.
    const wf = readFileSync(join(__dirname, "..", "..", ".github", "workflows", "instagram-reels.yml"), "utf8");
    const ligados = (wf.match(/^\s*- cron: "/gm) ?? []).length;
    expect(ligados, "crons de reel ligados").toBe(2);
    expect(wf).toMatch(/#\s*- cron: "17 20 \* \* \*"/); // o das 17:17, comentado
  });

  it("pendingRuns nunca emite es nem run desligado, mesmo com dia inteiro vencido", () => {
    const nowMin = 24 * 60 - 1; // fim do dia UTC → todo run vencido
    const missing = pendingRuns({}, nowMin); // nada publicado ainda
    expect(missing.every((m) => m.lang === "pt")).toBe(true);
    expect(missing.some((m) => [1, 3, 5].includes(m.run))).toBe(false);
    expect(missing.map((m) => m.run).sort((a, b) => a - b)).toEqual([0, 2, 4]);
  });

  it("run já publicado (pt) sai da lista de faltantes", () => {
    const nowMin = 24 * 60 - 1;
    const missing = pendingRuns({ pt: [0, 4] }, nowMin);
    expect(missing.map((m) => m.run).sort((a, b) => a - b)).toEqual([2]);
  });

  it("antes de vencer (carência) o run não conta como faltante", () => {
    // run 4 vence às 12:00 UTC + 75min = 13:15 UTC (795 min). Logo antes: nada dele.
    const justBefore = RUN_HOUR_UTC[4] * 60 + GRACE_MIN - 1;
    const missing = pendingRuns({}, justBefore);
    expect(missing.some((m) => m.run === 4)).toBe(false);
  });
});
