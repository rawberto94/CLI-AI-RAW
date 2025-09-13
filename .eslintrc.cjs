/* Root ESLint config for the monorepo */
module.exports = {
  root: true,
  ignorePatterns: [
    '**/dist/**',
    '**/.next/**',
    '**/node_modules/**',
    '**/.turbo/**',
    '**/test-results/**',
    '**/tmp/**',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: [
      './tsconfig.json',
      './apps/*/tsconfig.json',
      './packages/*/tsconfig.json',
    ],
  },
  env: { es2022: true, node: true },
  plugins: ['@typescript-eslint', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  rules: {
    'unused-imports/no-unused-imports': 'warn',
  },
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      env: { browser: true, node: false },
      // Use Next.js ESLint config for the web app
      extends: ['next/core-web-vitals'],
      rules: {},
    },
    {
      files: ['**/*.js'],
      parser: undefined,
    },
  ],
};
