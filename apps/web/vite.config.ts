import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset URLs so Fastify can serve the build from any single origin
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3847',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://127.0.0.1:3847',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 5173,
  },
});
