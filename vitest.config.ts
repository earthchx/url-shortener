import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/**"],
      exclude: ["**/*.d.ts", "node_modules"],
    },
  },
  resolve: {
    alias: {
      // Mirror the Next.js `@/` path alias so imports resolve correctly
      "@": path.resolve(__dirname, "."),
    },
  },
});
