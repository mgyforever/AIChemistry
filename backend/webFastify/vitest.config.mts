import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for generated Fastify + TypeScript projects.
 *
 * This configuration is copied into new projects as vitest.config.mts so
 * that `npm test` and `npm run test:coverage` provide fast feedback with
 * reasonable coverage thresholds out of the box.
 *
 * Note: type-level `.test.d.ts` files are validated via `tsc` (type-checking),
 * not executed as runtime tests by Vitest.
 *
 * @supports docs/stories/004.0-DEVELOPER-TESTS-RUN.story.md REQ-TEST-COVERAGE REQ-TEST-VITEST-CONFIG REQ-TEST-CLEAR-OUTPUT REQ-TEST-FAST-EXEC
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.js'],
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80,
      },
    },
  },
});