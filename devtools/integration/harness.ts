// Isolation-by-construction spawn helper for the headless CLI/RPC integration-test lane
// (AGENT-249/250/251/252). Every integration test builds its spawn through this module -- no
// test file constructs its own child_process call -- so the isolation stack (temp agent dir,
// VCS config neutralization, mock-provider pinning) is guaranteed by construction, not by
// per-test discipline.
//
// See devtools/integration/README.md for the isolation rules and the postmortem on why an
// earlier, more elaborate network-interception layer was built, then torn down. The full design
// record is .sandpiper/archive/agent-249-headless-cli-integration-harness-design.md. In short:
// agent-dir isolation (below) was always the actual fix for the incident that motivated it, and
// pi has no silent-substitution path for an explicit `--provider` pin to fall through from -- an
// unknown provider or unresolvable model is a hard error, not a fallback. The scar tissue is documented so it doesn't get rebuilt from scratch.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_MODEL_ID, MOCK_PROVIDER_ID } from './mock-provider.js';

export { MOCK_MODEL_ID, MOCK_PROVIDER_ID } from './mock-provider.js';

const integrationDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(integrationDir));

const JJ_FIXTURE = join(repoRoot, 'devtools', 'test-fixtures', 'jj-test-config.toml');
const MOCK_PROVIDER_PATH = join(integrationDir, 'mock-provider.ts');

/** `pi`: bypasses Sandpiper's own package manifest entirely -- the true single/combinatoric
 * extension isolation mode. `sandpiper`: loads Sandpiper's normal extension set on top of
 * whatever `extraExtensions` add. */
export type IsolationEntryMode = 'sandpiper' | 'pi';

export interface IsolatedSpawnOptions {
  readonly entry: IsolationEntryMode;
  /** Extension file paths to load via repeatable `-e`, on top of the harness's own
   * mock-provider extension (always loaded, regardless of entry mode or provider/model
   * pinning). */
  readonly extraExtensions?: readonly string[];
  /** Provider/model to pin via `--provider`/`--model`. Defaults to the harness's mock
   * provider -- isolation-by-construction means every spawn is pinned to *something*
   * explicit by default, never left to resolve on its own. */
  readonly provider?: string;
  readonly model?: string;
  /** Omits `--provider`/`--model` entirely, reproducing the exact invocation shape of the
   * incident this harness's dual-agent-dir-name isolation exists to contain (see the design
   * doc's "Incident log" section): no explicit pin, resolution left to pi's own defaults.
   * Used by the config-isolation containment canary
   * (`config-isolation-canary.integration.test.ts`) -- that test's whole claim is that
   * correct isolation prevents a real completion even in this unpinned shape, not just when
   * a provider is explicitly pinned to the mock. `provider`/`model` are ignored when this is
   * true. */
  readonly skipProviderPin?: boolean;
  /** Omits the harness's own mock-provider extension entirely. Used alongside
   * `skipProviderPin` by the containment canary to faithfully reproduce the incident's exact
   * conditions: with the mock loaded, an unpinned resolution can legitimately pick the mock
   * as the only available provider and succeed -- which is a real, different proof (nothing
   * real got touched) but not "hard error, no completion," the canary's actual claim. */
  readonly skipMockProvider?: boolean;
  /** Additional CLI args appended after the isolation/provider-pin flags. */
  readonly args?: readonly string[];
  /** Working directory for the spawned process. Defaults to a fresh temp dir, so tests never
   * touch this repo's own tree as a cwd side effect. */
  readonly cwd?: string;
  /** Extra env vars layered on top of the isolation defaults. Isolation vars (agent-dir
   * names, HOME, GIT_CONFIG_*, JJ_CONFIG) always win over this -- pass agent-dir-relative state
   * through `agentDir` instead of trying to override them. */
  readonly env?: Readonly<NodeJS.ProcessEnv>;
  /** Written as `<agentDir>/settings.json` before the spawn is returned (so it exists on disk
   * before any test actually starts the process). Isolated-by-construction like everything
   * else here: the file only ever exists in this spawn's own fresh temp agent dir, never the
   * real one. Primary use: `compaction.keepRecentTokens` -- pi's default (20000 tokens) means
   * a realistically-sized scripted test conversation never has anything old enough to
   * compact, so AGENT-253's compaction coverage lowers it to make manual `compact` reachable
   * without generating an unreasonably large scripted conversation. */
  readonly settingsJson?: Record<string, unknown>;
}

export interface IsolatedSpawn {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: NodeJS.ProcessEnv;
  readonly cwd: string;
  readonly agentDir: string;
  /** Removes the temp agent dir (and the temp cwd, if one was created for this spawn).
   * Best-effort: leftover temp dirs are a cleanliness nit, not a correctness or isolation
   * problem, since each is uniquely named per mkdtempSync call. */
  readonly cleanup: () => void;
}

function resolvePiCliPath(): string {
  // pi-coding-agent's package.json declares `"bin": {"pi": "dist/cli.js"}` -- this is the
  // official CLI entry, not a reach into unstable internals. import.meta.resolve() gives us
  // the package's `.` export (dist/index.js); walk up two levels to the package root.
  const indexPath = fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'));
  const packageDir = dirname(dirname(indexPath));
  return join(packageDir, 'dist', 'cli.js');
}

function withoutPiAndSandpiperVariables(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(source).filter(([name]) => !/^(PI|SANDPIPER)_/.test(name)));
}

/**
 * Build (but do not run) an isolated pi/sandpiper invocation. Callers pass the returned
 * command/args/env/cwd to child_process.spawn/spawnSync/execFileSync -- this function never
 * spawns anything itself, so the print-mode and RPC drivers can share it without duplicating
 * the isolation logic.
 */
export function prepareIsolatedSpawn(options: IsolatedSpawnOptions): IsolatedSpawn {
  const agentDir = mkdtempSync(join(tmpdir(), 'sandpiper-integration-agent-'));
  const ownsCwd = options.cwd === undefined;
  const cwd = options.cwd ?? mkdtempSync(join(tmpdir(), 'sandpiper-integration-cwd-'));

  const env: NodeJS.ProcessEnv = {
    // Inherit the caller's environment first (including PATH) so the op-shim tripwire prefix
    // and any other outer-process env stay intact for the spawned child. The caller's own Pi and
    // Sandpiper variables are dropped: inside a Sandpiper session they carry that session's
    // package identity (PI_PACKAGE_DIR makes stock pi run as sandpiper) and session state.
    ...withoutPiAndSandpiperVariables(process.env),
    ...options.env,
    // Both names, always -- entry:'pi' resolves APP_NAME="pi" (no Sandpiper piConfig in
    // scope, since raw pi never sees this repo's package.json), entry:'sandpiper' resolves
    // APP_NAME="sandpiper". Setting both is zero-cost and correct regardless of which one the
    // spawned process actually honors (AGENT-221's confirmed ENV_AGENT_DIR derivation). This
    // is the actual fix for the incident this harness exists to contain -- see the design
    // doc's "Incident log" section: hand-run debug commands that set only one of these two
    // names silently inherited the *real* agent dir under the other name.
    // External user skills must also resolve inside this spawn's sandbox.
    HOME: agentDir,
    SANDPIPER_CODING_AGENT_DIR: agentDir,
    PI_CODING_AGENT_DIR: agentDir,
    PI_SKIP_VERSION_CHECK: '1',
    // Direct harness use must stay isolated even outside the root Vitest command.
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    JJ_CONFIG: JJ_FIXTURE,
  };

  if (options.settingsJson) {
    writeFileSync(join(agentDir, 'settings.json'), JSON.stringify(options.settingsJson));
  }

  const flags: string[] = [
    // Suppresses startup network operations (model-catalog refresh and similar) so isolated
    // runs don't make incidental network calls -- verified empirically: without this flag, a
    // pinned-but-unused provider like amazon-bedrock triggered repeated
    // https://pi.dev/api/models/providers/... catalog fetches at startup, independent of
    // whether a turn was ever attempted; with it, those fetches don't happen. This is not a
    // security boundary (see the postmortem in README.md for why this harness doesn't need
    // one) -- it's a determinism/hermeticity measure, so isolated tests don't depend on
    // reaching a real network endpoint just to start up.
    '--offline',
  ];
  if (options.entry === 'pi') {
    flags.push('--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files');
  }
  const harnessExtensions = options.skipMockProvider ? [] : [MOCK_PROVIDER_PATH];
  for (const extensionPath of [...(options.extraExtensions ?? []), ...harnessExtensions]) {
    flags.push('-e', extensionPath);
  }
  if (!options.skipProviderPin) {
    flags.push('--provider', options.provider ?? MOCK_PROVIDER_ID, '--model', options.model ?? MOCK_MODEL_ID);
  }

  const entrypoint =
    options.entry === 'sandpiper' ? join(repoRoot, 'packages', 'cli', 'sandpiper_standalone.ts') : resolvePiCliPath();

  const cleanup = () => {
    try {
      rmSync(agentDir, { recursive: true, force: true });
    } catch {
      // Non-fatal; see class doc comment on IsolatedSpawn.cleanup.
    }
    if (ownsCwd) {
      try {
        rmSync(cwd, { recursive: true, force: true });
      } catch {
        // Non-fatal; see class doc comment on IsolatedSpawn.cleanup.
      }
    }
  };

  return {
    command: 'bun',
    args: [entrypoint, ...flags, ...(options.args ?? [])],
    env,
    cwd,
    agentDir,
    cleanup,
  };
}
