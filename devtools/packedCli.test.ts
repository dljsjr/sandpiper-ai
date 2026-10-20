import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { packCli } from './packCli.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bun = process.env.BUN_EXECUTABLE ?? 'bun';

function isolatedEnv(root: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('PI_') || key.startsWith('SANDPIPER_')) delete env[key];
  }
  return {
    ...env,
    HOME: join(root, 'home'),
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_STATE_HOME: join(root, 'state'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_RUNTIME_DIR: join(root, 'runtime'),
    BUN_INSTALL: join(root, 'bun'),
    BUN_INSTALL_CACHE_DIR: join(root, 'bun-cache'),
    npm_config_cache: join(root, 'npm-cache'),
    npm_config_userconfig: join(root, 'npmrc'),
    npm_config_globalconfig: join(root, 'global-npmrc'),
    npm_config_update_notifier: 'false',
    NODE_PATH: '',
    PI_OFFLINE: '1',
    SANDPIPER_CODING_AGENT_DIR: join(root, 'agent'),
    SANDPIPER_SESSION_DIR: join(root, 'sessions'),
    TATTLER_RUNTIME_NAMESPACE: `pack-${process.pid}`,
  };
}

function makeReadOnly(path: string, modes: Map<string, number>): void {
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink()) return;
  if (metadata.isDirectory()) {
    for (const entry of readdirSync(path)) makeReadOnly(join(path, entry), modes);
  }
  modes.set(path, metadata.mode & 0o777);
  chmodSync(path, metadata.mode & 0o555);
}

describe('packed Sandpiper CLI', () => {
  it('installs offline and runs with built-in skills and patched Pi from a read-only package outside the checkout', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'sandpiper-packed-cli-')));
    const env = isolatedEnv(root);
    const consumer = join(root, 'consumer');
    const project = join(root, 'project');
    const tarball = join(root, 'sandpiper.tgz');
    const installed = join(consumer, 'node_modules', 'sandpiper-ai-cli');
    const modes = new Map<string, number>();
    for (const directory of [consumer, project, env.HOME, env.XDG_RUNTIME_DIR]) {
      if (directory) mkdirSync(directory, { recursive: true });
    }
    try {
      await packCli(repoRoot, tarball, env);
      execFileSync('npm', ['install', tarball, '--offline', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: consumer,
        env,
        timeout: 60_000,
      });
      const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')) as { version: string };
      const pi = join(installed, 'node_modules', '@earendil-works', 'pi-coding-agent');
      expect(readFileSync(join(pi, 'dist', 'config.js'), 'utf8')).toContain('process.env.PI_CODING_AGENT_PACKAGE');
      expect(existsSync(join(pi, 'dist', 'modes', 'interactive', 'theme', 'dark.json'))).toBe(true);
      expect(existsSync(join(pi, 'dist', 'core', 'export-html', 'template.html'))).toBe(true);
      expect(existsSync(join(installed, 'docs', 'README.md'))).toBe(true);
      makeReadOnly(consumer, modes);
      const run = (bin: string, args: readonly string[]): string =>
        execFileSync(bun, [join(installed, 'bin', bin), ...args], {
          cwd: project,
          env,
          encoding: 'utf8',
          timeout: 30_000,
          maxBuffer: 2 * 1024 * 1024,
        });
      expect(run('sandpiper', ['--version']).trim()).toBe(manifest.version);
      expect(run('sandpiper', ['--help'])).toContain('--migrate-pi-configs');
      const rendered = JSON.parse(run('sandpiper-system-prompt', ['--json', '--approve'])) as { prompt: string };
      const catalogue = rendered.prompt.match(/<available_skills>[\s\S]*?<\/available_skills>/)?.[0] ?? '';
      expect([...catalogue.matchAll(/<skill name="([^"]+)"/g)].map((match) => match[1]).sort()).toEqual([
        'code-review',
        'jj',
        'mutation-testing',
        'projects',
        'refactoring',
        'standup',
        'tasks',
        'test-driven-development',
      ]);
      expect(rendered.prompt).toContain(
        join(installed, 'dist', 'standalone', 'resources', 'skills', 'tasks', 'SKILL.md'),
      );
      expect(rendered.prompt).toContain('<tools>\n- read:');
      expect(rendered.prompt).not.toContain(repoRoot);
      for (const helper of [
        'tasks/scripts/trail',
        'tasks/scripts/sandpiper-tasks',
        'standup/scripts/sandpiper-standup',
      ]) {
        const output = execFileSync(
          process.execPath,
          [join(installed, 'dist', 'standalone', 'resources', 'skills', helper), '--help'],
          {
            cwd: project,
            env,
            encoding: 'utf8',
            timeout: 15_000,
          },
        );
        expect(output).toContain('Usage:');
      }
      expect(existsSync(join(installed, 'dist', 'standalone-package'))).toBe(false);
      expect(existsSync(join(project, 'dist'))).toBe(false);
    } finally {
      for (const [path, mode] of modes) chmodSync(path, mode);
      rmSync(root, { recursive: true, force: true });
    }
  }, 150_000);
});
