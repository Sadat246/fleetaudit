import { configDefaults, defineConfig } from 'vitest/config';

// `npm test` runs the fast unit tests only. Database tests live in tests/db
// and run with `npm run test:db` (see vitest.db.config.mts).
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'tests/db/**'] },
});
