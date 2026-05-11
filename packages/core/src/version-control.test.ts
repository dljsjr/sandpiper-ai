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

  it.each([
    ['.hg', 'hg'],
    ['.svn', 'svn'],
    ['.fslckout', 'fossil'],
    ['_FOSSIL_', 'fossil'],
  ] as const)('detects %s workspaces', (marker, system) => {
    const fileExists = vi.fn((path: string) => path === `/repo/${marker}`);

    expect(detectVersionControl('/repo/subdir', { fileExists })).toEqual({
      system,
      detection: 'session_start',
    });
  });

  it('detects perforce workspaces with p4 info', () => {
    const fileExists = vi.fn(() => false);
    const runCommand = vi.fn(() => 'Client root: /repo');

    expect(detectVersionControl('/repo/subdir', { fileExists, runCommand })).toEqual({
      system: 'perforce',
      detection: 'session_start',
    });
    expect(runCommand).toHaveBeenCalledWith('p4', ['info'], '/repo/subdir');
  });

  it('reports none when no VCS marker exists', () => {
    expect(
      detectVersionControl('/repo', {
        fileExists: vi.fn(() => false),
        runCommand: vi.fn(() => {
          throw new Error('no perforce workspace');
        }),
      }),
    ).toEqual({
      system: 'none',
      detection: 'session_start',
    });
  });
});
