import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SandpiperUserProfileDependencies {
  readonly agentDir?: string;
  readonly fileExists?: (path: string) => boolean;
  readonly readFile?: (path: string) => string;
}

export function getSandpiperUserProfilePath(agentDir: string): string {
  return join(agentDir, 'USER.md');
}

export function readSandpiperUserProfile(dependencies: SandpiperUserProfileDependencies = {}): string {
  if (!dependencies.agentDir) return '';

  const fileExists = dependencies.fileExists ?? existsSync;
  const readFile = dependencies.readFile ?? ((path: string) => readFileSync(path, 'utf-8'));
  const profilePath = getSandpiperUserProfilePath(dependencies.agentDir);

  if (!fileExists(profilePath)) return '';

  try {
    return readFile(profilePath);
  } catch {
    return '';
  }
}
