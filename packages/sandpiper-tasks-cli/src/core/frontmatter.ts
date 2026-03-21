import { projectFromKey } from "./patterns.js";
import type { Task } from "./types.js";

/**
 * Convert parsed frontmatter + a task key into a Task object.
 * This is the single canonical place for this mapping.
 */
export function taskFromFrontmatter(
	key: string,
	fm: Record<string, string | string[]>,
): Task {
	const str = (v: string | string[] | undefined, fallback: string): string =>
		typeof v === "string" ? v : fallback;
	return {
		key,
		project: projectFromKey(key),
		title: str(fm.title, key),
		status: str(fm.status, "NOT STARTED"),
		kind: str(fm.kind, "TASK"),
		priority: str(fm.priority, "MEDIUM"),
		assignee: str(fm.assignee, "UNASSIGNED"),
		reporter: str(fm.reporter, "USER"),
		createdAt: str(fm.created_at, ""),
		updatedAt: str(fm.updated_at, ""),
		resolution: typeof fm.resolution === "string" ? fm.resolution : undefined,
		dependsOn: Array.isArray(fm.depends_on) ? fm.depends_on : [],
		blockedBy: Array.isArray(fm.blocked_by) ? fm.blocked_by : [],
		related: Array.isArray(fm.related) ? fm.related : [],
	} as Task;
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
export function parseFrontmatter(
	content: string,
): Record<string, string | string[]> {
	const lines = content.split("\n");

	if (lines[0]?.trim() !== "---") {
		return {};
	}

	const result: Record<string, string | string[]> = {};
	let currentArrayKey: string | null = null;
	let currentArray: string[] = [];

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]!;

		// End of frontmatter
		if (line.trim() === "---") {
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

			const key = kvMatch[1] ?? "";
			const value = (kvMatch[2] ?? "").trim();

			if (value === "") {
				// Empty value — could be the start of an array
				currentArrayKey = key;
				currentArray = [];
			} else {
				// Strip surrounding quotes if present
				result[key] = value.replace(/^"(.*)"$/, "$1");
			}
		}
	}

	return result;
}
