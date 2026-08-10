import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Root vitest config: enables per-package vitest.config.ts files to apply
 * when the suite runs from the repo root (AGENT-258).
 *
 * `legacy-root` is a catch-all inline project reproducing the original
 * (pre-AGENT-258) config-less root behavior for every package that hasn't
 * been migrated yet. Packages are migrated one at a time, each its own
 * commit with a full-suite run after: add a `projects` entry pointing at
 * the package's own vitest.config.ts, and exclude that package's tests
 * from `legacy-root`'s include glob (or it would double-run them under
 * two different configs — legacy-root's `exclude` starts from vitest's
 * own `configDefaults.exclude` rather than a hand-copied literal, so
 * migrating a package can't accidentally drop node_modules/.git from the
 * catch-all's exclusions). Migrated so far: extensions/shell-relay,
 * packages/core, packages/sandpiper-standup-cli.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'legacy-root',
          globals: false,
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: [
            ...configDefaults.exclude,
            'extensions/shell-relay/**',
            'packages/core/**',
            'packages/sandpiper-standup-cli/**',
          ],
        },
      },
      'extensions/shell-relay/vitest.config.ts',
      'packages/core/vitest.config.ts',
      'packages/sandpiper-standup-cli/vitest.config.ts',
    ],
  },
});
