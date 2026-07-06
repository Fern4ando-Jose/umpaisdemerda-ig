import { describe, it, expect } from "vitest";
import { parseContentJson } from "./content-json";

// O haiku às vezes embrulha o JSON em prosa/backticks ou o emite malformado.
// Antes, JSON.parse direto quebrava o post SILENCIOSAMENTE. Estes testes fixam
// o comportamento robusto: extrair o objeto e (no route) retentar se inválido.

describe("parseContentJson", () => {
  it("parseia JSON limpo", () => {
    expect(parseContentJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("remove cercas ```json ... ```", () => {
    const raw = '```json\n{"postTitle":"x"}\n```';
    expect(parseContentJson<{ postTitle: string }>(raw)).toEqual({ postTitle: "x" });
  });

  it("extrai o objeto quando há prosa antes/depois", () => {
    const raw = 'Claro! Aqui está:\n{"ok":true}\nEspero que ajude.';
    expect(parseContentJson<{ ok: boolean }>(raw)).toEqual({ ok: true });
  });

  it("lança em JSON estruturalmente malformado (→ o chamador retenta)", () => {
    const raw = '{"a":1,"b":}'; // valor faltando
    expect(() => parseContentJson(raw)).toThrow();
  });
});
