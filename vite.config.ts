import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/controller-test/' : '/',
  server: {
    port: 4444,
  },
});
