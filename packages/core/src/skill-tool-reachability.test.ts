import { describe, expect, it } from 'vitest';
import { type SkillToolReachabilityInput, skillToolReachability } from './skill-tool-reachability.js';

describe('skillToolReachability', () => {
  it.each<[string, SkillToolReachabilityInput, ReturnType<typeof skillToolReachability>]>([
    ['declared', { selectedTools: ['read', 'skill'], skillToolExposure: 'direct' }, 'declared'],
    ['declared without a known exposure', { selectedTools: ['skill'] }, 'declared'],
    ['declared as model-only', { selectedTools: ['skill'], skillToolExposure: 'model-only' }, 'declared'],
    [
      'hidden behind codemode',
      { selectedTools: ['read', 'skill'], hiddenTools: ['skill'], skillToolExposure: 'direct' },
      undefined,
    ],
    [
      'deferred with tool_search declared',
      { selectedTools: ['read', 'tool_search'], skillToolExposure: 'deferred' },
      'deferred',
    ],
    [
      'deferred and already loaded, with tool_search declared',
      { selectedTools: ['read', 'tool_search', 'skill'], skillToolExposure: 'deferred' },
      'deferred',
    ],
    ['deferred without tool_search', { selectedTools: ['read'], skillToolExposure: 'deferred' }, undefined],
    [
      'deferred with tool_search hidden',
      { selectedTools: ['read', 'tool_search'], hiddenTools: ['tool_search'], skillToolExposure: 'deferred' },
      undefined,
    ],
    [
      'deferred and loaded without tool_search',
      { selectedTools: ['read', 'skill'], skillToolExposure: 'deferred' },
      'declared',
    ],
    ['codemode exposure', { selectedTools: ['read', 'tool_search'], skillToolExposure: 'codemode' }, undefined],
    ['not selected', { selectedTools: ['read', 'bash'], skillToolExposure: 'direct' }, undefined],
    ['absent', { selectedTools: ['read', 'bash', 'tool_search'] }, undefined],
    ['no tools', {}, undefined],
  ])('%s', (_label, input, expected) => {
    expect(skillToolReachability(input)).toBe(expected);
  });
});
