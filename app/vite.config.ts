import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // The app talks to the server through this proxy in dev, so no CORS
      // is needed for API calls. (Media CORS is a separate M7 concern.)
      '/api': {
        target: `http://localhost:${process.env.CAMPAIGNCUT_SERVER_PORT ?? 3001}`,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    name: 'app',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
  },
});
