import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { decode as decodeToon } from '@toon-format/toon';
import { appendActivityEntry, type FieldChange } from './activity-log.js';
import { extractDescription, replaceDescription } from './description.js';
import { parseFrontmatter } from './frontmatter.js';
import { writeDiff } from './history.js';
import { PROJECT_KEY_RE, scanHighestNumber } from './patterns.js';
import type { TaskAssignee, TaskKind, TaskPriority, TaskReporter, TaskResolution, TaskStatus } from './types.js';

/**
 * Render a task file's content (frontmatter + body) without writing to disk.
 */
export function renderTaskContent(opts: CreateTaskOptions): string {
  const ts = new Date().toISOString();
  const fmLines: string[] = [
    `title: "${opts.title}"`,
    'status: NOT STARTED',
    `kind: ${opts.kind}`,
    `priority: ${opts.priority}`,
    'assignee: UNASSIGNED',
    `reporter: ${opts.reporter}`,
    `created_at: ${ts}`,
    `updated_at: ${ts}`,
  ];

  if (opts.dependsOn?.length) {
    fmLines.push('depends_on:');
    for (const dep of opts.dependsOn) fmLines.push(`  - ${dep}`);
  }
  if (opts.blockedBy?.length) {
    fmLines.push('blocked_by:');
    for (const b of opts.blockedBy) fmLines.push(`  - ${b}`);
  }
  if (opts.related?.length) {
    fmLines.push('related:');
    for (const r of opts.related) fmLines.push(`  - ${r}`);
  }

  return `---\n${fmLines.join('\n')}\n---\n\n# ${opts.title}\n\n`;
}

// ─── Project Operations ──────────────────────────────────────────

export function createProject(tasksDir: string, projectKey: string): void {
  if (!PROJECT_KEY_RE.test(projectKey)) {
    throw new Error(`Invalid project key: "${projectKey}". Must be exactly 3 uppercase ASCII letters.`);
  }

  const projectDir = join(tasksDir, projectKey);
  if (existsSync(projectDir)) {
    throw new Error(`Project "${projectKey}" already exists at ${projectDir}`);
  }

  mkdirSync(projectDir, { recursive: true });
}

// ─── Task Creation ───────────────────────────────────────────────

export interface CreateTaskOptions {
  readonly project: string;
  readonly kind: TaskKind;
  readonly priority: TaskPriority;
  readonly title: string;
  readonly reporter: TaskReporter;
  readonly parent?: string;
  readonly dependsOn?: readonly string[];
  readonly blockedBy?: readonly string[];
  readonly related?: readonly string[];
}

export interface CreateTaskResult {
  readonly key: string;
  readonly path: string;
}

export function createTask(tasksDir: string, opts: CreateTaskOptions): CreateTaskResult {
  if (opts.kind === 'SUBTASK' && !opts.parent) {
    throw new Error('SUBTASK requires a parent key.');
  }

  // Ensure project directory exists
  const projectDir = join(tasksDir, opts.project);
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  // Get next task number from index, or scan files as fallback
  const taskNum = getNextTaskNumber(tasksDir, opts.project);
  const key = `${opts.project}-${taskNum}`;

  // Determine file path
  let taskPath: string;
  if (opts.parent) {
    const subtaskDir = join(projectDir, opts.parent);
    mkdirSync(subtaskDir, { recursive: true });
    taskPath = join(subtaskDir, `${key}.md`);
  } else {
    taskPath = join(projectDir, `${key}.md`);
  }

  const content = renderTaskContent(opts);
  writeFileSync(taskPath, content);

  return { key, path: taskPath };
}

/**
 * Get the next task number for a project.
 * Checks index counter, legacy .meta.yml, and file scan.
 */
function getNextTaskNumber(tasksDir: string, projectKey: string): number {
  // Try reading from index
  const indexPath = join(tasksDir, 'index.toon');
  if (existsSync(indexPath)) {
    try {
      const raw = decodeToon(readFileSync(indexPath, 'utf-8')) as Record<string, unknown>;
      const counters = raw.counters as Record<string, { nextTaskNumber: number }> | undefined;
      if (counters?.[projectKey]?.nextTaskNumber) {
        return counters[projectKey]?.nextTaskNumber;
      }
    } catch {
      // Fall through to scan
    }
  }

  // Try reading from legacy .meta.yml
  const metaPath = join(tasksDir, projectKey, '.meta.yml');
  if (existsSync(metaPath)) {
    const meta = readFileSync(metaPath, 'utf-8');
    const numMatch = meta.match(/next_task_number:\s*(\d+)/);
    if (numMatch) {
      // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by match
      return Number.parseInt(numMatch[1]!, 10);
    }
  }

  // Last resort: scan files
  return scanHighestNumber(tasksDir, projectKey) + 1;
}

/**
 * Walk up from a task file path to find the tasks root directory.
 * The tasks root is the parent of the project directory (3-letter uppercase name).
 */
function resolveTasksRoot(taskPath: string): string | null {
  let dir = dirname(taskPath);
  for (let i = 0; i < 3; i++) {
    const parent = dirname(dir);
    const dirName = basename(dir);
    if (/^[A-Z]{3}$/.test(dirName)) {
      return parent;
    }
    dir = parent;
  }
  return null;
}

// ─── Task Field Updates ──────────────────────────────────────────

export interface UpdateFields {
  readonly status?: TaskStatus;
  readonly assignee?: TaskAssignee;
  readonly priority?: TaskPriority;
  readonly resolution?: TaskResolution;
  readonly title?: string;
  readonly reporter?: TaskReporter;
  readonly dependsOn?: readonly string[];
  readonly blockedBy?: readonly string[];
  readonly related?: readonly string[];
  /** Replace the task body/description (markdown content after heading). */
  readonly description?: string;
}

/**
 * Apply field updates to a task file's content string (in memory).
 * Returns the modified content without writing to disk.
 */
export function applyFieldUpdates(content: string, fields: UpdateFields): string {
  let result = content;

  if (fields.status !== undefined) {
    result = result.replace(/^status: .+$/m, `status: ${fields.status}`);
  }
  if (fields.assignee !== undefined) {
    result = result.replace(/^assignee: .+$/m, `assignee: ${fields.assignee}`);
  }
  if (fields.priority !== undefined) {
    result = result.replace(/^priority: .+$/m, `priority: ${fields.priority}`);
  }
  // kind is used internally by move operations, not exposed on task update CLI
  const kind = (fields as Record<string, unknown>).kind as string | undefined;
  if (kind !== undefined) {
    result = result.replace(/^kind: .+$/m, `kind: ${kind}`);
  }
  if (fields.resolution !== undefined) {
    if (/^resolution: /m.test(result)) {
      result = result.replace(/^resolution: .+$/m, `resolution: ${fields.resolution}`);
    } else {
      result = result.replace(/^(status: .+)$/m, `$1\nresolution: ${fields.resolution}`);
    }
  }
  if (fields.title !== undefined) {
    result = result.replace(/^title: .+$/m, `title: "${fields.title}"`);
    // Also update the H1 heading in the body
    result = result.replace(/^# .+$/m, `# ${fields.title}`);
  }
  if (fields.reporter !== undefined) {
    result = result.replace(/^reporter: .+$/m, `reporter: ${fields.reporter}`);
  }
  if (fields.dependsOn !== undefined) {
    result = replaceArrayField(result, 'depends_on', fields.dependsOn);
  }
  if (fields.blockedBy !== undefined) {
    result = replaceArrayField(result, 'blocked_by', fields.blockedBy);
  }
  if (fields.related !== undefined) {
    result = replaceArrayField(result, 'related', fields.related);
  }

  const ts = new Date().toISOString();
  result = result.replace(/^updated_at: .+$/m, `updated_at: ${ts}`);

  return result;
}

/**
 * Replace or insert an array field in frontmatter content.
 */
function replaceArrayField(content: string, fieldName: string, values: readonly string[]): string {
  // Remove existing field (key line + any indented array items)
  const existingPattern = new RegExp(`^${fieldName}:.*(?:\\n  - .+)*`, 'm');
  let result = content.replace(existingPattern, '').replace(/\n{3,}/g, '\n\n');

  if (values.length === 0) {
    return result;
  }

  // Insert before the closing --- of frontmatter
  const arrayLines = values.map((v) => `  - ${v}`).join('\n');
  const insertion = `${fieldName}:\n${arrayLines}`;

  // Insert before updated_at (which is always the last field before ---)
  result = result.replace(/^(updated_at: .+)$/m, `${insertion}\n$1`);

  return result;
}

/**
 * Update fields on a task file on disk.
 * Validates that COMPLETE status requires a resolution.
 */
export function updateTaskFields(taskPath: string, fields: UpdateFields): void {
  if (fields.status === 'COMPLETE' && !fields.resolution) {
    throw new Error(
      'Setting status to COMPLETE requires a resolution. ' + 'Use resolution: DONE or resolution: WONTFIX.',
    );
  }

  const originalContent = readFileSync(taskPath, 'utf-8');
  const originalFm = parseFrontmatter(originalContent);

  let content = applyFieldUpdates(originalContent, fields);
  if (fields.description !== undefined) {
    content = replaceDescription(content, fields.description);
  }

  // Compute field changes for the activity log
  const changes = computeChanges(originalFm, fields, originalContent);
  const timestamp = new Date().toISOString();
  if (changes.length > 0) {
    content = appendActivityEntry(content, changes);
  }

  writeFileSync(taskPath, content);

  // Write diff to history
  if (originalContent !== content) {
    const tasksDir = resolveTasksRoot(taskPath);
    const key = basename(taskPath, '.md');
    if (tasksDir) {
      writeDiff(tasksDir, key, originalContent, content, timestamp);
    }
  }
}

/**
 * Compute the list of field changes for the activity log.
 */
function computeChanges(
  originalFm: Record<string, string | string[]>,
  fields: UpdateFields,
  originalContent: string,
): FieldChange[] {
  const changes: FieldChange[] = [];

  const simpleFields: Array<{ key: keyof UpdateFields; fmKey: string }> = [
    { key: 'status', fmKey: 'status' },
    { key: 'assignee', fmKey: 'assignee' },
    { key: 'priority', fmKey: 'priority' },
    { key: 'reporter', fmKey: 'reporter' },
    { key: 'title', fmKey: 'title' },
  ];

  for (const { key, fmKey } of simpleFields) {
    const newVal = fields[key] as string | undefined;
    if (newVal === undefined) continue;
    const oldVal = typeof originalFm[fmKey] === 'string' ? originalFm[fmKey] : undefined;
    if (oldVal !== newVal) {
      changes.push({
        field: fmKey,
        from: oldVal as string | undefined,
        to: newVal,
      });
    }
  }

  // Resolution (may not exist in original)
  if (fields.resolution !== undefined) {
    const oldRes = typeof originalFm.resolution === 'string' ? originalFm.resolution : undefined;
    if (oldRes !== fields.resolution) {
      changes.push({
        field: 'resolution',
        from: oldRes,
        to: fields.resolution,
      });
    }
  }

  // Description: log line count delta for a sense of magnitude
  if (fields.description !== undefined) {
    const oldDesc = extractDescription(originalContent).trim();
    const newDesc = fields.description.trim();
    const oldLines = oldDesc === '' ? 0 : oldDesc.split('\n').length;
    const newLines = newDesc === '' ? 0 : newDesc.split('\n').length;
    const pl = (n: number) => `${n} line${n !== 1 ? 's' : ''}`;

    if (oldLines === 0 && newLines > 0) {
      changes.push({
        field: 'description',
        from: undefined,
        to: `added (${pl(newLines)})`,
      });
    } else if (newLines === 0 && oldLines > 0) {
      changes.push({ field: 'description', from: pl(oldLines), to: 'cleared' });
    } else if (oldLines !== newLines) {
      changes.push({
        field: 'description',
        from: pl(oldLines),
        to: `updated (${pl(newLines)})`,
      });
    } else {
      changes.push({ field: 'description', from: undefined, to: 'updated' });
    }
  }

  // Array fields
  const arrayFields: Array<{ key: keyof UpdateFields; fmKey: string }> = [
    { key: 'dependsOn', fmKey: 'depends_on' },
    { key: 'blockedBy', fmKey: 'blocked_by' },
    { key: 'related', fmKey: 'related' },
  ];

  for (const { key, fmKey } of arrayFields) {
    const newVal = fields[key] as readonly string[] | undefined;
    if (newVal === undefined) continue;
    const oldVal = Array.isArray(originalFm[fmKey]) ? originalFm[fmKey] : [];
    const oldStr = (oldVal as string[]).join(', ') || '(none)';
    const newStr = newVal.join(', ') || '(none)';
    if (oldStr !== newStr) {
      changes.push({ field: fmKey, from: oldStr, to: newStr });
    }
  }

  return changes;
}

// ─── Convenience Mutations ───────────────────────────────────────

export function pickupTask(taskPath: string): void {
  updateTaskFields(taskPath, { status: 'IN PROGRESS', assignee: 'AGENT' });
}

export function completeTask(taskPath: string, final = false, resolution?: TaskResolution): void {
  if (final && !resolution) {
    throw new Error('Completing a task (final=true) requires a resolution: DONE or WONTFIX.');
  }
  updateTaskFields(taskPath, {
    status: final ? 'COMPLETE' : 'NEEDS REVIEW',
    ...(resolution ? { resolution } : {}),
  });
}
