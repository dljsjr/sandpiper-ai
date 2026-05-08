import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tempRoots: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

function npmGlobalRoot(prefix: string): string {
  return execFileSync('npm', ['--prefix', prefix, 'root', '-g'], { encoding: 'utf-8' }).trim();
}

function npmGlobalBin(prefix: string): string {
  return process.platform === 'win32' ? prefix : join(prefix, 'bin');
}

function npmPack(packageDir: string, destination: string): string {
  const output = execFileSync('npm', ['pack', packageDir, '--pack-destination', destination, '--json'], {
    cwd: repoRoot,
    encoding: 'utf-8',
  });
  const result = JSON.parse(output) as readonly [{ readonly filename: string }];
  return join(destination, result[0].filename);
}

function makeReadOnly(path: string): void {
  if (!existsSync(path)) return;
  const stats = statSync(path);

  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) {
      makeReadOnly(join(path, entry));
    }
    chmodSync(path, 0o555);
    return;
  }

  const executable = (stats.mode & 0o111) !== 0;
  chmodSync(path, executable ? 0o555 : 0o444);
}

function makeWritable(path: string): void {
  if (!existsSync(path)) return;
  const stats = statSync(path);

  if (stats.isDirectory()) {
    chmodSync(path, 0o755);
    for (const entry of readdirSync(path)) {
      makeWritable(join(path, entry));
    }
    return;
  }

  chmodSync(path, 0o644);
}

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) {
    makeWritable(tempRoot);
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe('packed Sandpiper npm artifact', () => {
  it('installs globally without lifecycle scripts and runs from an immutable package directory', () => {
    const packDir = makeTempDir('sandpiper-pack-');
    const prefix = makeTempDir('sandpiper-global-prefix-');
    const agentDir = makeTempDir('sandpiper-agent-');
    const tarball = npmPack(join(repoRoot, 'dist'), packDir);

    execFileSync('npm', ['install', '-g', '--prefix', prefix, '--ignore-scripts', tarball], {
      cwd: repoRoot,
      stdio: 'pipe',
    });

    const packageDir = join(npmGlobalRoot(prefix), 'sandpiper-ai');
    const binPath = join(npmGlobalBin(prefix), process.platform === 'win32' ? 'sandpiper.cmd' : 'sandpiper');

    expect(existsSync(join(packageDir, 'package.json'))).toBe(true);
    expect(existsSync(join(packageDir, 'README.md'))).toBe(true);
    expect(existsSync(join(packageDir, 'docs', 'README.md'))).toBe(true);
    expect(existsSync(join(packageDir, 'dist', 'modes'))).toBe(true);
    expect(existsSync(join(packageDir, 'dist', 'core'))).toBe(true);
    expect(existsSync(join(packageDir, 'skills', 'sandpiper', 'tasks', 'scripts', 'sandpiper-tasks'))).toBe(true);
    expect(existsSync(join(packageDir, 'skills', 'sandpiper', 'standup', 'scripts', 'sandpiper-standup'))).toBe(true);
    expect(existsSync(join(packageDir, 'skills', 'sandpiper', 'dash', 'scripts', 'dash.cjs'))).toBe(true);
    expect(existsSync(join(packageDir, 'dist', 'standalone-package'))).toBe(false);

    makeReadOnly(packageDir);

    const output = execFileSync(binPath, ['--help', '--no-context-files'], {
      cwd: makeTempDir('sandpiper-project-'),
      encoding: 'utf-8',
      env: {
        ...process.env,
        SANDPIPER_CODING_AGENT_DIR: agentDir,
        PI_OFFLINE: '1',
      },
    });

    expect(output).toContain('sandpiper - AI coding assistant');
    expect(existsSync(join(packageDir, 'dist', 'standalone-package'))).toBe(false);
  }, 30_000);
});
