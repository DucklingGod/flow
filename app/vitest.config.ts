import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/dataPlatform/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/dataPlatform/**/*.test.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 85,
      },
    },
  },
})
