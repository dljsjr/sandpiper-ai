import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('workspace cleanup', () => {
  it('removes staged CLI docs without deleting source documentation', () => {
    const root = mkdtempSync(join(tmpdir(), 'sandpiper-clean-'));
    try {
      for (const directory of ['devtools', 'docs', 'packages/cli/docs', 'packages/cli/dist']) {
        mkdirSync(join(root, directory), { recursive: true });
      }
      writeFileSync(join(root, 'docs/README.md'), 'source documentation');
      writeFileSync(join(root, 'packages/cli/docs/README.md'), 'generated documentation');
      copyFileSync(join(dirname(fileURLToPath(import.meta.url)), 'clean.ts'), join(root, 'devtools/clean.ts'));
      execFileSync('bun', [join(root, 'devtools/clean.ts')], { cwd: root });
      expect(existsSync(join(root, 'packages/cli/docs'))).toBe(false);
      expect(existsSync(join(root, 'packages/cli/dist'))).toBe(false);
      expect(existsSync(join(root, 'docs/README.md'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
