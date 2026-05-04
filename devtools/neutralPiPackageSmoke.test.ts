import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assembleNeutralPiPackage } from './neutralPiPackage.js';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

describe('neutral Pi package smoke', () => {
  it('loads neutral tools and resources without Sandpiper identity behavior', async () => {
    const tempRoot = mkdtempSync(join(repoRoot, '.tmp-neutral-pi-package-smoke-'));
    const packageDir = join(tempRoot, 'package');
    const agentDir = join(tempRoot, 'agent');
    const cwd = join(tempRoot, 'project');
    const previousPackageDir = process.env.PI_PACKAGE_DIR;
    const previousSkipVersionCheck = process.env.PI_SKIP_VERSION_CHECK;

    try {
      mkdirSync(agentDir, { recursive: true });
      mkdirSync(cwd, { recursive: true });
      // Keep Pi's own asset/package lookup rooted at the repo while loading the neutral package
      // as an installed package through SettingsManager below.
      process.env.PI_PACKAGE_DIR = repoRoot;
      process.env.PI_SKIP_VERSION_CHECK = '1';

      const { DefaultResourceLoader, SettingsManager } = await import('@mariozechner/pi-coding-agent');

      await assembleNeutralPiPackage({ repoRoot, outputDir: packageDir });

      const resourceLoader = new DefaultResourceLoader({
        cwd,
        agentDir,
        settingsManager: SettingsManager.inMemory({ packages: [packageDir] }),
        noContextFiles: true,
      });

      await resourceLoader.reload();

      const extensionResult = resourceLoader.getExtensions();
      const loadedExtensionPaths = extensionResult.extensions.map((extension) => extension.resolvedPath);
      const flags = extensionResult.extensions.flatMap((extension) => [...extension.flags.keys()]);
      const handlers = extensionResult.extensions.flatMap((extension) => [...extension.handlers.keys()]);
      const tools = extensionResult.extensions.flatMap((extension) => [...extension.tools.keys()]);
      const skillNames = resourceLoader.getSkills().skills.map((skill) => skill.name);
      const promptNames = resourceLoader.getPrompts().prompts.map((prompt) => prompt.name);

      expect(extensionResult.errors).toEqual([]);
      expect(loadedExtensionPaths).toEqual(
        expect.arrayContaining([
          join(packageDir, 'extensions', 'capabilities.ts'),
          join(packageDir, 'extensions', 'shell-relay', 'src', 'index.ts'),
          join(packageDir, 'extensions', 'web-fetch', 'src', 'index.ts'),
          join(packageDir, 'extensions', 'autotoon', 'autotoon.ts'),
        ]),
      );
      expect(loadedExtensionPaths.some((path) => path.endsWith('/extensions/system.ts'))).toBe(false);
      expect(loadedExtensionPaths.some((path) => path.includes('/extensions/system/extension-factories.ts'))).toBe(
        false,
      );
      expect(flags).not.toContain('migrate-pi-configs');
      expect(flags).not.toContain('install-shell-integrations');
      expect(handlers).not.toContain('before_agent_start');
      expect(tools).toEqual(
        expect.arrayContaining(['start_background_process', 'check_background_process', 'shell_relay', 'web_fetch']),
      );
      expect(skillNames).toEqual(expect.arrayContaining(['tasks', 'standup']));
      expect(promptNames).toEqual(expect.arrayContaining(['new-feature', 'code-review']));
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

      rmSync(tempRoot, { recursive: true, force: true });
    }
  }, 15_000);
});
