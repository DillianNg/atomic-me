import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Vite config cho @atomic-me/web. Env prefix mac dinh la VITE_.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: true },
});
