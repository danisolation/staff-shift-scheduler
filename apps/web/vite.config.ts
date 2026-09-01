import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    // During development the Vite server proxies /api calls to the NestJS api,
    // so the browser only ever talks to one origin (no CORS pain).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Pin NODE_ENV for tests: React 19.2 removed `act` from its production
    // build, so an ambient NODE_ENV=production (some shells/CI machines
    // have it) would break every component test. Vitest only defaults
    // NODE_ENV to "test" when it is not already set.
    env: { NODE_ENV: 'test' },
  },
});
