import { projectFromKey } from './patterns.js';
import type { Task, TaskAssignee, TaskKind, TaskPriority, TaskReporter, TaskResolution, TaskStatus } from './types.js';

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
  return Array.isArray(value) ? value : [];
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
  switch (value) {
    case 'UNASSIGNED':
    case 'USER':
    case 'AGENT':
      return value;
    default:
      return 'UNASSIGNED';
  }
}

function parseReporter(value: string | string[] | undefined): TaskReporter {
  switch (value) {
    case 'USER':
    case 'AGENT':
      return value;
    default:
      return 'USER';
  }
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

      if (value === '') {
        // Empty value — could be the start of an array
        currentArrayKey = key;
        currentArray = [];
      } else {
        // Strip surrounding quotes if present
        result[key] = value.replace(/^"(.*)"$/, '$1');
      }
    }
  }

  return result;
}
