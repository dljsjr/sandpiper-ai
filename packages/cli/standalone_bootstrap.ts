import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface StandalonePaths {
  readonly resourceRoot: string;
  readonly packageDir: string;
}

export interface ResolveStandalonePathsOptions {
  readonly startDir: string;
  readonly env: NodeJS.ProcessEnv;
}

export interface PiEnvironmentOptions {
  readonly packageDir: string;
  readonly piPackageDir: string;
  readonly piVersion: string;
}

const EXEMPT_PI_VARS = new Set([
  'PI_CODING_AGENT_PACKAGE',
  'PI_CODING_AGENT_VERSION',
  'PI_PACKAGE_DIR',
  'PI_SKIP_VERSION_CHECK',
]);

export function findPackageRoot(startDir: string, packageName: string): string {
  let dir = resolve(startDir);
  while (dir !== dirname(dir)) {
    const packageJsonPath = join(dir, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string };
      if (packageJson.name === packageName) {
        return dir;
      }
    }
    dir = dirname(dir);
  }
  throw new Error(`Unable to find package root for ${packageName} from ${startDir}`);
}

export function resolveStandalonePaths(options: ResolveStandalonePathsOptions): StandalonePaths {
  const packageDir = options.env.SANDPIPER_STANDALONE_PACKAGE_DIR
    ? resolve(options.env.SANDPIPER_STANDALONE_PACKAGE_DIR)
    : findPackageRoot(options.startDir, 'sandpiper-ai-cli');
  const resourceRoot = options.env.SANDPIPER_STANDALONE_RESOURCE_ROOT
    ? resolve(options.env.SANDPIPER_STANDALONE_RESOURCE_ROOT)
    : resolve(options.startDir) === packageDir
      ? resolve(packageDir, '..', 'resources')
      : join(packageDir, 'dist', 'standalone', 'resources');

  if (!['skills', 'prompts', 'themes'].every((directory) => existsSync(join(resourceRoot, directory)))) {
    throw new Error(`Sandpiper resources are missing at ${resourceRoot}. Rebuild or reinstall Sandpiper.`);
  }
  return { resourceRoot, packageDir };
}

export function defaultStandaloneMainArgs(args: readonly string[], _env: NodeJS.ProcessEnv): string[] {
  return [...args];
}

export function configurePiEnvironment(options: PiEnvironmentOptions, env: NodeJS.ProcessEnv): void {
  env.PI_CODING_AGENT_PACKAGE = options.piPackageDir;
  env.PI_CODING_AGENT_VERSION = options.piVersion;
  env.PI_PACKAGE_DIR = options.packageDir;
  env.PI_SKIP_VERSION_CHECK = '1';
  env.PI_TELEMETRY ??= '0';
  env.AGENT_JOURNAL_DIR ??= resolve(process.cwd(), '.sandpiper');
  env.SANDPIPER_CODING_AGENT_PACKAGE = options.packageDir;
}

export function mirrorPiSandpiperEnvironment(env: NodeJS.ProcessEnv): void {
  for (const [key, val] of Object.entries(env)) {
    if (!key.startsWith('PI_') || EXEMPT_PI_VARS.has(key) || val === undefined) continue;
    const sandpiperKey = `SANDPIPER_${key.slice(3)}`;
    if (env[sandpiperKey] === undefined) {
      env[sandpiperKey] = val;
    }
  }

  for (const [key, val] of Object.entries(env)) {
    if (!key.startsWith('SANDPIPER_') || val === undefined) continue;
    const piKey = `PI_${key.slice(10)}`;
    if (EXEMPT_PI_VARS.has(piKey)) continue;
    env[piKey] = val;
  }
}
