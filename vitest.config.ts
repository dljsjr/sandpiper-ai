import { defineConfig } from 'vitest/config';

/**
 * Root vitest config: enables per-package vitest.config.ts files to apply
 * when the suite runs from the repo root (AGENT-258).
 *
 * Landed inert deliberately (see the task): the only project defined here
 * is `legacy-root`, a catch-all that reproduces today's config-less root
 * behavior byte-for-byte (matches every `*.test.ts` file in the repo, same
 * as vitest's defaults with no config file at all). None of the six
 * existing per-package vitest.config.ts files (extensions/{shell-relay,
 * web-fetch,web-search}, packages/{core,sandpiper-standup-cli,trail}) are
 * referenced yet — activating all six at once was explicitly ruled out in
 * favor of enabling them one at a time, each with its own full-suite run,
 * to avoid having to bisect six simultaneous behavior changes.
 *
 * As each package is migrated to run under its own project, that
 * package's tests must be excluded here (or `legacy-root` will double-run
 * them under two different configs) and it gains a `projects` entry
 * pointing at its own vitest.config.ts.
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
        },
      },
    ],
  },
});
