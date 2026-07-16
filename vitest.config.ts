import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest mínimo. Resolve o alias "@/..." igual ao tsconfig (paths "@/*" → src/*).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // "video/**" entrou 2026-07-16 (brand-grade.ts/KenBurns.tsx são lib pura o
    // bastante pra testar sem DOM — só matemática de grade e escolha de modo).
    include: ["src/**/*.test.ts", "video/**/*.test.ts"],
  },
});
