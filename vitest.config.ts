import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['composition', 'server', 'app'],
  },
});
