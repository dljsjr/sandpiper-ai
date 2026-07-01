import type { Task } from './types.js';

/**
 * Format a task as a single-line summary for list output.
 */
export function formatTaskLine(task: Task): string {
  const indent = task.parent ? '    ' : '  ';
  const kindTag = task.kind === 'SUBTASK' && task.parent ? `SUBTASK, Parent: ${task.parent}` : task.kind;
  return `${indent}[${task.priority}] ${task.key} (${kindTag}): ${task.title} [${task.status}] ${task.assignee !== 'UNASSIGNED' ? `@${task.assignee}` : ''}`.trimEnd();
}

/**
 * Format a task's full details for show output.
 * When `description` is a non-empty string, it's appended as a body section.
 */
export function formatTaskDetail(task: Task, description?: string): string {
  const dependsOn = task.dependsOn ?? [];
  const blockedBy = task.blockedBy ?? [];
  const related = task.related ?? [];
  const lines: string[] = [
    `${task.key}: ${task.title}`,
    '',
    `  Status:   ${task.status}`,
    `  Kind:     ${task.kind}`,
    `  Priority: ${task.priority}`,
    `  Assignee: ${task.assignee}`,
    `  Reporter: ${task.reporter}`,
    `  Project:  ${task.project}`,
  ];

  if (task.parent) {
    lines.push(`  Parent:   ${task.parent}`);
  }

  lines.push(`  Created:  ${task.createdAt}`);
  lines.push(`  Updated:  ${task.updatedAt}`);

  if (dependsOn.length > 0) {
    lines.push(`  Depends:  ${dependsOn.join(', ')}`);
  }
  if (blockedBy.length > 0) {
    lines.push(`  Blocked:  ${blockedBy.join(', ')}`);
  }
  if (related.length > 0) {
    lines.push(`  Related:  ${related.join(', ')}`);
  }

  if (description) {
    lines.push('', description);
  }

  return lines.join('\n');
}

/**
 * Format a status/priority summary table.
 */
export function formatSummary(tasks: readonly Task[]): string {
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byProject: Record<string, number> = {};
  const byAssignee: Record<string, number> = {};

  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
    byProject[task.project] = (byProject[task.project] ?? 0) + 1;
    byAssignee[task.assignee] = (byAssignee[task.assignee] ?? 0) + 1;
  }

  const lines: string[] = [
    `Total: ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`,
    '',
    'By Status:',
    ...formatCounts(byStatus, ['NOT STARTED', 'IN PROGRESS', 'NEEDS REVIEW', 'COMPLETE']),
    '',
    'By Priority:',
    ...formatCounts(byPriority, ['HIGH', 'MEDIUM', 'LOW']),
    '',
    'By Project:',
    ...formatCounts(byProject),
    '',
    'By Assignee:',
    ...formatCounts(byAssignee, ['AGENT', 'USER', 'UNASSIGNED']),
  ];

  return lines.join('\n');
}

function formatCounts(counts: Record<string, number>, order?: readonly string[]): string[] {
  if (!order) {
    return Object.keys(counts)
      .sort()
      .map((k) => `  ${k}: ${counts[k]}`);
  }

  const ordered = order.filter((k) => (counts[k] ?? 0) > 0);
  const orderedSet = new Set(order);
  const remaining = Object.keys(counts)
    .filter((k) => !orderedSet.has(k) && (counts[k] ?? 0) > 0)
    .sort();

  return [...ordered, ...remaining].map((k) => `  ${k}: ${counts[k]}`);
}
