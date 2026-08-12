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
    // Vitest defaults to one worker per core, which on an 8-core/8GB M1
    // competes with `next dev` and the editor's TS server for memory.
    // Capped at 2; the wall-clock cost is small at this suite size.
    pool: "threads",
    poolOptions: { threads: { minThreads: 1, maxThreads: 2 } },
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
