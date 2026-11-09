import { describe, expect, it, vi } from 'vitest';
import { detectVersionControl } from './version-control.js';

describe('detectVersionControl', () => {
  it('detects colocated jj before git', () => {
    const fileExists = vi.fn((path: string) => path === '/repo/.jj' || path === '/repo/.git');
    const runCommand = vi.fn(() => 'Workspace is currently colocated with Git.');

    expect(detectVersionControl('/repo/subdir', { fileExists, runCommand })).toEqual({
      system: 'jj',
      colocatedGit: true,
      detection: 'session_start',
    });
    expect(runCommand).toHaveBeenCalledWith('jj', ['git', 'colocation', 'status'], '/repo');
  });

  it('detects non-colocated jj from jj status output', () => {
    const fileExists = vi.fn((path: string) => path === '/repo/.jj' || path === '/repo/.git');
    const runCommand = vi.fn(() => 'Workspace is not currently colocated with Git.');

    expect(detectVersionControl('/repo/subdir', { fileExists, runCommand })).toEqual({
      system: 'jj',
      colocatedGit: false,
      detection: 'session_start',
    });
  });

  it('detects git when jj is absent', () => {
    const fileExists = vi.fn((path: string) => path === '/repo/.git');

    expect(detectVersionControl('/repo/subdir', { fileExists })).toEqual({
      system: 'git',
      detection: 'session_start',
    });
  });

  it('reports none when no VCS marker exists', () => {
    const runCommand = vi.fn(() => '');

    expect(detectVersionControl('/repo', { fileExists: vi.fn(() => false), runCommand })).toEqual({
      system: 'none',
      detection: 'session_start',
    });
    expect(runCommand).not.toHaveBeenCalled();
  });

  it.each(['.hg', '.svn', '.fslckout', '_FOSSIL_'])('does not detect %s workspaces', (marker) => {
    const fileExists = vi.fn((path: string) => path === `/repo/${marker}`);
    const runCommand = vi.fn(() => '');

    expect(detectVersionControl('/repo/subdir', { fileExists, runCommand })).toEqual({
      system: 'none',
      detection: 'session_start',
    });
    expect(runCommand).not.toHaveBeenCalled();
  });
});
