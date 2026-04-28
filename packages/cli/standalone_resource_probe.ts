#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, ExtensionFactory } from '@mariozechner/pi-coding-agent';
import { findPackageRoot } from './standalone_bootstrap.js';

const EXPECTED_SKILL_NAME = 'standalone-spike';

function resolvePackageDir(repoRoot: string): string {
  const override = process.env.SANDPIPER_SPIKE_PACKAGE_DIR;
  if (override !== undefined && override.length > 0) {
    return resolve(override);
  }
  return repoRoot;
}

function createResourceDiscoveryExtension(skillRoot: string): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    pi.on('resources_discover', () => ({
      skillPaths: [skillRoot],
    }));
  };
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.SANDPIPER_SPIKE_REPO_ROOT
  ? resolve(process.env.SANDPIPER_SPIKE_REPO_ROOT)
  : findPackageRoot(scriptDir, 'sandpiper-ai');
const packageDir = resolvePackageDir(repoRoot);
const skillRoot = join(repoRoot, 'packages', 'cli', 'fixtures', 'standalone-spike-skills');
const skillFile = join(skillRoot, EXPECTED_SKILL_NAME, 'SKILL.md');

if (!existsSync(skillFile)) {
  throw new Error(`Expected spike skill fixture to exist at ${skillFile}`);
}

process.env.PI_PACKAGE_DIR = packageDir;
process.env.PI_SKIP_VERSION_CHECK = '1';

const agentDir = await mkdtemp(join(tmpdir(), 'sandpiper-standalone-resource-probe-'));

try {
  const { DefaultResourceLoader, SessionManager, createAgentSession } = await import('@mariozechner/pi-coding-agent');
  const resourceLoader = new DefaultResourceLoader({
    cwd: repoRoot,
    agentDir,
    extensionFactories: [createResourceDiscoveryExtension(skillRoot)],
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
    if (!skillNames.includes(EXPECTED_SKILL_NAME)) {
      throw new Error(`Expected resource discovery to load ${EXPECTED_SKILL_NAME}; loaded: ${skillNames.join(', ')}`);
    }

    console.log(`Loaded skill via resources_discover: ${EXPECTED_SKILL_NAME}`);
  } finally {
    session.dispose();
  }
} finally {
  await rm(agentDir, { recursive: true, force: true });
}
