import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatInstallInstructions,
  getShellIntegrationsDir,
  installShellIntegrations,
} from './install-shell-integrations.js';

// All tests use temp directories — NEVER the real ~/.sandpiper/ location.

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
  let tmpTargetDir: string;
  let originalPackageDir: string | undefined;

  beforeEach(() => {
    // Create a fake package dir with the expected source scripts
    tmpPackageDir = mkdtempSync(join(tmpdir(), 'sandpiper-install-src-'));
    const srcDir = join(tmpPackageDir, 'extensions', 'shell-relay', 'shell-integration');
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, 'relay.fish'), '# test fish integration');
    writeFileSync(join(srcDir, 'relay.bash'), '# test bash integration');
    writeFileSync(join(srcDir, 'relay.zsh'), '# test zsh integration');

    // Create a temp target dir (instead of writing to real ~/.sandpiper/)
    tmpTargetDir = mkdtempSync(join(tmpdir(), 'sandpiper-install-dst-'));

    originalPackageDir = process.env.PI_PACKAGE_DIR;
    process.env.PI_PACKAGE_DIR = tmpPackageDir;
  });

  afterEach(() => {
    rmSync(tmpPackageDir, { recursive: true, force: true });
    rmSync(tmpTargetDir, { recursive: true, force: true });
    if (originalPackageDir === undefined) {
      delete process.env.PI_PACKAGE_DIR;
    } else {
      process.env.PI_PACKAGE_DIR = originalPackageDir;
    }
  });

  it('copies scripts to the target directory', () => {
    const result = installShellIntegrations(tmpTargetDir);
    expect(result.success).toBe(true);
    expect(result.installedTo).toBe(tmpTargetDir);
    expect(existsSync(join(tmpTargetDir, 'relay.fish'))).toBe(true);
    expect(existsSync(join(tmpTargetDir, 'relay.bash'))).toBe(true);
    expect(existsSync(join(tmpTargetDir, 'relay.zsh'))).toBe(true);
  });

  it('copies the correct content', () => {
    installShellIntegrations(tmpTargetDir);
    expect(readFileSync(join(tmpTargetDir, 'relay.fish'), 'utf-8')).toBe('# test fish integration');
  });

  it('returns failure when PI_PACKAGE_DIR is unset', () => {
    delete process.env.PI_PACKAGE_DIR;
    const result = installShellIntegrations(tmpTargetDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Shell integration source not found');
  });

  it('returns failure when PI_PACKAGE_DIR points to a dir without shell-relay scripts', () => {
    process.env.PI_PACKAGE_DIR = tmpdir();
    const result = installShellIntegrations(tmpTargetDir);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Shell integration source not found');
  });

  it('includes installedTo in result', () => {
    const result = installShellIntegrations(tmpTargetDir);
    expect(result.installedTo).toBe(tmpTargetDir);
  });
});
