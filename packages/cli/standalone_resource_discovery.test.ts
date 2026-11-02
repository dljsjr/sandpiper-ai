import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai');
const piPackageDir = dirname(dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'))));

describe('standalone Sandpiper resource discovery', () => {
  it.each([false, true])(
    'loads custom prompts, themes and PATH-gated Trail without bundled templates (%s)',
    async (withTrail) => {
      const agentDir = await mkdtemp(join(tmpdir(), 'sandpiper-standalone-resources-'));
      const home = join(agentDir, 'home');
      const bin = join(agentDir, 'bin');
      const trailSkill = join(home, 'git', 'skills-incubator', 'skills', 'trail');
      await mkdir(home, { recursive: true });
      await mkdir(bin);
      const customPrompts = join(agentDir, 'custom-prompts');
      await mkdir(customPrompts);
      await writeFile(
        join(customPrompts, 'fixture-prompt.md'),
        '---\ndescription: Custom prompt fixture.\n---\nFixture prompt.\n',
      );
      const customThemes = join(agentDir, 'custom-themes');
      await mkdir(customThemes);
      const stockTheme = JSON.parse(
        await readFile(join(piPackageDir, 'dist', 'modes', 'interactive', 'theme', 'dark.json'), 'utf8'),
      ) as Record<string, unknown>;
      await writeFile(
        join(customThemes, 'fixture-theme.json'),
        JSON.stringify({ ...stockTheme, name: 'fixture-theme' }),
      );
      if (withTrail) {
        await mkdir(trailSkill, { recursive: true });
        await writeFile(
          join(trailSkill, 'SKILL.md'),
          '---\nname: trail\ndescription: Fixture Trail skill.\n---\n# Trail\n',
        );
        await writeFile(join(bin, 'trail'), '#!/bin/sh\nexit 99\n', { mode: 0o755 });
      }
      vi.stubEnv('HOME', home);
      vi.stubEnv('PATH', bin);
      const previousPackageDir = process.env.PI_PACKAGE_DIR;
      const previousSkipVersionCheck = process.env.PI_SKIP_VERSION_CHECK;
      const previousAgentDir = process.env.SANDPIPER_CODING_AGENT_DIR;

      try {
        process.env.PI_PACKAGE_DIR = repoRoot;
        process.env.PI_SKIP_VERSION_CHECK = '1';
        // bindExtensions() boots the web-search extension in-process, which reads the
        // real global agent-dir settings.json unless this is set — must not leak
        // Doug's real settings (e.g. an `!op read ...` braveApiKey) into the test.
        process.env.SANDPIPER_CODING_AGENT_DIR = agentDir;

        const { createNeutralCapabilityExtensionFactories } = await import('./sandpiper_resources.js');
        const { DefaultResourceLoader, SessionManager, createAgentSession } = await import(
          '@earendil-works/pi-coding-agent'
        );

        const resourceLoader = new DefaultResourceLoader({
          cwd: agentDir,
          agentDir,
          additionalPromptTemplatePaths: [customPrompts],
          additionalThemePaths: [customThemes],
          extensionFactories: [...createNeutralCapabilityExtensionFactories(join(repoRoot, 'packages', 'resources'))],
          noExtensions: true,
          noSkills: true,
          noPromptTemplates: false,
          noThemes: false,
          noContextFiles: true,
        });

        await resourceLoader.reload();

        const { session } = await createAgentSession({
          agentDir,
          resourceLoader,
          sessionManager: SessionManager.inMemory(),
        });

        try {
          await session.bindExtensions({});

          const skillNames = resourceLoader.getSkills().skills.map((skill) => skill.name);
          const promptNames = resourceLoader.getPrompts().prompts.map((prompt) => prompt.name);

          expect(skillNames.sort()).toEqual(withTrail ? ['trail'] : []);
          if (withTrail) {
            expect(resourceLoader.getSkills().skills.find((skill) => skill.name === 'trail')?.baseDir).toBe(trailSkill);
          }
          expect(promptNames).toEqual(['fixture-prompt']);
          expect(resourceLoader.getThemes().themes.map((theme) => theme.name)).toEqual(['fixture-theme']);
          expect(resourceLoader.getThemes().diagnostics).toEqual([]);
        } finally {
          session.dispose();
        }
      } finally {
        if (previousPackageDir === undefined) {
          delete process.env.PI_PACKAGE_DIR;
        } else {
          process.env.PI_PACKAGE_DIR = previousPackageDir;
        }

        if (previousSkipVersionCheck === undefined) {
          delete process.env.PI_SKIP_VERSION_CHECK;
        } else {
          process.env.PI_SKIP_VERSION_CHECK = previousSkipVersionCheck;
        }

        if (previousAgentDir === undefined) {
          delete process.env.SANDPIPER_CODING_AGENT_DIR;
        } else {
          process.env.SANDPIPER_CODING_AGENT_DIR = previousAgentDir;
        }

        vi.unstubAllEnvs();
        await rm(agentDir, { recursive: true, force: true });
      }
    },
    15_000,
  );
});
