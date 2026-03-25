/**
 * Shell relay preflight check.
 *
 * Verifies that the shell integration is sourced and working by probing whether
 * __relay_prompt_hook is defined in the user's shell. Falls back to checking
 * for script existence at the well-known location if the shell is unrecognized.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { PreflightDiagnostic } from 'sandpiper-ai-core';

const WELL_KNOWN_DIR = join(homedir(), '.sandpiper', 'shell-integrations');

/** Shell probe commands — exit 0 if __relay_prompt_hook is defined, non-zero otherwise. */
const SHELL_PROBES: Readonly<Record<string, string>> = {
  fish: `fish -c 'functions -q __relay_prompt_hook'`,
  bash: `bash -i -c 'type __relay_prompt_hook > /dev/null 2>&1'`,
  zsh: `zsh -i -c 'whence __relay_prompt_hook > /dev/null 2>&1'`,
};

const RC_FILES: Readonly<Record<string, string>> = {
  fish: '~/.config/fish/config.fish',
  bash: '~/.bashrc',
  zsh: '~/.zshrc',
};

const SCRIPT_FILES: Readonly<Record<string, string>> = {
  fish: 'relay.fish',
  bash: 'relay.bash',
  zsh: 'relay.zsh',
};

/**
 * Detect the user's shell name from SHELL env var.
 * Returns 'fish', 'bash', 'zsh', or undefined if unrecognized.
 */
function detectShell(): string | undefined {
  const shell = process.env.SHELL;
  if (!shell) return undefined;
  const name = basename(shell);
  return name in SHELL_PROBES ? name : undefined;
}

/**
 * Check if __relay_prompt_hook is defined in the user's shell.
 * Returns true if sourced, false if not, undefined if the check cannot be run.
 */
function probeShellFunction(shellName: string): boolean | undefined {
  const probe = SHELL_PROBES[shellName];
  if (!probe) return undefined;
  try {
    execSync(probe, { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Fall back to checking if any integration script exists at the well-known location.
 */
function isAnyScriptInstalled(): boolean {
  return Object.values(SCRIPT_FILES).some((file) => existsSync(join(WELL_KNOWN_DIR, file)));
}

/**
 * Run the shell relay preflight check.
 */
export function checkShellIntegration(): PreflightDiagnostic {
  const shellName = detectShell();

  if (shellName) {
    const sourced = probeShellFunction(shellName);

    if (sourced === true) {
      return { key: 'shell-relay:integration', healthy: true, message: 'Shell integration is active' };
    }

    const scriptFile = SCRIPT_FILES[shellName] ?? 'relay.<shell>';
    const rcFile = RC_FILES[shellName] ?? 'your shell RC file';

    if (sourced === false) {
      // Shell detected and probe ran — integration definitely not sourced
      return {
        key: 'shell-relay:integration',
        healthy: false,
        message: 'Shell relay integration is not sourced',
        instructions: [
          `Add to ${rcFile}:`,
          `  source ${join(WELL_KNOWN_DIR, scriptFile)}`,
          '',
          'If not yet installed, run first:',
          '  sandpiper --install-shell-integrations',
        ],
      };
    }
  }

  // Shell unrecognized or probe failed to spawn — fall back to file existence
  const installed = isAnyScriptInstalled();
  if (!installed) {
    return {
      key: 'shell-relay:integration',
      healthy: false,
      message: 'Shell relay integration is not installed',
      instructions: [
        'Run: sandpiper --install-shell-integrations',
        'Then source the appropriate script for your shell.',
      ],
    };
  }

  // Scripts exist but we can't verify they're sourced — pass with a note
  return { key: 'shell-relay:integration', healthy: true, message: 'Shell integration scripts installed' };
}
