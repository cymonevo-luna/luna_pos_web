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
  ]),
  {
    rules: {
      // Client-side data fetching on mount (auth hydration, list loading) is an
      // intentional, idiomatic pattern in this template. Surface as a warning
      // rather than an error. Adopt React Query / SWR to remove these entirely.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
