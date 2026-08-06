import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  esbuild: { jsx: "automatic" },
  test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"], setupFiles: ["tests/setup.ts"] },
});
