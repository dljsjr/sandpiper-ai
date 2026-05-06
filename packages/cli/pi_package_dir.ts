import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SANDPIPER_PACKAGE_NAME = 'sandpiper-ai';

interface PackageJsonWithPiMetadata {
  readonly name?: string;
  readonly pi?: unknown;
}

function readPackageJson(dir: string): PackageJsonWithPiMetadata | undefined {
  const packageJsonPath = join(dir, 'package.json');
  if (!existsSync(packageJsonPath)) return undefined;

  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJsonWithPiMetadata;
  } catch {
    return undefined;
  }
}

function hasPiResourceMetadata(dir: string): boolean {
  return readPackageJson(dir)?.pi !== undefined;
}

function generatedDistPackageDir(packageDir: string): string | undefined {
  const packageJson = readPackageJson(packageDir);
  if (packageJson?.name !== SANDPIPER_PACKAGE_NAME) return undefined;

  const distPackageDir = join(packageDir, 'dist');
  return hasPiResourceMetadata(distPackageDir) ? distPackageDir : undefined;
}

export function findPiPackageDir(startDir: string): string {
  let dir = resolve(startDir);
  const root = resolve('/');

  while (dir !== root) {
    if (hasPiResourceMetadata(dir)) {
      return dir;
    }

    const generatedPackageDir = generatedDistPackageDir(dir);
    if (generatedPackageDir !== undefined) {
      return generatedPackageDir;
    }

    dir = dirname(dir);
  }

  throw new Error(
    `Could not find a Pi package directory from ${resolve(startDir)}. Run Sandpiper from within the sandpiper-ai repository or an installed Sandpiper distribution.`,
  );
}
