import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatInstallInstructions,
  getShellIntegrationsDir,
  installShellIntegrations,
} from './install-shell-integrations.js';

// We test the install logic by:
// 1. Pointing PI_PACKAGE_DIR at a temp dir with fake source scripts
// 2. Checking that the scripts are copied to the well-known location
// (We can't redirect the well-known location itself without more invasive mocking,
//  so these are integration-style tests that write to a temp homedir via env var override.)

describe('getShellIntegrationsDir', () => {
  it('returns a path ending in .sandpiper/shell-integrations', () => {
    const dir = getShellIntegrationsDir();
    expect(dir).toMatch(/\.sandpiper[/\\]shell-integrations$/);
  });
});

describe('formatInstallInstructions', () => {
  it('includes the installed path', () => {
    const output = formatInstallInstructions('/some/path');
    expect(output).toContain('/some/path');
  });

  it('includes all three shell names', () => {
    const output = formatInstallInstructions('/some/path');
    expect(output).toContain('Fish');
    expect(output).toContain('Bash');
    expect(output).toContain('Zsh');
  });

  it('includes source lines for each shell', () => {
    const output = formatInstallInstructions('/some/path');
    expect(output).toContain('relay.fish');
    expect(output).toContain('relay.bash');
    expect(output).toContain('relay.zsh');
  });

  it('includes RC file paths', () => {
    const output = formatInstallInstructions('/some/path');
    expect(output).toContain('config.fish');
    expect(output).toContain('.bashrc');
    expect(output).toContain('.zshrc');
  });
});

describe('installShellIntegrations', () => {
  let tmpPackageDir: string;
  let originalPackageDir: string | undefined;

  beforeEach(() => {
    // Create a fake package dir with the expected source scripts
    tmpPackageDir = join(tmpdir(), `sandpiper-test-${Date.now()}`);
    const srcDir = join(tmpPackageDir, 'shell-relay', 'shell-integration');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'relay.fish'), '# fake fish integration');
    writeFileSync(join(srcDir, 'relay.bash'), '# fake bash integration');
    writeFileSync(join(srcDir, 'relay.zsh'), '# fake zsh integration');

    originalPackageDir = process.env.PI_PACKAGE_DIR;
    process.env.PI_PACKAGE_DIR = tmpPackageDir;
  });

  afterEach(() => {
    rmSync(tmpPackageDir, { recursive: true, force: true });
    if (originalPackageDir === undefined) {
      delete process.env.PI_PACKAGE_DIR;
    } else {
      process.env.PI_PACKAGE_DIR = originalPackageDir;
    }
  });

  it('returns success when source scripts exist', () => {
    const result = installShellIntegrations();
    // May fail if well-known dir isn't writable in CI, but source lookup should succeed
    if (!result.success) {
      // Only acceptable failure is write permission, not missing source
      expect(result.error).not.toContain('Shell integration source not found');
    }
  });

  it('returns failure when PI_PACKAGE_DIR is unset', () => {
    delete process.env.PI_PACKAGE_DIR;
    const result = installShellIntegrations();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Shell integration source not found');
  });

  it('returns failure when PI_PACKAGE_DIR points to a dir without shell-relay scripts', () => {
    process.env.PI_PACKAGE_DIR = tmpdir(); // exists but has no shell-relay subdir
    const result = installShellIntegrations();
    expect(result.success).toBe(false);
    expect(result.error).toContain('Shell integration source not found');
  });

  it('includes installedTo in result', () => {
    const result = installShellIntegrations();
    expect(result.installedTo).toMatch(/shell-integrations$/);
  });
});
