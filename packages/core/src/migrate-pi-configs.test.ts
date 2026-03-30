import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getNewSandpiperAgentDir, getOldPiAgentDir } from './migrate-pi-configs.js';

describe('migrate-pi-configs path resolution', () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = ['SANDPIPER_CODING_AGENT_DIR', 'PI_CODING_AGENT_DIR', '__PI_CODING_AGENT_DIR_ORIGINAL'] as const;

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('prefers SANDPIPER_CODING_AGENT_DIR over PI_CODING_AGENT_DIR for the current agent dir', () => {
    process.env.SANDPIPER_CODING_AGENT_DIR = '/sandpiper/agent';
    process.env.PI_CODING_AGENT_DIR = '/pi/agent';

    expect(getNewSandpiperAgentDir()).toBe('/sandpiper/agent');
  });

  it('falls back to PI_CODING_AGENT_DIR when SANDPIPER_CODING_AGENT_DIR is unset', () => {
    process.env.PI_CODING_AGENT_DIR = '/pi/agent';

    expect(getNewSandpiperAgentDir()).toBe('/pi/agent');
  });

  it('expands tilde in the current agent dir override', () => {
    process.env.SANDPIPER_CODING_AGENT_DIR = '~/custom-agent';

    expect(getNewSandpiperAgentDir()).toMatch(/\/custom-agent$/);
    expect(getNewSandpiperAgentDir()).not.toContain('~');
  });

  it('expands tilde in the original pi agent dir override', () => {
    process.env.__PI_CODING_AGENT_DIR_ORIGINAL = '~/legacy-pi-agent';

    expect(getOldPiAgentDir()).toMatch(/\/legacy-pi-agent$/);
    expect(getOldPiAgentDir()).not.toContain('~');
  });
});
