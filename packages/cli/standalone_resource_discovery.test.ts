import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai-cli');
const piPackageDir = dirname(dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'))));

describe('standalone Sandpiper resource discovery', () => {
  it.each([false, true])(
    'loads custom skills, prompts, themes and PATH-gated Trail without bundled resources (%s)',
    async (withTrail) => {
      const agentDir = await mkdtemp(join(tmpdir(), 'sp-res-'));
      const home = join(agentDir, 'home');
      const bin = join(agentDir, 'bin');
      const trailSkill = join(home, 'git', 'skills-incubator', 'skills', 'trail');
      await mkdir(home, { recursive: true });
      await mkdir(bin);
      const customSkills = join(agentDir, 'custom-skills');
      await mkdir(join(customSkills, 'fixture-skill'), { recursive: true });
      await writeFile(
        join(customSkills, 'fixture-skill', 'SKILL.md'),
        '---\nname: fixture-skill\ndescription: Custom skill fixture.\n---\n# Fixture\n',
      );
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
      for (const key of Object.keys(process.env)) {
        if (/^(PI|SANDPIPER)_/.test(key)) vi.stubEnv(key, undefined);
      }
      for (const [key, value] of Object.entries({
        HOME: home,
        PATH: bin,
        XDG_CONFIG_HOME: join(agentDir, 'config'),
        XDG_STATE_HOME: join(agentDir, 'state'),
        XDG_CACHE_HOME: join(agentDir, 'cache'),
        XDG_RUNTIME_DIR: agentDir,
        JITI_FS_CACHE: 'false',
        PI_PACKAGE_DIR: repoRoot,
        PI_CODING_AGENT_PACKAGE: piPackageDir,
        PI_SKIP_VERSION_CHECK: '1',
        PI_OFFLINE: '1',
        PI_CODING_AGENT_DIR: agentDir,
        SANDPIPER_CODING_AGENT_DIR: agentDir,
        PI_CODING_AGENT_SESSION_DIR: join(agentDir, 'sessions'),
        SANDPIPER_CODING_AGENT_SESSION_DIR: join(agentDir, 'sessions'),
        AGENT_JOURNAL_DIR: join(agentDir, 'journal'),
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_SYSTEM: '/dev/null',
        JJ_CONFIG: join(repoRoot, 'devtools', 'test-fixtures', 'jj-test-config.toml'),
      })) {
        vi.stubEnv(key, value);
      }

      try {
        const { createNeutralCapabilityExtensionFactories } = await import('./sandpiper_resources.js');
        const { DefaultResourceLoader, SessionManager, createAgentSession } = await import(
          '@earendil-works/pi-coding-agent'
        );

        const resourceLoader = new DefaultResourceLoader({
          cwd: agentDir,
          agentDir,
          additionalSkillPaths: [customSkills],
          additionalPromptTemplatePaths: [customPrompts],
          additionalThemePaths: [customThemes],
          extensionFactories: [...createNeutralCapabilityExtensionFactories()],
          noExtensions: true,
          noSkills: true,
          noPromptTemplates: false,
          noThemes: false,
          noContextFiles: true,
        });

        await resourceLoader.reload();

        const { session } = await createAgentSession({
          cwd: agentDir,
          agentDir,
          resourceLoader,
          sessionManager: SessionManager.inMemory(),
        });

        try {
          await session.bindExtensions({});

          const skillNames = resourceLoader.getSkills().skills.map((skill) => skill.name);
          const promptNames = resourceLoader.getPrompts().prompts.map((prompt) => prompt.name);

          expect(skillNames.sort()).toEqual(withTrail ? ['fixture-skill', 'trail'] : ['fixture-skill']);
          expect(resourceLoader.getSkills().skills.find((skill) => skill.name === 'fixture-skill')?.baseDir).toBe(
            join(customSkills, 'fixture-skill'),
          );
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
        vi.unstubAllEnvs();
        await rm(agentDir, { recursive: true, force: true });
      }
    },
    15_000,
  );
});
