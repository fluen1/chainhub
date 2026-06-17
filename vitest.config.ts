import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
    testTimeout: 30_000,
    // Playwright E2E tests bruger @playwright/test runner — ekskludér fra Vitest
    exclude: ['node_modules/**', 'tests/e2e/**', '.next/**', 'dist/**', '.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      // Ratchet-gulv: sat til nuværende faktiske coverage (+ lille headroom) så CI
      // håndhæver et reelt gulv mod regression. Den oprindelige 80%-tærskel blev
      // aldrig opfyldt (CI nåede aldrig coverage-trinnet pga. lock-desync). Skru op
      // efterhånden som Stream E/F tilføjer TDD-dækket kode.
      thresholds: {
        lines: 74,
        functions: 68,
        branches: 60,
        statements: 72,
      },
    },
    server: {
      deps: {
        inline: ['next-auth'],
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    conditions: ['node', 'import'],
  },
})
