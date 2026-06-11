import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { appendActivityEntry, type FieldChange } from './activity-log.js';
import { extractDescription, replaceDescription } from './description.js';
import {
  formatFrontmatterScalar,
  normalizeAssigneeInput,
  normalizeReporterInput,
  normalizeTitleInput,
  parseFrontmatter,
} from './frontmatter.js';
import { writeFileAtomic } from './fs.js';
import { writeDiff } from './history.js';
import { readProjectCounter } from './index-update.js';
import { PROJECT_KEY_RE, projectFromKey, scanHighestNumber, TASK_KEY_RE } from './patterns.js';
import type { TaskAssignee, TaskKind, TaskPriority, TaskReporter, TaskResolution, TaskStatus } from './types.js';

/**
 * Render a task file's content (frontmatter + body) without writing to disk.
 */
export function renderTaskContent(opts: CreateTaskOptions): string {
  const ts = new Date().toISOString();
  const title = normalizeTitleInput(opts.title);
  const reporter = normalizeReporterInput(opts.reporter);
  const fmLines: string[] = [
    `title: ${formatFrontmatterScalar(title)}`,
    'status: NOT STARTED',
    `kind: ${opts.kind}`,
    `priority: ${opts.priority}`,
    `assignee: ${formatFrontmatterScalar(normalizeAssigneeInput('UNASSIGNED'))}`,
    `reporter: ${formatFrontmatterScalar(reporter)}`,
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

  const description = opts.description !== undefined ? `${opts.description.replace(/\s*$/, '')}\n` : '';
  return `---\n${fmLines.join('\n')}\n---\n\n# ${title}\n\n${description}`;
}

// ─── Project Operations ──────────────────────────────────────────

export function createProject(tasksDir: string, projectKey: string): void {
  if (!PROJECT_KEY_RE.test(projectKey)) {
    throw new Error(`Invalid project key: "${projectKey}". Must be 2 or more uppercase ASCII letters.`);
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
  readonly description?: string;
}

export interface CreateTaskResult {
  readonly key: string;
  readonly path: string;
}

export function createTask(tasksDir: string, opts: CreateTaskOptions): CreateTaskResult {
  if (opts.kind === 'SUBTASK' && !opts.parent) {
    throw new Error('SUBTASK requires a parent key.');
  }
  if (opts.parent) {
    validateParentKey(opts.project, opts.parent);
  }
  const content = renderTaskContent(opts);

  // Ensure project directory exists
  const projectDir = join(tasksDir, opts.project);
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }

  if (opts.parent && !existsSync(join(projectDir, `${opts.parent}.md`))) {
    throw new Error(`Parent task not found: ${opts.parent}`);
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

  writeFileAtomic(taskPath, content);

  return { key, path: taskPath };
}

function validateParentKey(project: string, parent: string): void {
  if (!TASK_KEY_RE.test(parent)) {
    throw new Error(`Invalid parent task key: ${JSON.stringify(parent)}. Expected format like ${project}-1.`);
  }
  if (projectFromKey(parent) !== project) {
    throw new Error(`Parent task ${parent} is not in project ${project}.`);
  }
}

/**
 * Get the next task number for a project.
 *
 * Disk scan is the primary mechanism — always finds the true highest allocated
 * number from .md task files and .moved tombstones on disk.
 *
 * The index counter acts as a floor: if it is higher than the scan result
 * (e.g. because a task file was deleted), the index value is used to prevent
 * counter regression. The spec prohibits deletion, but this is defensive.
 */
function getNextTaskNumber(tasksDir: string, projectKey: string): number {
  const fromDisk = scanHighestNumber(tasksDir, projectKey) + 1;
  const fromIndex = readProjectCounter(tasksDir, projectKey);
  return fromIndex !== undefined && fromIndex > fromDisk ? fromIndex : fromDisk;
}

/**
 * Walk up from a task file path to find the tasks root directory.
 * The tasks root is the parent of the project directory (uppercase name, 2+ letters).
 */
function resolveTasksRoot(taskPath: string): string | null {
  let dir = dirname(taskPath);
  for (let i = 0; i < 3; i++) {
    const parent = dirname(dir);
    const dirName = basename(dir);
    if (/^[A-Z]{2,}$/.test(dirName)) {
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

export interface InternalUpdateFields extends UpdateFields {
  /** Internal-only: task kind is changed by move/reparent operations, not `task update`. */
  readonly kind?: TaskKind;
}

function normalizeUpdateFields(fields: UpdateFields): UpdateFields {
  return {
    ...fields,
    ...(fields.title !== undefined ? { title: normalizeTitleInput(fields.title) } : {}),
    ...(fields.assignee !== undefined ? { assignee: normalizeAssigneeInput(fields.assignee) } : {}),
    ...(fields.reporter !== undefined ? { reporter: normalizeReporterInput(fields.reporter) } : {}),
  };
}

function normalizeInternalUpdateFields(fields: InternalUpdateFields): InternalUpdateFields {
  return {
    ...normalizeUpdateFields(fields),
    ...(fields.kind !== undefined ? { kind: fields.kind } : {}),
  };
}

type ScalarUpdateKey = 'status' | 'assignee' | 'priority' | 'kind' | 'reporter';
type ScalarChangeKey = 'status' | 'assignee' | 'priority' | 'reporter' | 'title' | 'resolution';
type ArrayUpdateKey = 'dependsOn' | 'blockedBy' | 'related';

const FRONTMATTER_SCALAR_UPDATES: ReadonlyArray<{
  readonly key: ScalarUpdateKey;
  readonly fmKey: string;
  readonly format: (value: NonNullable<InternalUpdateFields[ScalarUpdateKey]>) => string;
}> = [
  { key: 'status', fmKey: 'status', format: (value) => value },
  { key: 'assignee', fmKey: 'assignee', format: formatFrontmatterScalar },
  { key: 'priority', fmKey: 'priority', format: (value) => value },
  { key: 'kind', fmKey: 'kind', format: (value) => value },
  { key: 'reporter', fmKey: 'reporter', format: formatFrontmatterScalar },
];

/**
 * Apply public task field updates to a task file's content string (in memory).
 * Returns the modified content without writing to disk.
 */
export function applyFieldUpdates(content: string, fields: UpdateFields): string {
  return applyInternalFieldUpdates(content, fields);
}

/**
 * Apply field updates that are only valid for core task-management internals.
 * This keeps `task update` from exposing kind changes while making move-related
 * kind mutations explicit and type-checked.
 */
export function applyInternalFieldUpdates(content: string, fields: InternalUpdateFields): string {
  const normalizedFields = normalizeInternalUpdateFields(fields);
  let result = applyScalarFieldUpdates(content, normalizedFields);
  result = applyResolutionUpdate(result, normalizedFields.resolution);
  result = applyTitleUpdate(result, normalizedFields.title);
  result = applyArrayFieldUpdates(result, normalizedFields);
  return touchUpdatedAt(result);
}

function applyScalarFieldUpdates(content: string, fields: InternalUpdateFields): string {
  let result = content;

  for (const { key, fmKey, format } of FRONTMATTER_SCALAR_UPDATES) {
    const value = fields[key];
    if (value !== undefined) {
      result = replaceScalarField(result, fmKey, format(value));
    }
  }

  return result;
}

function applyResolutionUpdate(content: string, resolution: TaskResolution | undefined): string {
  if (resolution === undefined) {
    return content;
  }
  if (/^resolution: /m.test(content)) {
    return replaceScalarField(content, 'resolution', resolution);
  }
  return content.replace(/^(status: .+)$/m, `$1\nresolution: ${resolution}`);
}

function applyTitleUpdate(content: string, title: string | undefined): string {
  if (title === undefined) {
    return content;
  }

  return replaceScalarField(content, 'title', formatFrontmatterScalar(title)).replace(/^# .+$/m, `# ${title}`);
}

function applyArrayFieldUpdates(content: string, fields: InternalUpdateFields): string {
  let result = content;

  for (const { key, fmKey } of ARRAY_FIELD_MAPPINGS) {
    const value = fields[key];
    if (value !== undefined) {
      result = replaceArrayField(result, fmKey, value);
    }
  }

  return result;
}

function replaceScalarField(content: string, fieldName: string, value: string): string {
  return content.replace(new RegExp(`^${fieldName}: .+$`, 'm'), `${fieldName}: ${value}`);
}

function touchUpdatedAt(content: string): string {
  const ts = new Date().toISOString();
  return replaceScalarField(content, 'updated_at', ts);
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
 * Write a task file to disk with full audit trail: activity log entry + history diff.
 *
 * This is the single audited write path for task content changes.
 * All mutations that modify task file content should route through here
 * to ensure the activity log and diff history are consistently maintained.
 *
 * @param taskPath - Absolute path to the task file
 * @param tasksDir - Root tasks directory (e.g., .sandpiper/tasks/)
 * @param originalContent - File content before the change
 * @param newContent - File content after the change (before activity log append)
 * @param changes - Field changes to record in the activity log
 */
export interface AuditedWriteOptions {
  /** Absolute path to the task file. */
  readonly taskPath: string;
  /** Root tasks directory (e.g., .sandpiper/tasks/). */
  readonly tasksDir: string;
  /** File content before the change. */
  readonly originalContent: string;
  /** File content after the change (before activity log append). */
  readonly newContent: string;
  /** Field changes to record in the activity log. Empty means no activity entry. */
  readonly changes: readonly FieldChange[];
  /**
   * Task key for the history directory. Defaults to basename(taskPath, '.md').
   * Move operations pass the old key so history lands under the pre-move identity.
   */
  readonly historyKey?: string;
}

export function writeTaskFileAuditably(opts: AuditedWriteOptions): void {
  const { taskPath, tasksDir, originalContent, newContent, changes, historyKey } = opts;

  if (originalContent === newContent && changes.length === 0) return;

  let content = newContent;
  const timestamp = new Date().toISOString();

  if (changes.length > 0) {
    content = appendActivityEntry(content, changes);
  }

  writeFileAtomic(taskPath, content);

  if (originalContent !== content) {
    const key = historyKey ?? basename(taskPath, '.md');
    writeDiff(tasksDir, key, originalContent, content, timestamp);
  }
}

/**
 * Update fields on a task file on disk.
 * Validates that COMPLETE status requires a resolution.
 */
export function updateTaskFields(taskPath: string, fields: UpdateFields): void {
  const normalizedFields = normalizeUpdateFields(fields);
  if (normalizedFields.status === 'COMPLETE' && !normalizedFields.resolution) {
    throw new Error(
      'Setting status to COMPLETE requires a resolution. ' + 'Use resolution: DONE or resolution: WONTFIX.',
    );
  }

  const originalContent = readFileSync(taskPath, 'utf-8');
  const originalFm = parseFrontmatter(originalContent);

  let content = applyFieldUpdates(originalContent, normalizedFields);
  if (normalizedFields.description !== undefined) {
    content = replaceDescription(content, normalizedFields.description);
  }

  const changes = computeChanges(originalFm, normalizedFields, originalContent);
  const tasksDir = resolveTasksRoot(taskPath);
  if (tasksDir) {
    writeTaskFileAuditably({
      taskPath,
      tasksDir,
      originalContent,
      newContent: content,
      changes,
    });
  } else {
    // Fallback: write without audit trail if tasks root cannot be resolved
    writeFileAtomic(taskPath, content);
  }
}

const SIMPLE_FIELD_MAPPINGS: ReadonlyArray<{ readonly key: ScalarChangeKey; readonly fmKey: string }> = [
  { key: 'status', fmKey: 'status' },
  { key: 'assignee', fmKey: 'assignee' },
  { key: 'priority', fmKey: 'priority' },
  { key: 'reporter', fmKey: 'reporter' },
  { key: 'title', fmKey: 'title' },
  { key: 'resolution', fmKey: 'resolution' },
];

const ARRAY_FIELD_MAPPINGS: ReadonlyArray<{ readonly key: ArrayUpdateKey; readonly fmKey: string }> = [
  { key: 'dependsOn', fmKey: 'depends_on' },
  { key: 'blockedBy', fmKey: 'blocked_by' },
  { key: 'related', fmKey: 'related' },
];

function formatScalarFieldChange(
  field: string,
  oldValue: string | undefined,
  newValue: string | undefined,
): FieldChange | undefined {
  if (newValue === undefined || oldValue === newValue) {
    return undefined;
  }
  return { field, from: oldValue, to: newValue };
}

function formatArrayFieldChange(
  field: string,
  oldValue: string[] | undefined,
  newValue: readonly string[] | undefined,
): FieldChange | undefined {
  if (newValue === undefined) {
    return undefined;
  }

  const oldDisplay = (oldValue ?? []).join(', ') || '(none)';
  const newDisplay = newValue.join(', ') || '(none)';
  if (oldDisplay === newDisplay) {
    return undefined;
  }

  return { field, from: oldDisplay, to: newDisplay };
}

function formatDescriptionFieldChange(
  originalContent: string,
  newDescription: string | undefined,
): FieldChange | undefined {
  if (newDescription === undefined) {
    return undefined;
  }

  const oldLines = countDescriptionLines(extractDescription(originalContent).trim());
  const newLines = countDescriptionLines(newDescription.trim());

  if (oldLines === 0 && newLines > 0) {
    return { field: 'description', from: undefined, to: `added (${formatLineCount(newLines)})` };
  }
  if (newLines === 0 && oldLines > 0) {
    return { field: 'description', from: formatLineCount(oldLines), to: 'cleared' };
  }
  if (oldLines !== newLines) {
    return { field: 'description', from: formatLineCount(oldLines), to: `updated (${formatLineCount(newLines)})` };
  }
  return { field: 'description', from: undefined, to: 'updated' };
}

function countDescriptionLines(description: string): number {
  return description === '' ? 0 : description.split('\n').length;
}

function formatLineCount(count: number): string {
  return `${count} line${count !== 1 ? 's' : ''}`;
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

  for (const { key, fmKey } of SIMPLE_FIELD_MAPPINGS) {
    const change = formatScalarFieldChange(
      fmKey,
      typeof originalFm[fmKey] === 'string' ? originalFm[fmKey] : undefined,
      fields[key] as string | undefined,
    );
    if (change) {
      changes.push(change);
    }
  }

  const descriptionChange = formatDescriptionFieldChange(originalContent, fields.description);
  if (descriptionChange) {
    changes.push(descriptionChange);
  }

  for (const { key, fmKey } of ARRAY_FIELD_MAPPINGS) {
    const change = formatArrayFieldChange(
      fmKey,
      Array.isArray(originalFm[fmKey]) ? (originalFm[fmKey] as string[]) : undefined,
      fields[key] as readonly string[] | undefined,
    );
    if (change) {
      changes.push(change);
    }
  }

  return changes;
}

// ─── Convenience Mutations ───────────────────────────────────────

export function pickupTask(taskPath: string, assignee: TaskAssignee = 'AGENT'): void {
  updateTaskFields(taskPath, { status: 'IN PROGRESS', assignee });
}

export function completeTask(taskPath: string, final = false, resolution?: TaskResolution): void {
  if (final && !resolution) {
    throw new Error('Completing a task (final=true) requires a resolution: DONE or WONTFIX.');
  }
  if (final && resolution === 'DONE') {
    const current = parseFrontmatter(readFileSync(taskPath, 'utf-8'));
    if (current.status !== 'NEEDS REVIEW') {
      throw new Error('Completing a task with resolution DONE requires current status NEEDS REVIEW.');
    }
  }
  updateTaskFields(taskPath, {
    status: final ? 'COMPLETE' : 'NEEDS REVIEW',
    ...(resolution ? { resolution } : {}),
  });
}
