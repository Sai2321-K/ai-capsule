import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// dev proxy: keeps the frontend same origin with Express so the token cookie is sent
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
