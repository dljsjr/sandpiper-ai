import { accessSync, constants, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

export function temporaryTrailSkillPaths(): string[] {
  for (const directory of process.env.PATH?.split(delimiter) ?? []) {
    const executable = resolve(directory, 'trail');
    try {
      accessSync(executable, constants.X_OK);
      if (statSync(executable).isFile()) {
        // TOOLS-43 replaces this archived skill with Trail-owned discovery.
        return [join(homedir(), 'git', 'skills-incubator', 'skills', 'trail')];
      }
    } catch {}
  }
  return [];
}
