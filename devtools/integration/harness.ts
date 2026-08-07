// Isolation-by-construction spawn helper for the headless CLI/RPC integration-test lane
// (AGENT-249/250/251). Every integration test builds its spawn through this module -- no test
// file constructs its own child_process call -- so the isolation stack (temp agent dir, VCS
// config neutralization, mock-provider pinning, network-deny guard) is guaranteed by
// construction, not by per-test discipline.
//
// See .sandpiper/docs/specs/agent-249-headless-cli-integration-harness-design.md for the full
// design rationale, including why ANTHROPIC_BASE_URL-style blackholing is retired and why
// isolation env vars must be set under both the pi- and Sandpiper-branded names.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOCK_MODEL_ID, MOCK_PROVIDER_ID } from './mock-provider.js';

export { MOCK_MODEL_ID, MOCK_PROVIDER_ID } from './mock-provider.js';
export { NETWORK_DENY_SENTINEL } from './network-deny-guard.js';

const integrationDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(integrationDir));

const TRAIL_JJ_FIXTURE = join(repoRoot, 'packages', 'trail', 'test-fixtures', 'jj-test-config.toml');
const MOCK_PROVIDER_PATH = join(integrationDir, 'mock-provider.ts');
const NETWORK_DENY_GUARD_PATH = join(integrationDir, 'network-deny-guard.ts');

/** `pi`: bypasses Sandpiper's own package manifest entirely -- the true single/combinatoric
 * extension isolation mode. `sandpiper`: loads Sandpiper's normal extension set on top of
 * whatever `extraExtensions` add. */
export type IsolationEntryMode = 'sandpiper' | 'pi';

export interface IsolatedSpawnOptions {
  readonly entry: IsolationEntryMode;
  /** Extension file paths to load via repeatable `-e`, on top of the harness's own
   * mock-provider and network-deny-guard extensions (always loaded, regardless of entry
   * mode or provider/model pinning -- the guard is a process-wide backstop, not conditional
   * on the mock actually being selected). */
  readonly extraExtensions?: readonly string[];
  /** For entry:'pi', disable discovery of everything except explicit `-e` paths (true
   * per-extension isolation). Defaults to true for entry:'pi'; has no effect for
   * entry:'sandpiper' (Sandpiper's own manifest always loads there by design). */
  readonly isolateExtensions?: boolean;
  /** Provider/model to pin via `--provider`/`--model`. Defaults to the harness's mock
   * provider -- isolation-by-construction means every spawn is pinned to *something*
   * explicit, never left to resolve on its own. Only override this to deliberately exercise
   * the network-deny guard's backstop (e.g. AGENT-252's guard-fires proof); any other use
   * reintroduces the ambient-credential incident this harness exists to prevent. */
  readonly provider?: string;
  readonly model?: string;
  /** Additional CLI args appended after the isolation/provider-pin flags. */
  readonly args?: readonly string[];
  /** Working directory for the spawned process. Defaults to a fresh temp dir, so tests never
   * touch this repo's own tree as a cwd side effect. */
  readonly cwd?: string;
  /** Extra env vars layered on top of the isolation defaults. Isolation vars (agent-dir
   * names, GIT_CONFIG_*, JJ_CONFIG) always win over this -- pass agent-dir-relative state
   * through `agentDir` instead of trying to override them. */
  readonly env?: Readonly<NodeJS.ProcessEnv>;
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
    // and any other outer-process env stay intact for the spawned child.
    ...process.env,
    ...options.env,
    // Both names, always -- entry:'pi' resolves APP_NAME="pi" (no Sandpiper piConfig in
    // scope, since raw pi never sees this repo's package.json), entry:'sandpiper' resolves
    // APP_NAME="sandpiper". Setting both is zero-cost and correct regardless of which one the
    // spawned process actually honors (AGENT-221's confirmed ENV_AGENT_DIR derivation).
    SANDPIPER_CODING_AGENT_DIR: agentDir,
    PI_CODING_AGENT_DIR: agentDir,
    PI_SKIP_VERSION_CHECK: '1',
    // VCS neutralization, matching packages/trail/vitest.setup.ts's own isolation. That
    // setup file is NOT loaded when tests run via the root vitest sweep (nested
    // vitest.config.ts settings don't apply from root -- see the design doc's root-config-gap
    // finding), so this harness re-derives the same isolation explicitly rather than
    // depending on it being inherited.
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    JJ_CONFIG: TRAIL_JJ_FIXTURE,
    // Defense-in-depth for the network-deny guard itself, not a substitute for it: the AWS
    // credential chain checks env vars before ~/.aws or an IAM role, so pinning garbage
    // values here means that if the guard ever regresses (e.g. AGENT-252's Bedrock
    // guard-fires test has to drive a REAL dispatch attempt for smithy to even load -- see
    // the design doc), that dispatch authenticates as garbage and gets a 403 from AWS rather
    // than spending whatever real AWS credentials happen to be ambient on this machine. Same
    // principle as the op-shim tripwire: the backstop behind the backstop assumes the
    // mechanism above it fails.
    AWS_ACCESS_KEY_ID: 'sandpiper-integration-harness-fake-key',
    AWS_SECRET_ACCESS_KEY: 'sandpiper-integration-harness-fake-secret',
    AWS_PROFILE: 'sandpiper-integration-harness-nonexistent-profile',
  };

  const isolateExtensions = options.isolateExtensions ?? options.entry === 'pi';
  const flags: string[] = [];
  if (options.entry === 'pi' && isolateExtensions) {
    flags.push('--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files');
  }
  for (const extensionPath of [...(options.extraExtensions ?? []), MOCK_PROVIDER_PATH, NETWORK_DENY_GUARD_PATH]) {
    flags.push('-e', extensionPath);
  }
  flags.push('--provider', options.provider ?? MOCK_PROVIDER_ID, '--model', options.model ?? MOCK_MODEL_ID);

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
