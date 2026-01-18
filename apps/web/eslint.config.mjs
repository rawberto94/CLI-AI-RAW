import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Global ignores
  {
    ignores: ["public/pdf/**", "**/*.min.js", "**/*.min.mjs"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  // Allow console in specific directories (workers, scripts, tests)
  {
    files: ["**/workers/**", "**/scripts/**", "**/tests/**", "**/*.test.ts"],
    rules: {
      "no-console": "off",
    },
  },
];

export default eslintConfig;
