import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findPackageRoot } from './standalone_bootstrap.js';

const repoRoot = findPackageRoot(dirname(fileURLToPath(import.meta.url)), 'sandpiper-ai');

describe('standalone Sandpiper resource discovery', () => {
  it('loads bundled skills and prompts through resources_discover', async () => {
    const agentDir = await mkdtemp(join(tmpdir(), 'sandpiper-standalone-resources-'));
    const previousPackageDir = process.env.PI_PACKAGE_DIR;
    const previousSkipVersionCheck = process.env.PI_SKIP_VERSION_CHECK;

    try {
      process.env.PI_PACKAGE_DIR = repoRoot;
      process.env.PI_SKIP_VERSION_CHECK = '1';

      const { createSandpiperExtensionFactories } = await import('./sandpiper_resources.js');
      const { DefaultResourceLoader, SessionManager, createAgentSession } = await import(
        '@mariozechner/pi-coding-agent'
      );

      const resourceLoader = new DefaultResourceLoader({
        cwd: repoRoot,
        agentDir,
        extensionFactories: createSandpiperExtensionFactories(repoRoot),
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
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

        expect(skillNames).toContain('tasks');
        expect(skillNames).toContain('standup');
        expect(promptNames).toContain('new-feature');
        expect(promptNames).toContain('code-review');
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

      await rm(agentDir, { recursive: true, force: true });
    }
  });
});
