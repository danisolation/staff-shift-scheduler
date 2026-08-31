import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

/**
 * Shared ESLint flat config for all TypeScript packages.
 * Prettier runs last and disables style rules that conflict with it.
 */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: ['dist/**', 'build/**', 'coverage/**', 'node_modules/**'],
  },
);
