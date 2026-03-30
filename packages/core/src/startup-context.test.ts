import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectActiveTaskContext,
  collectProjectTriggers,
  formatActiveTaskContextForPrompt,
  formatProjectTriggersForPrompt,
  formatWorkingCopySummaryForPrompt,
  parseTaskIndex,
  summarizeWorkingCopyPaths,
} from './startup-context.js';

describe('startup-context', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempProject(): string {
    const dir = mkdtempSync(join(tmpdir(), 'startup-context-'));
    tempDirs.push(dir);
    mkdirSync(join(dir, '.sandpiper', 'tasks'), { recursive: true });
    return dir;
  }

  describe('collectProjectTriggers', () => {
    it('filters archived projects from prompt injection', () => {
      const dir = createTempProject();
      mkdirSync(join(dir, '.sandpiper', 'tasks', 'AGENT'), { recursive: true });
      mkdirSync(join(dir, '.sandpiper', 'tasks', 'SRL'), { recursive: true });

      writeFileSync(
        join(dir, '.sandpiper', 'tasks', 'AGENT', 'PROJECT.md'),
        `---
key: AGENT
when_to_read: "Use for active agent work"
status: active
---
`,
      );
      writeFileSync(
        join(dir, '.sandpiper', 'tasks', 'SRL', 'PROJECT.md'),
        `---
key: SRL
when_to_read: "Inactive project"
status: archived
---
`,
      );

      const triggers = collectProjectTriggers(dir);
      expect(triggers).toEqual([
        {
          key: 'AGENT',
          whenToRead: 'Use for active agent work',
          location: '.sandpiper/tasks/AGENT/PROJECT.md',
        },
      ]);
    });

    it('formats project triggers as prompt XML', () => {
      const formatted = formatProjectTriggersForPrompt([
        {
          key: 'AGENT',
          whenToRead: 'Use for active agent work',
          location: '.sandpiper/tasks/AGENT/PROJECT.md',
        },
      ]);
      expect(formatted).toContain('<available_projects>');
      expect(formatted).toContain('<key>AGENT</key>');
      expect(formatted).not.toContain('SRL');
    });
  });

  describe('task context', () => {
    it('parses task index entries', () => {
      const tasks = parseTaskIndex(`version: 1
tasks:
  "AGENT-1":
    key: AGENT-1
    project: AGENT
    title: Example task
    status: IN PROGRESS
    kind: TASK
    priority: HIGH
    assignee: AGENT
`);

      expect(tasks).toEqual([
        {
          key: 'AGENT-1',
          project: 'AGENT',
          title: 'Example task',
          status: 'IN PROGRESS',
          kind: 'TASK',
          priority: 'HIGH',
          assignee: 'AGENT',
        },
      ]);
    });

    it('collects in-progress, review, and backlog tasks', () => {
      const dir = createTempProject();
      writeFileSync(
        join(dir, '.sandpiper', 'tasks', 'index.toon'),
        `version: 1
tasks:
  "AGENT-1":
    key: AGENT-1
    project: AGENT
    title: In progress task
    status: IN PROGRESS
    kind: TASK
    priority: HIGH
    assignee: AGENT
  "AGENT-2":
    key: AGENT-2
    project: AGENT
    title: Needs review task
    status: NEEDS REVIEW
    kind: TASK
    priority: MEDIUM
    assignee: AGENT
  "TOOLS-1":
    key: TOOLS-1
    project: TOOLS
    title: Backlog task
    status: NOT STARTED
    kind: TASK
    priority: HIGH
    assignee: UNASSIGNED
  "TOOLS-2":
    key: TOOLS-2
    project: TOOLS
    title: Lower priority backlog
    status: NOT STARTED
    kind: TASK
    priority: LOW
    assignee: UNASSIGNED
  "AGENT-3":
    key: AGENT-3
    project: AGENT
    title: Child subtask
    status: IN PROGRESS
    kind: SUBTASK
    priority: HIGH
    assignee: AGENT
`,
      );

      const context = collectActiveTaskContext(dir);
      expect(context).toBeDefined();
      expect(context?.inProgress.map((task) => task.key)).toEqual(['AGENT-1']);
      expect(context?.needsReview.map((task) => task.key)).toEqual(['AGENT-2']);
      expect(context?.backlog.map((task) => task.key)).toEqual(['TOOLS-1', 'TOOLS-2']);

      const formatted = formatActiveTaskContextForPrompt(context);
      expect(formatted).toContain('# Active Task Context');
      expect(formatted).toContain('AGENT-1 [HIGH] In progress task');
      expect(formatted).toContain('AGENT-2 [MEDIUM] Needs review task');
      expect(formatted).toContain('TOOLS-1 [HIGH] Backlog task');
      expect(formatted).not.toContain('AGENT-3');
    });
  });

  describe('working copy summaries', () => {
    it('filters noisy task history paths from dirty working copy summaries', () => {
      const summary = summarizeWorkingCopyPaths(`M AGENTS.md
A .sandpiper/tasks/history/AGENT-1/123.diff
M .sandpiper/docs/build-system.md
`);

      expect(summary.paths).toEqual(['AGENTS.md', '.sandpiper/docs/build-system.md']);
      expect(summary.omittedCount).toBe(0);
    });

    it('formats working copy prompt text', () => {
      const formatted = formatWorkingCopySummaryForPrompt({
        paths: ['AGENTS.md', '.sandpiper/docs/build-system.md'],
        omittedCount: 2,
      });

      expect(formatted).toContain('# Working Copy Context');
      expect(formatted).toContain('AGENTS.md');
      expect(formatted).toContain('...and 2 more changed paths');
    });
  });
});
