import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
let appBundleDir: string;
let executable: string;
let buildTempDir: string;

function runAppHelp(cwd: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-app-runtime-'));

  try {
    const agentDir = join(tempDir, 'agent');
    return execFileSync(executable, ['--help', '--no-context-files'], {
      cwd,
      encoding: 'utf-8',
      env: {
        ...process.env,
        SANDPIPER_CODING_AGENT_DIR: agentDir,
        PI_OFFLINE: '1',
      },
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function countFlagLines(output: string, flag: string): number {
  return output.split('\n').filter((line) => line.trimStart().startsWith(flag)).length;
}

describe('standalone Sandpiper app runtime smoke', () => {
  beforeAll(async () => {
    buildTempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-app-runtime-build-'));
    appBundleDir = join(buildTempDir, 'standalone-sandpiper');
    executable = join(appBundleDir, 'sandpiper');

    execFileSync(
      'bun',
      ['run', '--bun', 'devtools/standaloneSandpiperApp.ts', '--compile', '--output-dir', appBundleDir],
      {
        cwd: repoRoot,
        stdio: 'pipe',
      },
    );
  }, 20_000);

  afterAll(() => {
    if (buildTempDir) {
      rmSync(buildTempDir, { recursive: true, force: true });
    }
  });

  it('loads bundled resources and extension flags from a temp project directory', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-app-project-'));

    try {
      const projectDir = join(tempDir, 'project');
      mkdirSync(projectDir, { recursive: true });

      const output = runAppHelp(projectDir);

      expect(output).toContain('sandpiper - AI coding assistant');
      expect(countFlagLines(output, '--migrate-pi-configs')).toBe(1);
      expect(countFlagLines(output, '--install-shell-integrations')).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('runs from the source repo cwd without source-root path overrides', () => {
    const output = runAppHelp(repoRoot);

    expect(output).toContain('sandpiper - AI coding assistant');
    expect(countFlagLines(output, '--migrate-pi-configs')).toBe(1);
    expect(countFlagLines(output, '--install-shell-integrations')).toBe(1);
  });

  it('starts cleanly from a cwd with a bunfig.toml preload entry (upstream #7684)', () => {
    // A cwd bunfig.toml with a preload script crashes compiled Bun binaries when the
    // executable autoloads it -- the compiled binary has no matching project for that
    // preload context. compile.autoloadBunfig: false (standaloneSandpiperApp.ts) must stop
    // the binary from reading this bunfig.toml at all. The preload entry below points at a
    // file that doesn't exist and would throw a module-resolution error if Bun actually tried
    // to load it -- if this test ever starts failing because of THIS preload path specifically
    // (not some unrelated change), that's the regression this test exists to catch.
    const tempDir = mkdtempSync(join(tmpdir(), 'sandpiper-standalone-app-bunfig-'));

    try {
      const projectDir = join(tempDir, 'project');
      mkdirSync(projectDir, { recursive: true });
      writeFileSync(join(projectDir, 'bunfig.toml'), 'preload = ["./this-preload-script-does-not-exist.ts"]\n');

      const output = runAppHelp(projectDir);

      expect(output).toContain('sandpiper - AI coding assistant');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
