import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSandpiperResourcePaths } from './sandpiper_resources.js';

describe('Sandpiper resource adapter', () => {
  it('maps the current repository resource roots explicitly', () => {
    const paths = resolveSandpiperResourcePaths('/repo');

    expect(paths.skillPaths).toEqual([join('/repo', 'skills', 'sandpiper'), join('/repo', 'skills', 'third-party')]);
    expect(paths.promptPaths).toEqual([join('/repo', 'prompts')]);
    expect(paths.themePaths).toEqual([join('/repo', 'themes')]);
  });
});
