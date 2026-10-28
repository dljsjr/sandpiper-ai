import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
  it('stages resources without bundled prompt templates', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sandpiper-stage-no-prompts-'));
    try {
      await mkdir(join(root, 'packages/resources/skills'), { recursive: true });
      await put(root, 'packages/resources/themes/example.json', '{"name":"example"}');
      await put(root, 'docs/README.md', 'Documentation');
      await put(root, 'packages/cli/dist/standalone/resources/prompts/obsolete.md', 'stale prompt');
      await stageCliResources(root);
      const staged = join(root, 'packages/cli/dist/standalone/resources');
      expect(await readFile(join(staged, 'themes/example.json'), 'utf8')).toBe('{"name":"example"}');
      await expect(access(join(staged, 'prompts'))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('copies skills, prompts, themes, and docs without retired or orphaned helpers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sandpiper-stage-resources-'));
    try {
      await put(root, 'packages/resources/skills/code-review/SKILL.md', 'review instructions');
      await put(root, 'packages/resources/skills/code-review/references/guide.md', 'review reference');
      await put(root, 'packages/resources/skills/standup/scripts/sandpiper-standup', 'stale ignored helper');
      await put(root, 'packages/resources/skills/.DS_Store', 'unwanted');
      await put(root, 'packages/resources/prompts/review.md', 'review prompt');
      await put(root, 'packages/resources/themes/example.json', '{"name":"example"}');
      await put(root, 'docs/README.md', 'Sandpiper documentation');
      await put(root, 'docs/dev/example.md', 'developer reference');
      await put(root, 'packages/cli/dist/standalone/resources/skills/tasks/SKILL.md', 'stale task skill');
      await put(root, 'packages/cli/dist/standalone/resources/skills/standup/SKILL.md', 'stale standup skill');
      await put(root, 'packages/cli/docs/obsolete.md', 'stale docs');
      await stageCliResources(root);
      const staged = join(root, 'packages/cli/dist/standalone/resources');
      expect(await readFile(join(staged, 'skills/code-review/SKILL.md'), 'utf8')).toBe('review instructions');
      expect(await readFile(join(staged, 'skills/code-review/references/guide.md'), 'utf8')).toBe('review reference');
      expect(await readFile(join(staged, 'prompts/review.md'), 'utf8')).toBe('review prompt');
      expect(await readFile(join(staged, 'themes/example.json'), 'utf8')).toBe('{"name":"example"}');
      expect(await readFile(join(root, 'packages/cli/docs/dev/example.md'), 'utf8')).toBe('developer reference');
      for (const path of ['skills/tasks', 'skills/.DS_Store', 'skills/standup']) {
        await expect(access(join(staged, path))).rejects.toThrow();
      }
      await expect(access(join(root, 'packages/cli/docs/obsolete.md'))).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
