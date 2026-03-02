import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/repos/**', 'node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 15_000,
  },
})
