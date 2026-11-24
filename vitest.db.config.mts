import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Database tests: talk to the real Supabase database (inside a rolled-back
// transaction). Reads DATABASE_URL from .env.local.
export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    env: loadEnv('', process.cwd(), ''),
    // One shared connection and transaction, so run in order.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
