import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    clearMocks: true,
    restoreMocks: true,
    testTimeout: 10000,
    hookTimeout: 15000,
  },
});