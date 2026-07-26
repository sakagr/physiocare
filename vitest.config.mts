import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // Server/unit tests run in Node; component tests (*.test.tsx and anything
    // under tests/components) run in jsdom so React Testing Library can render.
    environment: "node",
    environmentMatchGlobs: [
      ["tests/components/**", "jsdom"],
      ["**/*.test.tsx", "jsdom"],
    ],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup/testing.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: [
        "src/server/**/*.ts",
        "src/app/api/**/*.ts",
        "src/lib/api/**/*.ts",
        "src/components/**/*.{ts,tsx}",
        "src/lib/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.d.ts", "src/types/**"],
    },
  },
});
