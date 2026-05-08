import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI, ExtensionFactory } from '@earendil-works/pi-coding-agent';
import shellRelayExtension from '../../extensions/shell-relay/src/index.js';
import {
  createNeutralCapabilityExtension,
  createSandpiperIdentityExtension,
} from '../../extensions/system/extension-factories.js';
import webFetchExtension from '../../extensions/web-fetch/src/index.js';
import autotoonExtension from '../capability-autotoon/src/pi-extension.js';

export interface SandpiperResourcePaths {
  readonly skillPaths: readonly string[];
  readonly promptPaths: readonly string[];
  readonly themePaths: readonly string[];
}

function resolveResourceTypeRoot(resourceRoot: string, resourceType: 'skills' | 'prompts' | 'themes'): string {
  const packagedRoot = join(resourceRoot, resourceType);
  return existsSync(packagedRoot) ? packagedRoot : join(resourceRoot, 'packages', 'resources', resourceType);
}

export function resolveSandpiperResourcePaths(resourceRoot: string): SandpiperResourcePaths {
  const skillsRoot = resolveResourceTypeRoot(resourceRoot, 'skills');
  const promptsRoot = resolveResourceTypeRoot(resourceRoot, 'prompts');
  const themesRoot = resolveResourceTypeRoot(resourceRoot, 'themes');

  return {
    skillPaths: [join(skillsRoot, 'sandpiper'), join(skillsRoot, 'third-party')],
    promptPaths: [promptsRoot],
    themePaths: [themesRoot],
  };
}

export function createSandpiperResourceExtension(resourcePaths: SandpiperResourcePaths): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    pi.on('resources_discover', () => ({
      skillPaths: [...resourcePaths.skillPaths],
      promptPaths: [...resourcePaths.promptPaths],
      themePaths: [...resourcePaths.themePaths],
    }));
  };
}

export function createNeutralCapabilityExtensionFactories(resourceRoot: string): readonly ExtensionFactory[] {
  return [
    createNeutralCapabilityExtension(),
    shellRelayExtension,
    webFetchExtension,
    autotoonExtension,
    createSandpiperResourceExtension(resolveSandpiperResourcePaths(resourceRoot)),
  ];
}

export function createSandpiperIdentityExtensionFactories(): readonly ExtensionFactory[] {
  return [createSandpiperIdentityExtension()];
}

export function createSandpiperExtensionFactories(resourceRoot: string): ExtensionFactory[] {
  return [...createSandpiperIdentityExtensionFactories(), ...createNeutralCapabilityExtensionFactories(resourceRoot)];
}
