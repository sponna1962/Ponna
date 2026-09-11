/** Jest config — backend unit tests (Sept 2026, first test infrastructure
 * for this codebase). isolatedModules: true is deliberate — this sandbox
 * cannot regenerate a fully up-to-date Prisma client (no network access
 * to download the query engine binary), which produces a known,
 * environment-only set of stale-type errors throughout this codebase
 * (documented in many commit messages this session). Full type-checking
 * would fail every test file for that reason alone, even though the
 * actual runtime logic is correct. isolatedModules skips full type-
 * checking during the test transform (still transpiles TS -> JS
 * correctly) so tests catch REAL logic bugs, not this environment's own
 * limitation. Render/CI, with a properly generated client, would not
 * have this problem at all.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/test-utils/setup-prisma-client-enums.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true }],
  },
};
