import { join } from 'node:path';
import type { ExtensionAPI, ExtensionFactory } from '@mariozechner/pi-coding-agent';
import autotoonExtension from '../../extensions/autotoon/autotoon.js';
import shellRelayExtension from '../../extensions/shell-relay/src/index.js';
import {
  createNeutralCapabilityExtension,
  createSandpiperIdentityExtension,
} from '../../extensions/system/extension-factories.js';
import webFetchExtension from '../../extensions/web-fetch/src/index.js';

export interface SandpiperResourcePaths {
  readonly skillPaths: readonly string[];
  readonly promptPaths: readonly string[];
  readonly themePaths: readonly string[];
}

export function resolveSandpiperResourcePaths(resourceRoot: string): SandpiperResourcePaths {
  return {
    skillPaths: [join(resourceRoot, 'skills', 'sandpiper'), join(resourceRoot, 'skills', 'third-party')],
    promptPaths: [join(resourceRoot, 'prompts')],
    themePaths: [join(resourceRoot, 'themes')],
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
