import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stageCliResources } from './stageCliResources.js';

async function put(root: string, path: string, contents: string): Promise<void> {
  const destination = join(root, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

describe('CLI resource staging', () => {
  it('copies skill trees, built helpers, prompts, themes, and docs into the CLI package', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sandpiper-stage-resources-'));
    try {
      await put(root, 'packages/resources/skills/tasks/SKILL.md', 'task instructions');
      await put(root, 'packages/resources/skills/tasks/references/SPEC.md', 'task reference');
      await put(root, 'packages/resources/skills/tasks/scripts/.gitignore', 'trail');
      await put(root, 'packages/resources/skills/.DS_Store', 'unwanted');
      await put(root, 'packages/resources/prompts/review.md', 'review prompt');
      await put(root, 'packages/resources/themes/example.json', '{"name":"example"}');
      await put(root, 'packages/trail/dist/trail', '#!/usr/bin/env node\nconsole.log("trail");');
      await put(
        root,
        'packages/sandpiper-standup-cli/dist/sandpiper-standup',
        '#!/usr/bin/env node\nconsole.log("standup");',
      );
      await put(root, 'docs/README.md', 'Sandpiper documentation');
      await put(root, 'docs/dev/example.md', 'developer reference');
      await put(root, 'packages/cli/dist/standalone/resources/skills/removed/SKILL.md', 'stale');
      await put(root, 'packages/cli/docs/obsolete.md', 'stale docs');
      await stageCliResources(root);
      const staged = join(root, 'packages/cli/dist/standalone/resources');
      expect(await readFile(join(staged, 'skills/tasks/SKILL.md'), 'utf8')).toBe('task instructions');
      expect(await readFile(join(staged, 'skills/tasks/references/SPEC.md'), 'utf8')).toBe('task reference');
      expect(await readFile(join(staged, 'prompts/review.md'), 'utf8')).toBe('review prompt');
      expect(await readFile(join(staged, 'themes/example.json'), 'utf8')).toBe('{"name":"example"}');
      for (const path of [
        'skills/tasks/scripts/trail',
        'skills/tasks/scripts/sandpiper-tasks',
        'skills/standup/scripts/sandpiper-standup',
      ]) {
        expect((await stat(join(staged, path))).mode & 0o111).toBe(0o111);
      }
      expect(await readFile(join(root, 'packages/cli/docs/dev/example.md'), 'utf8')).toBe('developer reference');
      for (const path of ['skills/removed', 'skills/.DS_Store', 'skills/tasks/scripts/.gitignore']) {
        await expect(access(join(staged, path))).rejects.toThrow();
      }
      await expect(access(join(root, 'packages/cli/docs/obsolete.md'))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
