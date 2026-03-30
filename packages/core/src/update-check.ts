export interface UpdateInfo {
  readonly name: string;
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly installCommand: string;
  readonly changelogUrl?: string;
}

export interface UpdateCheckEnv {
  readonly piCodingAgentVersion?: string;
  readonly bunVersion?: string;
}

export interface FetchLikeResponse {
  readonly ok: boolean;
  json(): Promise<unknown>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<FetchLikeResponse>;

export async function checkNpmVersion(
  packageName: string,
  currentVersion: string,
  fetchImpl: FetchLike = fetch as FetchLike,
): Promise<string | undefined> {
  try {
    const response = await fetchImpl(`https://registry.npmjs.org/${packageName}/latest`, {
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

export function getInstallCommand(packageName: string, env: UpdateCheckEnv = {}): string {
  if (env.bunVersion) return `bun install -g ${packageName}`;
  return `npm install -g ${packageName}`;
}

export async function checkForUpdates(
  env: UpdateCheckEnv,
  fetchImpl: FetchLike = fetch as FetchLike,
): Promise<readonly UpdateInfo[]> {
  const updates: UpdateInfo[] = [];

  if (env.piCodingAgentVersion) {
    const piLatest = await checkNpmVersion('@mariozechner/pi-coding-agent', env.piCodingAgentVersion, fetchImpl);
    if (piLatest) {
      updates.push({
        name: 'pi-coding-agent',
        currentVersion: env.piCodingAgentVersion,
        latestVersion: piLatest,
        installCommand: getInstallCommand('@mariozechner/pi-coding-agent', env),
        changelogUrl: 'https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/CHANGELOG.md',
      });
    }
  }

  return updates;
}
