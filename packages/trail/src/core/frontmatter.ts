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

function parseScalarValue(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === 'string') return parsed;
    } catch {
      // Fall through to legacy quote stripping below.
    }
    return value.replace(/^"(.*)"$/, '$1');
  }
  return value;
}

/**
 * Parse YAML frontmatter from a markdown file's content.
 *
 * Expects the file to start with `---\n`, followed by YAML key-value pairs,
 * closed by `---\n`. Returns a flat Record of string keys to values.
 *
 * This is a minimal parser for the task management YAML subset — it handles:
 * - Simple key: value pairs (strings, including quoted strings)
 * - Arrays (using `  - item` syntax on subsequent lines)
 *
 * It does NOT handle nested objects, multi-line strings, or full YAML spec.
 */
export function parseFrontmatter(content: string): Record<string, string | string[]> {
  const lines = content.split('\n');

  if (lines[0]?.trim() !== '---') {
    return {};
  }

  const result: Record<string, string | string[]> = {};
  let currentArrayKey: string | null = null;
  let currentArray: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: loop bounded by lines.length
    const line = lines[i]!;

    // End of frontmatter
    if (line.trim() === '---') {
      // Flush any pending array
      if (currentArrayKey) {
        result[currentArrayKey] = currentArray;
      }
      break;
    }

    // Array item line: `  - value`
    const arrayMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayMatch?.[1] && currentArrayKey) {
      currentArray.push(arrayMatch[1].trim());
      continue;
    }

    // Key-value line: `key: value`
    const kvMatch = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kvMatch) {
      // Flush previous array if any
      if (currentArrayKey) {
        result[currentArrayKey] = currentArray;
        currentArrayKey = null;
        currentArray = [];
      }

      const key = kvMatch[1] ?? '';
      const value = (kvMatch[2] ?? '').trim();

      if (Object.hasOwn(result, key)) {
        continue;
      }

      if (value === '') {
        // Empty value — could be the start of an array
        currentArrayKey = key;
        currentArray = [];
      } else {
        result[key] = parseScalarValue(value);
      }
    }
  }

  return result;
}
