import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    projects: [
      {
        test: {
          name: 'legacy-root',
          include: ['**/*.test.ts'],
          exclude: [
            ...configDefaults.exclude,
            'extensions/web-fetch/**',
            'extensions/web-search/**',
            'packages/core/**',
          ],
        },
      },
      {
        test: {
          name: 'web-fetch',
          include: ['extensions/web-fetch/**/*.test.ts'],
          testTimeout: 15_000,
        },
      },
      {
        test: {
          name: 'web-search',
          include: ['extensions/web-search/**/*.test.ts'],
          testTimeout: 15_000,
        },
      },
      {
        test: {
          name: 'core',
          include: ['packages/core/**/*.test.ts'],
          testTimeout: 10_000,
        },
      },
    ],
  },
});
