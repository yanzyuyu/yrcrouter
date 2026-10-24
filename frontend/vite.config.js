import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://localhost:20128',
      '/api': 'http://localhost:20128'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
