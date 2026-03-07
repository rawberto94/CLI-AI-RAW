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
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/pdf/**",
      "**/*.min.js",
      "**/*.min.mjs",
      "coverage/**",
      "dist/**",
      "build/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
      "@next/next/no-img-element": "off",
      "import/no-anonymous-default-export": "off",
      "react-hooks/exhaustive-deps": "off",
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
    },
  },
];

export default eslintConfig;
