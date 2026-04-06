import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getXdgStateHome } from './paths.js';

describe('getXdgStateHome', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.XDG_STATE_HOME = process.env.XDG_STATE_HOME;
    delete process.env.XDG_STATE_HOME;
  });

  afterEach(() => {
    if (savedEnv.XDG_STATE_HOME === undefined) {
      delete process.env.XDG_STATE_HOME;
    } else {
      process.env.XDG_STATE_HOME = savedEnv.XDG_STATE_HOME;
    }
  });

  it('should return XDG_STATE_HOME when set', () => {
    process.env.XDG_STATE_HOME = '/custom/state';
    expect(getXdgStateHome()).toBe('/custom/state');
  });

  it('should fall back to ~/.local/state when XDG_STATE_HOME is not set', () => {
    expect(getXdgStateHome()).toMatch(/\/\.local\/state$/);
  });

  it('should expand ~ in XDG_STATE_HOME', () => {
    process.env.XDG_STATE_HOME = '~/my-state';
    expect(getXdgStateHome()).toMatch(/\/my-state$/);
  });
});
