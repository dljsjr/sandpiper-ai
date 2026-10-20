import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface StandalonePaths {
  readonly resourceRoot: string;
  readonly packageDir: string;
  readonly packageDirSource: 'generated' | 'override';
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

export interface PrepareStandalonePackageDirOptions {
  readonly packageDir: string;
  readonly resourceRoot: string;
  readonly piPackageDir: string;
}

interface PackageJsonWithPiConfig {
  readonly version?: string;
  readonly piConfig?: {
    readonly name?: string;
    readonly configDir?: string;
    readonly bin?: string;
  };
  readonly license?: string;
}

const EXEMPT_PI_VARS = new Set([
  'PI_CODING_AGENT_PACKAGE',
  'PI_CODING_AGENT_VERSION',
  'PI_PACKAGE_DIR',
  'PI_SKIP_VERSION_CHECK',
]);

const SANDPIPER_PACKAGE_NAME = 'sandpiper-ai';

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
    : findPackageRoot(options.startDir, SANDPIPER_PACKAGE_NAME);

  if (options.env.SANDPIPER_STANDALONE_PACKAGE_DIR) {
    return {
      resourceRoot,
      packageDir: resolve(options.env.SANDPIPER_STANDALONE_PACKAGE_DIR),
      packageDirSource: 'override',
    };
  }

  return {
    resourceRoot,
    packageDir: join(resourceRoot, 'dist', 'standalone-package'),
    packageDirSource: 'generated',
  };
}

function replaceWithSymlink(target: string, destination: string): void {
  mkdirSync(dirname(destination), { recursive: true });

  try {
    lstatSync(destination);
    rmSync(destination, { recursive: true, force: true });
  } catch {
    // Destination does not exist; nothing to remove.
  }

  symlinkSync(target, destination, 'dir');
}

function copyIfPresent(source: string, destination: string): void {
  if (!existsSync(source)) return;
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function symlinkDirIfPresent(source: string, destination: string): void {
  if (!existsSync(source)) return;
  replaceWithSymlink(source, destination);
}

export function prepareStandalonePackageDir(options: PrepareStandalonePackageDirOptions): void {
  const sourcePackageJson = JSON.parse(
    readFileSync(join(options.resourceRoot, 'package.json'), 'utf-8'),
  ) as PackageJsonWithPiConfig;

  mkdirSync(options.packageDir, { recursive: true });
  writeFileSync(
    join(options.packageDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'sandpiper-standalone-package',
        version: sourcePackageJson.version ?? '0.0.0',
        piConfig: sourcePackageJson.piConfig ?? {
          name: 'sandpiper',
          configDir: '.sandpiper',
          bin: 'sandpiper',
        },
        license: sourcePackageJson.license,
      },
      null,
      2,
    )}\n`,
  );

  copyIfPresent(join(options.resourceRoot, 'README.md'), join(options.packageDir, 'README.md'));
  copyIfPresent(join(options.resourceRoot, 'CHANGELOG.md'), join(options.packageDir, 'CHANGELOG.md'));
  symlinkDirIfPresent(join(options.resourceRoot, 'docs'), join(options.packageDir, 'docs'));
  replaceWithSymlink(join(options.piPackageDir, 'dist', 'modes'), join(options.packageDir, 'dist', 'modes'));
  replaceWithSymlink(join(options.piPackageDir, 'dist', 'core'), join(options.packageDir, 'dist', 'core'));
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
