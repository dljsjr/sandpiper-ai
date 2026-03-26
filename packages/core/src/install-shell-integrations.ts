/**
 * Shell integration installer.
 *
 * Copies relay shell integration scripts from the sandpiper package distribution
 * to the well-known location: ~/.sandpiper/shell-integrations/
 *
 * Users source from the well-known location so their config is not tied to the
 * package install path, which can change across updates.
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { displayPath } from './paths.js';

export interface InstallResult {
  success: boolean;
  error?: string;
  installedTo: string;
}

/** The well-known location for shell integration scripts. */
export function getShellIntegrationsDir(): string {
  return join(homedir(), '.sandpiper', 'shell-integrations');
}

/**
 * Locate the shell integration source scripts within the sandpiper package.
 * Reads PI_PACKAGE_DIR (set by pi_wrapper.ts) to find the dist root.
 */
function getSourceDir(): string | undefined {
  const packageDir = process.env.PI_PACKAGE_DIR;
  if (!packageDir) return undefined;
  return join(packageDir, 'extensions', 'shell-relay', 'shell-integration');
}

const SCRIPTS: ReadonlyArray<{ file: string; shell: string; rcFile: string }> = [
  { file: 'relay.fish', shell: 'Fish', rcFile: '~/.config/fish/config.fish' },
  { file: 'relay.bash', shell: 'Bash', rcFile: '~/.bashrc' },
  { file: 'relay.zsh', shell: 'Zsh', rcFile: '~/.zshrc' },
];

/**
 * Install shell integration scripts to ~/.sandpiper/shell-integrations/.
 * Overwrites existing files — users should not edit these scripts directly.
 */
export function installShellIntegrations(): InstallResult {
  const sourceDir = getSourceDir();
  if (!sourceDir || !existsSync(sourceDir)) {
    return {
      success: false,
      error: `Shell integration source not found. Is PI_PACKAGE_DIR set correctly? (${sourceDir ?? 'unset'})`,
      installedTo: getShellIntegrationsDir(),
    };
  }

  const targetDir = getShellIntegrationsDir();
  try {
    mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    return {
      success: false,
      error: `Failed to create ${targetDir}: ${err instanceof Error ? err.message : String(err)}`,
      installedTo: targetDir,
    };
  }

  for (const { file } of SCRIPTS) {
    const src = join(sourceDir, file);
    const dst = join(targetDir, file);
    try {
      copyFileSync(src, dst);
    } catch (err) {
      return {
        success: false,
        error: `Failed to copy ${file}: ${err instanceof Error ? err.message : String(err)}`,
        installedTo: targetDir,
      };
    }
  }

  return { success: true, installedTo: targetDir };
}

/**
 * Format the post-install instructions printed to stdout.
 */
export function formatInstallInstructions(installedTo: string): string {
  const display = displayPath(installedTo);
  const lines: string[] = [
    `Shell integration scripts installed to ${display}`,
    '',
    'Add the appropriate line to your shell config:',
  ];

  for (const { file, shell, rcFile } of SCRIPTS) {
    lines.push('');
    lines.push(`  ${shell} (${rcFile}):`);
    lines.push(`    source ${displayPath(join(installedTo, file))}`);
  }

  return lines.join('\n');
}
