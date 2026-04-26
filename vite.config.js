import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  envDir: '.', // Load .env from project root (same folder as vite.config.js)
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: '../dist',
  }
});
