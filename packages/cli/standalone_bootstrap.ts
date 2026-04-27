import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

export function findPackageRoot(startDir: string, packageName: string): string {
  let dir = resolve(startDir);
  const root = resolve('/');

  while (dir !== root) {
    const packageJsonPath = resolve(dir, 'package.json');
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
  const resourceRoot = options.env.SANDPIPER_STANDALONE_RESOURCE_ROOT
    ? resolve(options.env.SANDPIPER_STANDALONE_RESOURCE_ROOT)
    : findPackageRoot(options.startDir, 'sandpiper-ai');

  const packageDir = options.env.SANDPIPER_STANDALONE_PACKAGE_DIR
    ? resolve(options.env.SANDPIPER_STANDALONE_PACKAGE_DIR)
    : resourceRoot;

  return { resourceRoot, packageDir };
}

export function configurePiEnvironment(options: PiEnvironmentOptions, env: NodeJS.ProcessEnv): void {
  env.PI_CODING_AGENT_PACKAGE = options.piPackageDir;
  env.PI_CODING_AGENT_VERSION = options.piVersion;
  env.PI_PACKAGE_DIR = options.packageDir;
  env.PI_SKIP_VERSION_CHECK = '1';
}
