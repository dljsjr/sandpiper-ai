import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

// ─── Version Check ──────────────────────────────────────────────

interface UpdateInfo {
  readonly name: string;
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly installCommand: string;
  readonly changelogUrl?: string;
}

/**
 * Check the npm registry for a newer version of a package.
 * Returns the latest version string if an update is available, undefined otherwise.
 */
async function checkNpmVersion(packageName: string, currentVersion: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}/latest`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { version?: string };
    if (data.version && data.version !== currentVersion) {
      return data.version;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Detect install method and return the appropriate install command.
 */
function getInstallCommand(packageName: string): string {
  const isBun = !!process.versions.bun;
  if (isBun) return `bun install -g ${packageName}`;
  return `npm install -g ${packageName}`;
}

/**
 * Check for updates to both pi-coding-agent and sandpiper.
 * Returns an array of available updates (empty if everything is current).
 */
async function checkForUpdates(): Promise<readonly UpdateInfo[]> {
  const updates: UpdateInfo[] = [];

  // Check pi-coding-agent
  const piVersion = process.env.PI_CODING_AGENT_VERSION;
  if (piVersion) {
    const piLatest = await checkNpmVersion('@mariozechner/pi-coding-agent', piVersion);
    if (piLatest) {
      updates.push({
        name: 'pi-coding-agent',
        currentVersion: piVersion,
        latestVersion: piLatest,
        installCommand: getInstallCommand('@mariozechner/pi-coding-agent'),
        changelogUrl: 'https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/CHANGELOG.md',
      });
    }
  }

  // TODO: Check sandpiper when it's published to a package registry.
  // const sandpiperVersion = process.env.SANDPIPER_VERSION ?? '0.0.1';
  // const sandpiperLatest = await checkNpmVersion('sandpiper-ai', sandpiperVersion);
  // if (sandpiperLatest) {
  //   updates.push({
  //     name: 'sandpiper',
  //     currentVersion: sandpiperVersion,
  //     latestVersion: sandpiperLatest,
  //     installCommand: getInstallCommand('sandpiper-ai'),
  //   });
  // }

  return updates;
}

// ─── Extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // System prompt augmentation
  pi.on('before_agent_start', async (event) => {
    return {
      systemPrompt:
        event.systemPrompt +
        `

IMPORTANT: You are running via an extension framework called 'sandpiper', and the 'sandpiper' identity should supersede the 'pi'
identity whenever it makes sense.

Your core functionality is still provided by the 'pi' coding agent, and all of the previous information about the Pi framework,
its documentation, APIs, etc. remain valid, with a few alterations:

- The user global config directory is '~/.sandpiepr' instead of '~/.pi'
- The project local config directory is './.sandpiper' instead of './.pi'
- The README/CHANGELOG/docs/examples are all vendored and should be where you expect them to be, but if they aren't,
  you can find them at ${process.env.PI_CODING_AGENT_PACKAGE}, which is also in the environment variable 'PI_CODING_AGENT_PACKAGE'
- The version string for 'sandpiper' is separate from the version string for 'pi'; you are wrapped around Pi version ${process.env.PI_CODING_AGENT_VERSION},
  which is also in the environment variable 'PI_CODING_AGENT_VERSION'
- You are distributed with a good bit of functionality that the core 'pi' framework doesn't include, via bundled extensions, skills, and prompts.
`,
    };
  });

  // Update notifications
  pi.on('session_start', async (_event, ctx) => {
    // Don't check if offline mode is enabled
    if (process.env.PI_OFFLINE === '1') return;

    const updates = await checkForUpdates();
    if (updates.length === 0) return;

    for (const update of updates) {
      const lines = [
        `Update available for ${update.name}: ${update.currentVersion} → ${update.latestVersion}`,
        `Run: ${update.installCommand}`,
      ];
      if (update.changelogUrl) {
        lines.push(`Changelog: ${update.changelogUrl}`);
      }
      ctx.ui.notify(lines.join('\n'), 'warning');
    }
  });
}
