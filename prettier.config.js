/** @type {import("prettier").Config} */
export default {
  // Print settings
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
  
  // Punctuation
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  trailingComma: 'es5',
  
  // Brackets and spacing
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'avoid',
  
  // Prose wrap
  proseWrap: 'preserve',
  
  // HTML/JSX settings
  htmlWhitespaceSensitivity: 'css',
  vueIndentScriptAndStyle: false,
  embeddedLanguageFormatting: 'auto',
  
  // Line endings
  endOfLine: 'lf',
  
  // Plugin overrides
  overrides: [
    {
      files: ['*.json', '*.jsonc'],
      options: {
        printWidth: 120,
        trailingComma: 'none',
      },
    },
    {
      files: ['*.md', '*.mdx'],
      options: {
        printWidth: 100,
        proseWrap: 'always',
        tabWidth: 2,
      },
    },
    {
      files: ['*.yaml', '*.yml'],
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
    {
      files: ['*.sql'],
      options: {
        printWidth: 120,
        tabWidth: 2,
      },
    },
  ],
};