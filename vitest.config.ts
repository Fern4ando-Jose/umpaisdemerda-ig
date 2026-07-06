import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest mínimo. Resolve o alias "@/..." igual ao tsconfig (paths "@/*" → src/*).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
