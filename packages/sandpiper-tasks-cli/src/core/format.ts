import type { Task } from "./types.js";

/**
 * Format a task as a single-line summary for list output.
 */
export function formatTaskLine(task: Task): string {
	const indent = task.parent ? "    " : "  ";
	const kindTag = task.kind === "SUBTASK" ? "SUBTASK" : task.kind;
	return `${indent}[${task.priority}] ${task.key} (${kindTag}): ${task.title} [${task.status}] ${task.assignee !== "UNASSIGNED" ? `@${task.assignee}` : ""}`.trimEnd();
}

/**
 * Format a task's full details for show output.
 */
export function formatTaskDetail(task: Task): string {
	const lines: string[] = [
		`${task.key}: ${task.title}`,
		"",
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

	if (task.dependsOn.length > 0) {
		lines.push(`  Depends:  ${task.dependsOn.join(", ")}`);
	}
	if (task.blockedBy.length > 0) {
		lines.push(`  Blocked:  ${task.blockedBy.join(", ")}`);
	}
	if (task.related.length > 0) {
		lines.push(`  Related:  ${task.related.join(", ")}`);
	}

	return lines.join("\n");
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
		`Total: ${tasks.length} task${tasks.length !== 1 ? "s" : ""}`,
		"",
		"By Status:",
		...formatCounts(byStatus, [
			"NOT STARTED",
			"IN PROGRESS",
			"NEEDS REVIEW",
			"COMPLETE",
		]),
		"",
		"By Priority:",
		...formatCounts(byPriority, ["HIGH", "MEDIUM", "LOW"]),
		"",
		"By Project:",
		...formatCounts(byProject),
		"",
		"By Assignee:",
		...formatCounts(byAssignee, ["AGENT", "USER", "UNASSIGNED"]),
	];

	return lines.join("\n");
}

function formatCounts(
	counts: Record<string, number>,
	order?: readonly string[],
): string[] {
	const keys = order
		? order.filter((k) => (counts[k] ?? 0) > 0)
		: Object.keys(counts).sort();

	return keys.map((k) => `  ${k}: ${counts[k]}`);
}
