import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const dependencyFieldNames = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'] as const;
const unsupportedProtocolPattern = /^(catalog|workspace):/;

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

export function readPackageJson(path: string): PackageJsonLike {
  return JSON.parse(readFileSync(path, 'utf-8')) as PackageJsonLike;
}

function findPackageJsonFiles(root: string): readonly string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const packageJsonFiles: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.name === 'node_modules') continue;

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

function dependencyEntries(packageJson: PackageJsonLike): readonly UnsupportedDependencySpec[] {
  return dependencyFieldNames.flatMap((field) =>
    Object.entries(packageJson[field] ?? {}).map(([dependency, spec]) => ({ dependency, field, spec })),
  );
}

export function findUnsupportedDependencySpecs(root: string): readonly UnsupportedDependencySpec[] {
  return findPackageJsonFiles(root).flatMap((packageJsonPath) =>
    dependencyEntries(readPackageJson(packageJsonPath))
      .filter((entry) => unsupportedProtocolPattern.test(entry.spec))
      .map((entry) => ({ packageJsonPath, ...entry })),
  );
}

export function findMissingFileDependencyTargets(root: string): readonly MissingFileDependencyTarget[] {
  return findPackageJsonFiles(root).flatMap((packageJsonPath) =>
    dependencyEntries(readPackageJson(packageJsonPath))
      .filter((entry) => entry.spec.startsWith('file:'))
      .map((entry) => {
        const dependencyRoot = resolve(dirname(packageJsonPath), entry.spec.slice('file:'.length));
        return {
          packageJsonPath,
          ...entry,
          expectedPackageJsonPath: join(dependencyRoot, 'package.json'),
        };
      })
      .filter((entry) => !existsSync(entry.expectedPackageJsonPath)),
  );
}
