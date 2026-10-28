import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI, ExtensionFactory, InlineExtension } from '@earendil-works/pi-coding-agent';
import autotoonExtension from '../../extensions/autotoon/autotoon.js';
import chorusExtension from '../../extensions/chorus.js';
// import shellRelayExtension from '../../extensions/shell-relay/src/index.js';
import {
  createBackgroundProcessExtension,
  createContextManagementExtension,
  createSandpiperIdentityExtension,
  createSkillLoadingExtension,
  createTurnControlExtension,
  type SandpiperIdentityExtensionOptions,
} from '../../extensions/system/extension-factories.js';
import tattlerExtension from '../../extensions/tattler/index.js';
import webFetchExtension from '../../extensions/web-fetch/src/index.js';
import webSearchExtension from '../../extensions/web-search/src/index.js';
import { temporaryTrailSkillPaths } from './temporary_trail_skill.js';

export interface SandpiperResourcePaths {
  readonly skillPaths: readonly string[];
  readonly promptPaths: readonly string[];
  readonly themePaths: readonly string[];
}

function inlineExtension(name: string, factory: ExtensionFactory): InlineExtension {
  return { name, factory };
}

export function resolveSandpiperResourcePaths(resourceRoot: string): SandpiperResourcePaths {
  const skillDir = join(resourceRoot, 'skills');
  const promptDir = join(resourceRoot, 'prompts');
  return {
    skillPaths: existsSync(skillDir) ? [skillDir] : [],
    promptPaths: existsSync(promptDir) ? [promptDir] : [],
    themePaths: [join(resourceRoot, 'themes')],
  };
}

function createSandpiperResourceExtension(resourcePaths: SandpiperResourcePaths): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    pi.on('resources_discover', () => ({
      skillPaths: [...resourcePaths.skillPaths, ...temporaryTrailSkillPaths()],
      promptPaths: [...resourcePaths.promptPaths],
      themePaths: [...resourcePaths.themePaths],
    }));
  };
}

export function createNeutralCapabilityExtensionFactories(resourceRoot: string): readonly InlineExtension[] {
  return [
    inlineExtension('skill-loading', createSkillLoadingExtension()),
    inlineExtension('turn-control', createTurnControlExtension()),
    inlineExtension('context-management', createContextManagementExtension()),
    inlineExtension('background-process', createBackgroundProcessExtension()),
    // shellRelayExtension,
    inlineExtension('web-fetch', webFetchExtension),
    inlineExtension('web-search', webSearchExtension),
    inlineExtension('autotoon', autotoonExtension),
    inlineExtension('tattler', tattlerExtension),
    inlineExtension('chorus', chorusExtension),
    inlineExtension(
      'sandpiper-resources',
      createSandpiperResourceExtension(resolveSandpiperResourcePaths(resourceRoot)),
    ),
  ];
}

function createSandpiperIdentityExtensionFactories(
  options: SandpiperIdentityExtensionOptions = {},
): readonly InlineExtension[] {
  return [inlineExtension('sandpiper-core', createSandpiperIdentityExtension(options))];
}

export function createSandpiperExtensionFactories(
  resourceRoot: string,
  identityOptions: SandpiperIdentityExtensionOptions = {},
): InlineExtension[] {
  return [
    ...createSandpiperIdentityExtensionFactories(identityOptions),
    ...createNeutralCapabilityExtensionFactories(resourceRoot),
  ];
}
