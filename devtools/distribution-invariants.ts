import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
