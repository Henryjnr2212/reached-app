import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**', '.tmp/**', '.claude/**', '**/dist/**', '**/.expo/**', '**/.next/**', '**/out/**', '**/coverage/**',
      'apps/mobile/android/**', 'apps/mobile/ios/**', 'supabase/functions/**', 'playwright-report/**',
      'test-results/**', '**/*.config.js', '**/*.config.cjs', '**/babel.config.cjs', '**/next-env.d.ts',
      'apps/mobile/expo-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.jest } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['apps/**/*.tsx', 'apps/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' },
  },
  {
    files: ['**/*.cjs', 'scripts/**/*.{js,mjs}'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off', 'no-console': 'off' },
  },
);
