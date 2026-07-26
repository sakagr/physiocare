import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated coverage output is not source and is not ours to lint.
    "coverage/**",
  ]),
  {
    rules: {
      /*
       * An underscore prefix marks a binding that is deliberately unused:
       * a parameter kept to satisfy a signature, a destructured value taken
       * only to exclude it, or a caught error we intentionally ignore.
       * Sanctioning the convention keeps the rule meaningful — every
       * remaining warning is a genuine leftover rather than noise.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
