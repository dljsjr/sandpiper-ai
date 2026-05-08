import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const dependencyFieldNames = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;
const unsupportedProtocolPattern = /^catalog:/;
const exactDependencyVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const skippedPackageJsonDirectoryNames = new Set([
  '.git',
  '.jj',
  '.sandpiper',
  'dist',
  'node_modules',
  'claude-plugin',
  'neutral-pi-package',
  'standalone-package',
  'standalone-sandpiper',
]);

export interface PackageJsonLike {
  readonly name?: string;
  readonly version?: string;
  readonly private?: boolean;
  readonly type?: string;
  readonly bin?: string | Record<string, string>;
  readonly keywords?: readonly string[];
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly optionalDependencies?: Record<string, string>;
  readonly [key: string]: unknown;
}

export interface UnsupportedDependencySpec {
  readonly packageJsonPath: string;
  readonly field: (typeof dependencyFieldNames)[number];
  readonly dependency: string;
  readonly spec: string;
}

export interface MissingFileDependencyTarget {
  readonly packageJsonPath: string;
  readonly field: (typeof dependencyFieldNames)[number];
  readonly dependency: string;
  readonly spec: string;
  readonly expectedPackageJsonPath: string;
}

export interface NonExactDependencySpec {
  readonly packageJsonPath: string;
  readonly field: (typeof dependencyFieldNames)[number];
  readonly dependency: string;
  readonly spec: string;
}

export interface DependencySpecPolicy {
  readonly localWorkspaceProtocolPackageNames?: readonly string[];
}

interface DependencyEntry {
  readonly field: (typeof dependencyFieldNames)[number];
  readonly dependency: string;
  readonly spec: string;
}

export function readPackageJson(path: string): PackageJsonLike {
  return JSON.parse(readFileSync(path, 'utf-8')) as PackageJsonLike;
}

function findPackageJsonFiles(root: string): readonly string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const packageJsonFiles: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (skippedPackageJsonDirectoryNames.has(entry.name)) continue;

    if (entry.isDirectory()) {
      packageJsonFiles.push(...findPackageJsonFiles(path));
      continue;
    }

    if (entry.isFile() && entry.name === 'package.json') {
      packageJsonFiles.push(path);
    }
  }

  return packageJsonFiles;
}

function dependencyEntries(packageJson: PackageJsonLike): readonly DependencyEntry[] {
  return dependencyFieldNames.flatMap((field) =>
    Object.entries(packageJson[field] ?? {}).map(([dependency, spec]) => ({ dependency, field, spec })),
  );
}

function localPackageNames(root: string): ReadonlySet<string> {
  return new Set(
    findPackageJsonFiles(root)
      .map((packageJsonPath) => readPackageJson(packageJsonPath).name)
      .filter((name): name is string => name !== undefined),
  );
}

function isExactOrAllowedDependencySpec(
  packageJson: PackageJsonLike,
  entry: DependencyEntry,
  packageNames: ReadonlySet<string>,
  policy: DependencySpecPolicy,
): boolean {
  if (entry.spec.startsWith('file:')) return true;
  if (exactDependencyVersionPattern.test(entry.spec)) return true;

  return (
    entry.spec.startsWith('workspace:') &&
    packageNames.has(entry.dependency) &&
    policy.localWorkspaceProtocolPackageNames?.includes(packageJson.name ?? '') === true
  );
}

export function findUnsupportedDependencySpecs(root: string): readonly UnsupportedDependencySpec[] {
  return findPackageJsonFiles(root).flatMap((packageJsonPath) =>
    dependencyEntries(readPackageJson(packageJsonPath))
      .filter((entry) => unsupportedProtocolPattern.test(entry.spec))
      .map((entry) => ({ ...entry, packageJsonPath })),
  );
}

export function findNonExactDependencySpecs(
  root: string,
  policy: DependencySpecPolicy = {},
): readonly NonExactDependencySpec[] {
  const packageNames =
    policy.localWorkspaceProtocolPackageNames === undefined ? new Set<string>() : localPackageNames(root);

  return findPackageJsonFiles(root).flatMap((packageJsonPath) => {
    const packageJson = readPackageJson(packageJsonPath);

    return dependencyEntries(packageJson)
      .filter((entry) => !isExactOrAllowedDependencySpec(packageJson, entry, packageNames, policy))
      .map((entry) => ({ ...entry, packageJsonPath }));
  });
}

export function findMissingFileDependencyTargets(root: string): readonly MissingFileDependencyTarget[] {
  return findPackageJsonFiles(root).flatMap((packageJsonPath) =>
    dependencyEntries(readPackageJson(packageJsonPath))
      .filter((entry) => entry.spec.startsWith('file:'))
      .map((entry) => {
        const dependencyRoot = resolve(dirname(packageJsonPath), entry.spec.slice('file:'.length));
        return {
          ...entry,
          packageJsonPath,
          expectedPackageJsonPath: join(dependencyRoot, 'package.json'),
        };
      })
      .filter((entry) => !existsSync(entry.expectedPackageJsonPath)),
  );
}
