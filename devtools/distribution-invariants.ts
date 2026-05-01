import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

export interface ForbiddenTextPattern {
  readonly name: string;
  readonly expression: RegExp;
}

export interface ForbiddenTextMatch {
  readonly relativePath: string;
  readonly line: number;
  readonly patternName: string;
  readonly match: string;
  readonly text: string;
}

export function findForbiddenTextMatches(
  rootDir: string,
  relativePaths: readonly string[],
  patterns: readonly ForbiddenTextPattern[],
): ForbiddenTextMatch[] {
  const matches: ForbiddenTextMatch[] = [];

  for (const relativePath of relativePaths) {
    const content = readFileSync(join(rootDir, relativePath), 'utf-8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        pattern.expression.lastIndex = 0;
        const match = pattern.expression.exec(line);

        if (match?.[0] !== undefined) {
          matches.push({
            relativePath,
            line: index + 1,
            patternName: pattern.name,
            match: match[0],
            text: line.trim(),
          });
        }
      }
    });
  }

  return matches;
}

export type PiManifestResourceField = 'extensions' | 'skills' | 'prompts' | 'themes';

export interface PiPackageManifest {
  readonly pi?: Partial<Record<PiManifestResourceField, readonly string[]>>;
}

export interface MissingPiManifestPath {
  readonly field: PiManifestResourceField;
  readonly declaredPath: string;
  readonly absolutePath: string;
}

const PI_MANIFEST_RESOURCE_FIELDS: readonly PiManifestResourceField[] = ['extensions', 'skills', 'prompts', 'themes'];

export function findMissingPiManifestPaths(packageRoot: string, manifest: PiPackageManifest): MissingPiManifestPath[] {
  const missingPaths: MissingPiManifestPath[] = [];

  for (const field of PI_MANIFEST_RESOURCE_FIELDS) {
    for (const declaredPath of manifest.pi?.[field] ?? []) {
      const absolutePath = resolve(packageRoot, declaredPath);

      if (!existsSync(absolutePath)) {
        missingPaths.push({ field, declaredPath, absolutePath });
      }
    }
  }

  return missingPaths;
}

export function materializePiManifestPaths(packageRoot: string, manifest: PiPackageManifest): void {
  for (const field of PI_MANIFEST_RESOURCE_FIELDS) {
    for (const declaredPath of manifest.pi?.[field] ?? []) {
      const absolutePath = resolve(packageRoot, declaredPath);

      if (extname(absolutePath) === '') {
        mkdirSync(absolutePath, { recursive: true });
      } else {
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, '');
      }
    }
  }
}
