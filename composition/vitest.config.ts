import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'composition',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 300_000,
    hookTimeout: 300_000,
  },
});
