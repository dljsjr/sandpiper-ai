import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { projectFromKey } from './patterns.js';
import type { Task, TaskAssignee, TaskKind, TaskPriority, TaskReporter, TaskResolution, TaskStatus } from './types.js';

const CONVENTIONAL_ASSIGNEES = ['UNASSIGNED', 'USER', 'AGENT'] as const;
const CONVENTIONAL_REPORTERS = ['USER', 'AGENT'] as const;

/**
 * Convert parsed frontmatter + a task key into a Task object.
 * This is the single canonical place for this mapping.
 */
export function taskFromFrontmatter(key: string, fm: Record<string, string | string[]>): Task {
  const resolution = parseResolution(fm.resolution);
  const task: Task = {
    key,
    project: projectFromKey(key),
    title: stringValue(fm.title, key),
    status: parseStatus(fm.status),
    kind: parseKind(fm.kind),
    priority: parsePriority(fm.priority),
    assignee: parseAssignee(fm.assignee),
    reporter: parseReporter(fm.reporter),
    createdAt: stringValue(fm.created_at, ''),
    updatedAt: stringValue(fm.updated_at, ''),
    ...(resolution ? { resolution } : {}),
    dependsOn: arrayValue(fm.depends_on),
    blockedBy: arrayValue(fm.blocked_by),
    related: arrayValue(fm.related),
  };
  return task;
}

function stringValue(value: string | string[] | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function arrayValue(value: string | string[] | undefined): readonly string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  return [];
}

function parseStatus(value: string | string[] | undefined): TaskStatus {
  switch (value) {
    case 'NOT STARTED':
    case 'IN PROGRESS':
    case 'NEEDS REVIEW':
    case 'COMPLETE':
      return value;
    default:
      return 'NOT STARTED';
  }
}

function parseKind(value: string | string[] | undefined): TaskKind {
  switch (value) {
    case 'TASK':
    case 'BUG':
    case 'SUBTASK':
      return value;
    default:
      return 'TASK';
  }
}

function parsePriority(value: string | string[] | undefined): TaskPriority {
  switch (value) {
    case 'LOW':
    case 'MEDIUM':
    case 'HIGH':
      return value;
    default:
      return 'MEDIUM';
  }
}

function parseAssignee(value: string | string[] | undefined): TaskAssignee {
  return parsePersonField(value, 'assignee', CONVENTIONAL_ASSIGNEES, 'UNASSIGNED');
}

function parseReporter(value: string | string[] | undefined): TaskReporter {
  return parsePersonField(value, 'reporter', CONVENTIONAL_REPORTERS, 'USER');
}

export function normalizeTitleInput(value: string): string {
  return normalizeNonEmptySingleLineInput(value, 'title');
}

export function normalizeAssigneeInput(value: string): TaskAssignee {
  return normalizePersonInput(value, 'assignee', CONVENTIONAL_ASSIGNEES);
}

export function normalizeReporterInput(value: string): TaskReporter {
  return normalizePersonInput(value, 'reporter', CONVENTIONAL_REPORTERS);
}

export function formatFrontmatterScalar(value: string): string {
  return /^[A-Z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}

function parsePersonField(
  value: string | string[] | undefined,
  fieldName: string,
  conventionalValues: readonly string[],
  fallback: string,
): string {
  if (typeof value !== 'string') return fallback;
  try {
    return normalizePersonInput(value, fieldName, conventionalValues);
  } catch {
    return fallback;
  }
}

function normalizePersonInput(value: string, fieldName: string, conventionalValues: readonly string[]): string {
  const trimmed = normalizeNonEmptySingleLineInput(value, fieldName);
  const upper = trimmed.toUpperCase();
  return conventionalValues.includes(upper) ? upper : trimmed;
}

function normalizeNonEmptySingleLineInput(value: string, fieldName: string): string {
  if (/[\r\n]/.test(value)) {
    throw new Error(`${fieldName} must be a single-line string.`);
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(`${fieldName} must be non-empty.`);
  }

  return trimmed;
}

function parseResolution(value: string | string[] | undefined): TaskResolution | undefined {
  switch (value) {
    case 'DONE':
    case 'WONTFIX':
      return value;
    default:
      return undefined;
  }
}

/**
 * Parse YAML frontmatter from a markdown file's content.
 *
 * Expects the file to start with `---\n`, followed by YAML frontmatter,
 * closed by `---\n`. Returns a flat Record of string keys to string scalars
 * or string arrays.
 *
 * Trail reads YAML 1.2 with the failsafe schema: collections are YAML, but all
 * scalars stay strings. Duplicate keys preserve the first value for backwards
 * compatibility with the previous hand-rolled parser.
 */
export function parseFrontmatter(content: string): Record<string, string | string[]> {
  const source = extractFrontmatterSource(content);
  if (source === undefined) {
    return {};
  }

  const doc = parseDocument(source, { schema: 'failsafe', uniqueKeys: false });
  const root = doc.contents;
  if (!isMap(root)) {
    return {};
  }

  const result: Record<string, string | string[]> = {};
  for (const pair of root.items) {
    const key = scalarStringValue(pair.key);
    if (key === undefined || Object.hasOwn(result, key)) {
      continue;
    }

    const value = frontmatterValue(pair.value);
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}

function extractFrontmatterSource(content: string): string | undefined {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') {
    return undefined;
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  return end === -1 ? undefined : lines.slice(1, end).join('\n');
}

function frontmatterValue(value: unknown): string | string[] | undefined {
  if (value === null) {
    return [];
  }
  if (isScalar(value)) {
    if (value.type === 'PLAIN' && value.value === '') {
      return [];
    }
    return typeof value.value === 'string' ? value.value : String(value.value ?? '');
  }
  if (isSeq(value)) {
    return value.items.map((item) => scalarStringValue(item) ?? '').filter((item) => item !== '');
  }
  return undefined;
}

function scalarStringValue(value: unknown): string | undefined {
  if (!isScalar(value)) {
    return undefined;
  }
  return typeof value.value === 'string' ? value.value : String(value.value ?? '');
}
