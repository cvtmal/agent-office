import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // BENCH=1 (`make bench-live`) runs only the benches; `make test` never sees them.
    include: process.env['BENCH'] ? ['test/**/*.bench.ts'] : ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    environment: 'node',
  },
});
