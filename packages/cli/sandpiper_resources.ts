import type { ExtensionAPI, ExtensionFactory, InlineExtension } from '@earendil-works/pi-coding-agent';
import autotoonExtension from '../../extensions/autotoon/autotoon.js';
import chorusExtension from '../../extensions/chorus.js';
import {
  createBackgroundProcessExtension,
  createClockExtension,
  createContextManagementExtension,
  createSandpiperIdentityExtension,
  createSkillLoadingExtension,
  createTurnControlExtension,
  type SandpiperIdentityExtensionOptions,
} from '../../extensions/system/extension-factories.js';
import tattlerExtension from '../../extensions/tattler/index.js';
import webFetchExtension from '../../extensions/web-fetch/src/index.js';
import {
  lightpandaRendererExtension,
  obscuraRendererExtension,
} from '../../extensions/web-fetch/src/renderer-extensions.js';
import webSearchExtension from '../../extensions/web-search/src/index.js';
import { temporaryTrailSkillPaths } from './temporary_trail_skill.js';

function inlineExtension(name: string, factory: ExtensionFactory): InlineExtension {
  return { name, factory };
}

function createSandpiperResourceExtension(): ExtensionFactory {
  return (pi: ExtensionAPI) => {
    pi.on('resources_discover', () => ({ skillPaths: temporaryTrailSkillPaths() }));
  };
}

export function createNeutralCapabilityExtensionFactories(): readonly InlineExtension[] {
  return [
    inlineExtension('skill-loading', createSkillLoadingExtension()),
    inlineExtension('turn-control', createTurnControlExtension()),
    inlineExtension('context-management', createContextManagementExtension()),
    inlineExtension('clock', createClockExtension()),
    inlineExtension('background-process', createBackgroundProcessExtension()),
    inlineExtension('web-fetch', webFetchExtension),
    inlineExtension('web-fetch-lightpanda', lightpandaRendererExtension),
    inlineExtension('web-fetch-obscura', obscuraRendererExtension),
    inlineExtension('web-search', webSearchExtension),
    inlineExtension('autotoon', autotoonExtension),
    inlineExtension('tattler', tattlerExtension),
    inlineExtension('chorus', chorusExtension),
    inlineExtension('sandpiper-resources', createSandpiperResourceExtension()),
  ];
}

function createSandpiperIdentityExtensionFactories(
  options: SandpiperIdentityExtensionOptions = {},
): readonly InlineExtension[] {
  return [inlineExtension('sandpiper-core', createSandpiperIdentityExtension(options))];
}

export function createSandpiperExtensionFactories(
  identityOptions: SandpiperIdentityExtensionOptions = {},
): InlineExtension[] {
  return [
    ...createSandpiperIdentityExtensionFactories(identityOptions),
    ...createNeutralCapabilityExtensionFactories(),
  ];
}
