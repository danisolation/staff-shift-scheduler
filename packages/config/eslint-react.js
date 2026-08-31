import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import base from './eslint-base.js';

/**
 * Shared ESLint flat config for React apps (apps/web).
 * Extends the base config with the React hooks and refresh rules.
 */
export default tseslint.config(
  ...base,
  reactHooks.configs['recommended-latest'],
  reactRefresh.configs.vite,
);
