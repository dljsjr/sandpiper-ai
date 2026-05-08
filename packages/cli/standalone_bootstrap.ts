import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export interface StandalonePaths {
  readonly resourceRoot: string;
  readonly packageDir: string;
  readonly packageDirSource: 'generated' | 'override' | 'app-bundle' | 'prebuilt-package';
}

export interface ResolveStandalonePathsOptions {
  readonly startDir: string;
  readonly env: NodeJS.ProcessEnv;
  readonly executablePath?: string;
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

export interface ConfiguredSandpiperPackageOptions {
  readonly resourceRoot: string;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

interface PackageJsonWithPiConfig {
  readonly name?: string;
  readonly version?: string;
  readonly piConfig?: {
    readonly name?: string;
    readonly configDir?: string;
    readonly bin?: string;
  };
  readonly license?: string;
}

interface StandaloneAppSidecarPackageJson {
  readonly piCodingAgentVersion?: string;
}

interface SettingsPackageEntry {
  readonly source?: string;
}

interface SettingsFile {
  readonly packages?: readonly (string | SettingsPackageEntry)[];
}

const EXEMPT_PI_VARS = new Set([
  'PI_CODING_AGENT_PACKAGE',
  'PI_CODING_AGENT_VERSION',
  'PI_PACKAGE_DIR',
  'PI_SKIP_VERSION_CHECK',
]);

const SANDPIPER_PACKAGE_NAME = 'sandpiper-ai';
const SANDPIPER_CONFIG_DIR = '.sandpiper';
const BUN_EMBEDDED_FILESYSTEM_ROOT = '/$bunfs/';

function standaloneAppDirFromExecutable(executablePath: string): string {
  return dirname(resolve(executablePath));
}

function hasStandaloneAppSidecar(executablePath: string): boolean {
  const packageJsonPath = join(standaloneAppDirFromExecutable(executablePath), 'package.json');

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as StandaloneAppSidecarPackageJson;
    return packageJson.piCodingAgentVersion !== undefined;
  } catch {
    return false;
  }
}

function isCompiledBunEntrypoint(options: ResolveStandalonePathsOptions): boolean {
  const executablePath = options.executablePath;
  if (executablePath === undefined) return false;

  return resolve(options.startDir).startsWith(BUN_EMBEDDED_FILESYSTEM_ROOT) || hasStandaloneAppSidecar(executablePath);
}

function hasPrebuiltPackageLayout(resourceRoot: string): boolean {
  return (
    existsSync(join(resourceRoot, 'sandpiper')) &&
    existsSync(join(resourceRoot, 'package.json')) &&
    existsSync(join(resourceRoot, 'docs')) &&
    existsSync(join(resourceRoot, 'dist', 'modes')) &&
    existsSync(join(resourceRoot, 'dist', 'core'))
  );
}

function resolveDefaultStandaloneResourceRoot(options: ResolveStandalonePathsOptions): string {
  const executablePath = options.executablePath;
  if (executablePath !== undefined && isCompiledBunEntrypoint(options)) {
    return standaloneAppDirFromExecutable(executablePath);
  }

  return findPackageRoot(options.startDir, SANDPIPER_PACKAGE_NAME);
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
    : resolveDefaultStandaloneResourceRoot(options);

  if (options.env.SANDPIPER_STANDALONE_PACKAGE_DIR) {
    return {
      resourceRoot,
      packageDir: resolve(options.env.SANDPIPER_STANDALONE_PACKAGE_DIR),
      packageDirSource: 'override',
    };
  }

  if (isCompiledBunEntrypoint(options)) {
    return {
      resourceRoot,
      packageDir: resourceRoot,
      packageDirSource: 'app-bundle',
    };
  }

  if (hasPrebuiltPackageLayout(resourceRoot)) {
    return {
      resourceRoot,
      packageDir: resourceRoot,
      packageDirSource: 'prebuilt-package',
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

  replaceWithSymlink(
    join(options.resourceRoot, 'extensions', 'shell-relay', 'shell-integration'),
    join(options.packageDir, 'extensions', 'shell-relay', 'shell-integration'),
  );
  replaceWithSymlink(join(options.piPackageDir, 'dist', 'modes'), join(options.packageDir, 'dist', 'modes'));
  replaceWithSymlink(join(options.piPackageDir, 'dist', 'core'), join(options.packageDir, 'dist', 'core'));
}

function expandConfigPath(input: string): string {
  if (input === '~') return homedir();
  if (input.startsWith('~/')) return join(homedir(), input.slice(2));
  return resolve(input);
}

function resolveAgentDir(env: NodeJS.ProcessEnv): string {
  const configured = env.SANDPIPER_CODING_AGENT_DIR ?? env.PI_CODING_AGENT_DIR;
  return configured ? expandConfigPath(configured) : join(homedir(), SANDPIPER_CONFIG_DIR, 'agent');
}

function readSettingsFile(path: string): SettingsFile {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SettingsFile;
  } catch {
    return {};
  }
}

function packageSource(entry: string | SettingsPackageEntry): string | undefined {
  return typeof entry === 'string' ? entry : entry.source;
}

function isNpmSandpiperPackage(source: string): boolean {
  if (!source.startsWith('npm:')) return false;
  const spec = source.slice('npm:'.length).split('@')[0];
  return spec === SANDPIPER_PACKAGE_NAME;
}

function isLocalPackageSource(source: string): boolean {
  return (
    source === '~' ||
    source.startsWith('~/') ||
    source.startsWith('/') ||
    source.startsWith('./') ||
    source.startsWith('../')
  );
}

function realpathIfExists(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  return realpathSync(path);
}

function localSourceMatchesSandpiper(source: string, baseDir: string, sandpiperRoots: ReadonlySet<string>): boolean {
  if (!isLocalPackageSource(source)) return false;

  const resolved = source.startsWith('~') ? expandConfigPath(source) : resolve(baseDir, source);
  const realpath = realpathIfExists(resolved);
  if (!realpath) return false;
  if (sandpiperRoots.has(realpath)) return true;

  const packageJsonPath = join(realpath, 'package.json');
  if (!existsSync(packageJsonPath)) return false;
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { name?: string };
    return packageJson.name === SANDPIPER_PACKAGE_NAME;
  } catch {
    return false;
  }
}

function settingsContainSandpiperPackage(
  settings: SettingsFile,
  baseDir: string,
  sandpiperRoots: ReadonlySet<string>,
): boolean {
  return (settings.packages ?? []).some((entry) => {
    const source = packageSource(entry);
    if (!source) return false;
    return isNpmSandpiperPackage(source) || localSourceMatchesSandpiper(source, baseDir, sandpiperRoots);
  });
}

export function hasConfiguredSandpiperPackage(options: ConfiguredSandpiperPackageOptions): boolean {
  const resourceRoot = resolve(options.resourceRoot);
  const sandpiperRoots = new Set(
    [resourceRoot, join(resourceRoot, 'dist')]
      .map((path) => realpathIfExists(path))
      .filter((path) => path !== undefined),
  );
  const agentDir = resolveAgentDir(options.env);
  const globalSettingsPath = join(agentDir, 'settings.json');
  const projectSettingsDir = join(options.cwd, SANDPIPER_CONFIG_DIR);
  const projectSettingsPath = join(projectSettingsDir, 'settings.json');

  return (
    settingsContainSandpiperPackage(readSettingsFile(globalSettingsPath), agentDir, sandpiperRoots) ||
    settingsContainSandpiperPackage(readSettingsFile(projectSettingsPath), projectSettingsDir, sandpiperRoots)
  );
}

export function defaultStandaloneMainArgs(args: readonly string[], _env: NodeJS.ProcessEnv): string[] {
  // Keep the env parameter in the boundary helper so future default CLI arguments can depend on host environment.
  return [...args];
}

export function configurePiEnvironment(options: PiEnvironmentOptions, env: NodeJS.ProcessEnv): void {
  env.PI_CODING_AGENT_PACKAGE = options.piPackageDir;
  env.PI_CODING_AGENT_VERSION = options.piVersion;
  env.PI_PACKAGE_DIR = options.packageDir;
  env.PI_SKIP_VERSION_CHECK = '1';
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
