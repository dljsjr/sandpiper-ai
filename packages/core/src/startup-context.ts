import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ProjectTrigger {
  readonly key: string;
  readonly whenToRead: string;
  readonly location: string;
}

export interface IndexedTask {
  readonly key: string;
  readonly project: string;
  readonly title: string;
  readonly status: string;
  readonly kind: string;
  readonly priority: string;
  readonly assignee: string;
}

export interface ActiveTaskContext {
  readonly inProgress: readonly IndexedTask[];
  readonly needsReview: readonly IndexedTask[];
  readonly backlog: readonly IndexedTask[];
}

export interface WorkingCopySummary {
  readonly paths: readonly string[];
  readonly omittedCount: number;
}

const priorityOrder = new Map([
  ['HIGH', 0],
  ['MEDIUM', 1],
  ['LOW', 2],
]);

function compareTasks(a: IndexedTask, b: IndexedTask): number {
  const priorityCmp = (priorityOrder.get(a.priority) ?? 99) - (priorityOrder.get(b.priority) ?? 99);
  if (priorityCmp !== 0) return priorityCmp;
  return a.key.localeCompare(b.key);
}

function extractFrontmatterField(content: string, field: string): string {
  const match = content.match(new RegExp(`^${field}:\\s*"?([^"\\n]*)"?`, 'm'));
  return match?.[1]?.trim() ?? '';
}

export function collectProjectTriggers(cwd: string): readonly ProjectTrigger[] {
  const tasksDir = join(cwd, '.sandpiper', 'tasks');
  if (!existsSync(tasksDir)) return [];

  const triggers: ProjectTrigger[] = [];
  for (const entry of readdirSync(tasksDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const projectMdPath = join(tasksDir, entry.name, 'PROJECT.md');
    if (!existsSync(projectMdPath)) continue;

    try {
      const content = readFileSync(projectMdPath, 'utf-8');
      const status = extractFrontmatterField(content, 'status');
      if (status === 'archived') continue;

      const key = extractFrontmatterField(content, 'key');
      const whenToRead = extractFrontmatterField(content, 'when_to_read');
      if (key && whenToRead) {
        triggers.push({
          key,
          whenToRead,
          location: `.sandpiper/tasks/${entry.name}/PROJECT.md`,
        });
      }
    } catch {
      // Skip unreadable files
    }
  }
  return triggers.sort((a, b) => a.key.localeCompare(b.key));
}

export function formatProjectTriggersForPrompt(triggers: readonly ProjectTrigger[]): string {
  if (triggers.length === 0) return '';

  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const lines = [
    '',
    'The following projects are registered in the local task tracker.',
    'Use the read tool to load a project file when the task matches its description.',
    '',
    '<available_projects>',
  ];
  for (const trigger of triggers) {
    lines.push('  <project>');
    lines.push(`    <key>${escapeXml(trigger.key)}</key>`);
    lines.push(`    <description>${escapeXml(trigger.whenToRead)}</description>`);
    lines.push(`    <location>${escapeXml(trigger.location)}</location>`);
    lines.push('  </project>');
  }
  lines.push('</available_projects>');
  return lines.join('\n');
}

interface MutableIndexedTask {
  key?: string;
  project?: string;
  title?: string;
  status?: string;
  kind?: string;
  priority?: string;
  assignee?: string;
}

function flushCurrentTask(current: MutableIndexedTask | null, tasks: IndexedTask[]): void {
  if (current?.key && current.title && current.status && current.priority && current.project && current.kind) {
    tasks.push({
      key: current.key,
      title: current.title,
      status: current.status,
      priority: current.priority,
      project: current.project,
      kind: current.kind,
      assignee: current.assignee ?? 'UNASSIGNED',
    });
  }
}

export function parseTaskIndex(content: string): readonly IndexedTask[] {
  const tasks: IndexedTask[] = [];
  let current: MutableIndexedTask | null = null;

  for (const line of content.split('\n')) {
    const taskHeader = line.match(/^ {2}"([^"]+)":$/);
    if (taskHeader) {
      flushCurrentTask(current, tasks);
      current = { key: taskHeader[1] };
      continue;
    }

    if (!current) continue;

    const fieldMatch = line.match(/^ {4}([A-Za-z]+):\s*(.*)$/);
    if (!fieldMatch) continue;

    const [, field, rawValue = ''] = fieldMatch;
    const value = rawValue.replace(/^"|"$/g, '');
    switch (field) {
      case 'key':
        current.key = value;
        break;
      case 'project':
        current.project = value;
        break;
      case 'title':
        current.title = value;
        break;
      case 'status':
        current.status = value;
        break;
      case 'kind':
        current.kind = value;
        break;
      case 'priority':
        current.priority = value;
        break;
      case 'assignee':
        current.assignee = value;
        break;
    }
  }

  flushCurrentTask(current, tasks);
  return tasks;
}

export function collectActiveTaskContext(cwd: string): ActiveTaskContext | undefined {
  const indexPath = join(cwd, '.sandpiper', 'tasks', 'index.toon');
  if (!existsSync(indexPath)) return undefined;

  const tasks = parseTaskIndex(readFileSync(indexPath, 'utf-8'));
  const topLevelTasks = tasks.filter((task) => task.kind !== 'SUBTASK');

  const inProgress = topLevelTasks.filter((task) => task.status === 'IN PROGRESS').sort(compareTasks);
  const needsReview = topLevelTasks.filter((task) => task.status === 'NEEDS REVIEW').sort(compareTasks);
  const backlog = topLevelTasks
    .filter((task) => task.status === 'NOT STARTED')
    .sort(compareTasks)
    .slice(0, 3);

  return { inProgress, needsReview, backlog };
}

function formatTask(task: IndexedTask): string {
  return `- ${task.key} [${task.priority}] ${task.title}`;
}

export function formatActiveTaskContextForPrompt(context: ActiveTaskContext | undefined): string {
  if (!context) return '';
  const { inProgress, needsReview, backlog } = context;
  if (inProgress.length === 0 && needsReview.length === 0 && backlog.length === 0) return '';

  const lines = [
    '',
    '# Active Task Context',
    'Use the tasks CLI for details and status changes; do not edit task files directly.',
  ];

  if (inProgress.length > 0) {
    lines.push('', '## In Progress');
    lines.push(...inProgress.map(formatTask));
  }
  if (needsReview.length > 0) {
    lines.push('', '## Needs Review');
    lines.push(...needsReview.map(formatTask));
  }
  if (backlog.length > 0) {
    lines.push('', '## Backlog Candidates');
    lines.push(...backlog.map(formatTask));
  }

  return lines.join('\n');
}

export function summarizeWorkingCopyPaths(diffSummary: string): WorkingCopySummary {
  const allPaths = diffSummary
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[A-Z]\s+/, ''));

  const meaningfulPaths = allPaths.filter((path) => !path.includes('/history/') && !path.includes('tasks/history/'));
  return {
    paths: meaningfulPaths.slice(0, 8),
    omittedCount: Math.max(0, meaningfulPaths.length - 8),
  };
}

export function collectWorkingCopySummary(cwd: string): WorkingCopySummary | undefined {
  try {
    const output = execFileSync('jj', ['diff', '--summary'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (output.length === 0) return undefined;

    const summary = summarizeWorkingCopyPaths(output);
    if (summary.paths.length === 0 && summary.omittedCount === 0) return undefined;
    return summary;
  } catch {
    return undefined;
  }
}

export function formatWorkingCopySummaryForPrompt(summary: WorkingCopySummary | undefined): string {
  if (!summary) return '';
  const lines = ['', '# Working Copy Context', 'Uncommitted changes are present in this repository.'];
  lines.push(...summary.paths.map((path) => `- ${path}`));
  if (summary.omittedCount > 0) {
    lines.push(`- ...and ${summary.omittedCount} more changed paths`);
  }
  lines.push('- Ignore pure task-history churn unless it is directly relevant.');
  return lines.join('\n');
}
