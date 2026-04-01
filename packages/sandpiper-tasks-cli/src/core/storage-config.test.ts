import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STORAGE_CONFIG, resolveStorageConfig } from './storage-config.js';

describe('resolveStorageConfig', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'storage-config-test-'));
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('returns the default config when no config files exist', () => {
    const config = resolveStorageConfig(rootDir);
    expect(config).toEqual(DEFAULT_STORAGE_CONFIG);
  });

  it('reads version_control config from .sandpiper-tasks.json at the project root', () => {
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({
        version_control: {
          enabled: true,
          mode: { branch: 'sandpiper-tasks' },
          auto_commit: true,
          auto_push: false,
        },
      }),
    );

    const config = resolveStorageConfig(rootDir);
    expect(config.version_control.mode.branch).toBe('sandpiper-tasks');
    expect(config.version_control.auto_commit).toBe(true);
  });

  it('reads config from .sandpiper/settings.json tasks key when no standalone file exists', () => {
    mkdirSync(join(rootDir, '.sandpiper'), { recursive: true });
    writeFileSync(
      join(rootDir, '.sandpiper', 'settings.json'),
      JSON.stringify({
        tasks: {
          version_control: {
            enabled: false,
          },
        },
      }),
    );

    const config = resolveStorageConfig(rootDir);
    expect(config.version_control.enabled).toBe(false);
  });

  it('.sandpiper-tasks.json takes precedence over .sandpiper/settings.json', () => {
    mkdirSync(join(rootDir, '.sandpiper'), { recursive: true });
    writeFileSync(
      join(rootDir, '.sandpiper', 'settings.json'),
      JSON.stringify({ tasks: { version_control: { mode: { branch: 'from-settings' } } } }),
    );
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'from-standalone' } } }),
    );

    const config = resolveStorageConfig(rootDir);
    expect(config.version_control.mode.branch).toBe('from-standalone');
  });

  it('merges partial config with defaults (unspecified fields use defaults)', () => {
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'tasks' } } }),
    );

    const config = resolveStorageConfig(rootDir);
    // Explicit field
    expect(config.version_control.mode.branch).toBe('tasks');
    // Unspecified fields fall back to defaults
    expect(config.version_control.enabled).toBe(DEFAULT_STORAGE_CONFIG.version_control.enabled);
    expect(config.version_control.auto_commit).toBe(DEFAULT_STORAGE_CONFIG.version_control.auto_commit);
    expect(config.version_control.auto_push).toBe(DEFAULT_STORAGE_CONFIG.version_control.auto_push);
  });

  it('includes repo URL when present in mode', () => {
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({
        version_control: {
          mode: { branch: 'tasks', repo: 'git@github.com:user/tasks.git' },
        },
      }),
    );

    const config = resolveStorageConfig(rootDir);
    expect(config.version_control.mode.repo).toBe('git@github.com:user/tasks.git');
  });

  it('omits repo from mode when not present in config', () => {
    writeFileSync(
      join(rootDir, '.sandpiper-tasks.json'),
      JSON.stringify({ version_control: { mode: { branch: 'tasks' } } }),
    );

    const config = resolveStorageConfig(rootDir);
    expect(config.version_control.mode.repo).toBeUndefined();
  });
});
