import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  packageManager: string;
  scripts: Record<string, string>;
};

function put(root: string, path: string, contents: string): void {
  const destination = join(root, path);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

describe('cached CLI builds', () => {
  it.each(['build:packages', 'build:standalone'])(
    '%s removes obsolete output before a cache hit',
    (script) => {
      const root = mkdtempSync(join(tmpdir(), 'sandpiper-build-cache-'));
      try {
        put(
          root,
          'package.json',
          JSON.stringify({
            name: 'sandpiper-ai',
            private: true,
            packageManager: manifest.packageManager,
            workspaces: ['packages/*'],
            scripts: { [script]: manifest.scripts[script] },
          }),
        );
        put(root, '.gitignore', 'dist\ndocs\n.turbo\ncache\nhome\n');
        put(root, 'bun.lock', readFileSync(join(repoRoot, 'bun.lock'), 'utf8'));
        put(
          root,
          'turbo.json',
          JSON.stringify({ remoteCache: { enabled: false }, tasks: { build: { outputs: ['dist/**', 'docs/**'] } } }),
        );
        for (const [directory, name] of [
          ['core', 'sandpiper-ai-core'],
          ['cli', 'sandpiper-ai-cli'],
        ]) {
          put(
            root,
            `packages/${directory}/package.json`,
            JSON.stringify({
              name,
              version: '0.0.1',
              scripts: {
                build: 'mkdir -p dist docs && echo runtime > dist/runtime.txt && echo guide > docs/current.md',
              },
            }),
          );
        }
        const build = () =>
          execFileSync(process.env.BUN_EXECUTABLE ?? 'bun', ['run', script], {
            cwd: root,
            encoding: 'utf8',
            env: {
              ...process.env,
              HOME: join(root, 'home'),
              XDG_CACHE_HOME: join(root, 'cache'),
              PATH: `${join(repoRoot, 'node_modules', '.bin')}${delimiter}${process.env.PATH ?? ''}`,
              TURBO_TELEMETRY_DISABLED: '1',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
          });
        expect(build()).toContain('cache miss');
        put(root, 'packages/cli/docs/features/standup.md', 'retired instructions');
        put(root, 'packages/cli/dist/standalone/resources/skills/standup/SKILL.md', 'retired skill');
        put(root, 'packages/cli/dist/standalone/resources/skills/standup/scripts/sandpiper-standup', 'retired helper');

        expect(build()).toContain('cache hit');
        expect(existsSync(join(root, 'packages/cli/docs/features/standup.md'))).toBe(false);
        expect(existsSync(join(root, 'packages/cli/dist/standalone/resources/skills/standup'))).toBe(false);
        expect(readFileSync(join(root, 'packages/cli/docs/current.md'), 'utf8')).toBe('guide\n');
        expect(readFileSync(join(root, 'packages/cli/dist/runtime.txt'), 'utf8')).toBe('runtime\n');
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
