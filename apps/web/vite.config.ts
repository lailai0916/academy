import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { routePreload } from './vite.route-preload.ts';

export default defineConfig({
  plugins: [react(), routePreload()],
  build: {
    manifest: true,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4100',
    },
  },
});
