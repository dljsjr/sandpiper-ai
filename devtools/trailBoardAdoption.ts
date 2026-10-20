import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const trailConfigFiles = ['.trail.json', 'trail.json', '.trail/config.json'] as const;

export interface BoardAdoptionOptions {
  readonly rootDir: string;
  readonly tasksDir: string;
  readonly configFile?: string;
}

export interface EnabledTaskVersionControl {
  readonly enabled: true;
  readonly mode: { readonly branch: string; readonly repo?: string };
  readonly auto_commit: boolean;
  readonly auto_push: boolean;
}

export interface AdoptedTrailConfig {
  readonly version: 2;
  readonly tasks_dir: string;
  readonly version_control: EnabledTaskVersionControl | { readonly enabled: false };
}

export interface BoardAdoptionPlan {
  readonly disposition: 'create' | 'already-adopted';
  readonly rootDir: string;
  readonly tasksPath: string;
  readonly configPath: string;
  readonly legacySource?: string;
  readonly existingConfigPaths: readonly string[];
  readonly config: AdoptedTrailConfig;
}

export function planBoardAdoption(options: BoardAdoptionOptions): BoardAdoptionPlan {
  const rootDir = resolve(options.rootDir);
  if (!statSync(rootDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Project root must name an existing directory: ${rootDir}`);
  }
  const { legacySource, versionControl } = readLegacyConfiguration(rootDir, options.configFile);
  const tasksPath = resolve(rootDir, options.tasksDir);
  if (options.tasksDir.length === 0) throw new Error('Task directory must not be empty.');
  if (!isAbsolute(options.tasksDir) && !containsPath(rootDir, tasksPath)) {
    throw new Error('Relative task directory must not escape the project root. Use an absolute path.');
  }
  if (!statSync(tasksPath, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Task directory must name an existing directory: ${tasksPath}`);
  }
  assertStorageLocation(rootDir, tasksPath, versionControl);
  const existingConfigPaths = readExistingConfigurations(rootDir, tasksPath, versionControl);
  return {
    disposition: existingConfigPaths.length ? 'already-adopted' : 'create',
    rootDir,
    tasksPath,
    configPath: join(rootDir, '.trail', 'config.json'),
    ...(legacySource ? { legacySource } : {}),
    existingConfigPaths,
    config: {
      version: 2,
      tasks_dir: options.tasksDir,
      version_control: versionControl,
    },
  };
}

function hasEntry(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
}

function containsPath(directory: string, path: string): boolean {
  const location = relative(directory, path);
  return !isAbsolute(location) && location !== '..' && !location.startsWith(`..${sep}`);
}

function physicalLocation(path: string): string {
  let existing = resolve(path);
  const suffix: string[] = [];
  while (!hasEntry(existing)) {
    suffix.unshift(basename(existing));
    existing = dirname(existing);
  }
  return resolve(realpathSync(existing), ...suffix);
}

function assertStorageLocation(rootDir: string, tasksPath: string, vc: AdoptedTrailConfig['version_control']): void {
  if (!vc.enabled) return;
  const physicalRoot = realpathSync(rootDir);
  const physicalTasks = realpathSync(tasksPath);
  const checkout = hasEntry(join(tasksPath, '.git')) || hasEntry(join(tasksPath, '.jj'));
  if (vc.mode.branch === '@' && vc.mode.repo === undefined) {
    if (checkout && physicalTasks !== physicalRoot) {
      throw new Error(
        `Task directory ${tasksPath} is a separate checkout but legacy configuration selects inline storage.`,
      );
    }
    return;
  }
  if (containsPath(tasksPath, rootDir) || containsPath(physicalTasks, physicalRoot)) {
    throw new Error(`Separate task directory must not contain the project root or its ancestor: ${tasksPath}`);
  }
  for (const file of trailConfigFiles) {
    const configPath = join(rootDir, file);
    if (containsPath(tasksPath, configPath) || containsPath(physicalTasks, physicalLocation(configPath))) {
      throw new Error(`Separate task directory must not contain configuration ${configPath}: ${tasksPath}`);
    }
  }
  if (!checkout) throw new Error(`Separate task directory has no existing Git or jj checkout: ${tasksPath}`);
}

function readExistingConfigurations(
  rootDir: string,
  tasksPath: string,
  versionControl: AdoptedTrailConfig['version_control'],
): string[] {
  const existing: string[] = [];
  for (const file of trailConfigFiles) {
    const path = join(rootDir, file);
    if (!hasEntry(path)) continue;
    try {
      const config = parseExistingConfiguration(JSON.parse(readFileSync(path, 'utf8')));
      const configuredTasks = resolve(rootDir, config.tasks_dir);
      if (
        (!isAbsolute(config.tasks_dir) && !containsPath(rootDir, configuredTasks)) ||
        realpathSync(configuredTasks) !== realpathSync(tasksPath) ||
        JSON.stringify(config.version_control) !== JSON.stringify(versionControl)
      ) {
        throw new Error('Conflicts with the requested task directory or effective legacy VCS configuration.');
      }
      existing.push(path);
    } catch (error) {
      throw new Error(
        `Cannot adopt with existing Trail configuration ${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return existing;
}

function parseExistingConfiguration(value: unknown): AdoptedTrailConfig {
  const config = object(value, 'Trail configuration');
  if (config.version !== 2) throw new Error('Trail configuration version must be 2.');
  const tasksDir = config.tasks_dir;
  if (typeof tasksDir !== 'string' || tasksDir.length === 0) throw new Error('tasks_dir must be a non-empty string.');
  const vc = object(config.version_control, 'version_control');
  if (vc.enabled === false) {
    if (Object.keys(vc).length !== 1) throw new Error('Disabled version_control must contain only enabled.');
    return { version: 2, tasks_dir: tasksDir, version_control: { enabled: false } };
  }
  if (vc.enabled !== true) throw new Error('version_control.enabled must be a boolean.');
  const mode = object(vc.mode, 'mode');
  const branch = mode.branch;
  const repo = mode.repo;
  const autoCommit = vc.auto_commit;
  const autoPush = vc.auto_push;
  if (typeof branch !== 'string') throw new Error('mode.branch must be a string.');
  if (repo !== undefined && typeof repo !== 'string') throw new Error('mode.repo must be a string.');
  if (typeof autoCommit !== 'boolean' || typeof autoPush !== 'boolean')
    throw new Error('auto_commit and auto_push must be booleans.');
  return {
    version: 2,
    tasks_dir: tasksDir,
    version_control: {
      enabled: true,
      mode: { branch, ...(repo !== undefined ? { repo } : {}) },
      auto_commit: autoCommit,
      auto_push: autoPush,
    },
  };
}

function readLegacyConfiguration(
  rootDir: string,
  configFile?: string,
): {
  readonly legacySource?: string;
  readonly versionControl: AdoptedTrailConfig['version_control'];
} {
  const sourcePath = join(rootDir, '.sandpiper-tasks.json');
  const settingsPath = join(rootDir, '.sandpiper', 'settings.json');
  const legacySource =
    configFile !== undefined
      ? resolve(rootDir, configFile)
      : hasEntry(sourcePath)
        ? sourcePath
        : hasEntry(settingsPath)
          ? settingsPath
          : undefined;
  try {
    const raw: unknown = legacySource ? JSON.parse(readFileSync(legacySource, 'utf8')) : {};
    const sourceObject = object(raw, 'Legacy configuration');
    if (configFile !== undefined && legacySource !== settingsPath && Object.keys(sourceObject).length > 0) {
      const direct = 'version_control' in sourceObject;
      const wrapped = 'tasks' in sourceObject;
      if (direct === wrapped) throw new Error('Override must contain version_control or tasks, not both.');
    }
    const settings =
      legacySource === settingsPath || (configFile !== undefined && 'tasks' in sourceObject) ? sourceObject : undefined;
    const config = settings ? object(settings.tasks === undefined ? {} : settings.tasks, 'tasks') : sourceObject;
    return {
      ...(legacySource ? { legacySource } : {}),
      versionControl: parseLegacyVersionControl(config),
    };
  } catch (error) {
    throw new Error(
      `Cannot use legacy configuration ${legacySource}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function object(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${key} must be a non-empty string.`);
  return value;
}

function optionalBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean.`);
  return value;
}

function parseLegacyVersionControl(config: Record<string, unknown>): AdoptedTrailConfig['version_control'] {
  const vc = config.version_control === undefined ? {} : object(config.version_control, 'version_control');
  if (!optionalBoolean(vc, 'enabled', true)) return { enabled: false };
  const mode = vc.mode === undefined ? {} : object(vc.mode, 'mode');
  const repo = optionalString(mode, 'repo');
  return {
    enabled: true,
    mode: { branch: optionalString(mode, 'branch') ?? '@', ...(repo !== undefined ? { repo } : {}) },
    auto_commit: optionalBoolean(vc, 'auto_commit', false),
    auto_push: optionalBoolean(vc, 'auto_push', false),
  };
}
