import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadIndex, updateIndex } from "./index-update.js";

function writeTask(
	dir: string,
	projectKey: string,
	taskKey: string,
	frontmatter: Record<string, unknown>,
	parentKey?: string,
): string {
	const projectDir = join(dir, projectKey);
	mkdirSync(projectDir, { recursive: true });

	let taskPath: string;
	if (parentKey) {
		const subtaskDir = join(projectDir, parentKey);
		mkdirSync(subtaskDir, { recursive: true });
		taskPath = join(subtaskDir, `${taskKey}.md`);
	} else {
		taskPath = join(projectDir, `${taskKey}.md`);
	}

	const fm = Object.entries(frontmatter)
		.map(([k, v]) => {
			if (Array.isArray(v)) {
				return `${k}:\n${v.map((item) => `  - ${item}`).join("\n")}`;
			}
			return `${k}: ${v}`;
		})
		.join("\n");

	writeFileSync(
		taskPath,
		`---\n${fm}\n---\n\n# ${frontmatter.title}\n\nDescription.\n`,
	);
	return taskPath;
}

function writeMetaFile(dir: string, projectKey: string, nextNum: number): void {
	const projectDir = join(dir, projectKey);
	mkdirSync(projectDir, { recursive: true });
	writeFileSync(
		join(projectDir, ".meta.yml"),
		`project_key: ${projectKey}\nnext_task_number: ${nextNum}\n`,
	);
}

describe("updateIndex", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "index-test-"));
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should create an index file when none exists", () => {
		writeMetaFile(tasksDir, "SHR", 2);
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Test task",
			status: "NOT STARTED",
			kind: "TASK",
			priority: "HIGH",
			assignee: "UNASSIGNED",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});

		updateIndex(tasksDir);

		expect(existsSync(join(tasksDir, "index.toon"))).toBe(true);
	});

	it("should index all tasks in a project", () => {
		writeMetaFile(tasksDir, "SHR", 3);
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "First task",
			status: "NOT STARTED",
			kind: "TASK",
			priority: "HIGH",
			assignee: "UNASSIGNED",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});
		writeTask(tasksDir, "SHR", "SHR-2", {
			title: "Second task",
			status: "IN PROGRESS",
			kind: "BUG",
			priority: "MEDIUM",
			assignee: "AGENT",
			reporter: "AGENT",
			created_at: "2026-03-20T16:00:00Z",
			updated_at: "2026-03-20T17:00:00Z",
		});

		const index = updateIndex(tasksDir);

		expect(index.tasks["SHR-1"]).toBeDefined();
		expect(index.tasks["SHR-2"]).toBeDefined();
		expect(index.tasks["SHR-1"]?.title).toBe("First task");
		expect(index.tasks["SHR-1"]?.status).toBe("NOT STARTED");
		expect(index.tasks["SHR-1"]?.project).toBe("SHR");
		expect(index.tasks["SHR-2"]?.title).toBe("Second task");
		expect(index.tasks["SHR-2"]?.kind).toBe("BUG");
		expect(index.tasks["SHR-2"]?.assignee).toBe("AGENT");
		expect(index.tasks["SHR-2"]?.project).toBe("SHR");
	});

	it("should index subtasks with parent reference", () => {
		writeMetaFile(tasksDir, "SHR", 4);
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Parent task",
			status: "IN PROGRESS",
			kind: "TASK",
			priority: "HIGH",
			assignee: "AGENT",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});
		writeTask(
			tasksDir,
			"SHR",
			"SHR-2",
			{
				title: "Child subtask",
				status: "NOT STARTED",
				kind: "SUBTASK",
				priority: "MEDIUM",
				assignee: "UNASSIGNED",
				reporter: "AGENT",
				created_at: "2026-03-20T16:00:00Z",
				updated_at: "2026-03-20T16:00:00Z",
			},
			"SHR-1",
		);

		const index = updateIndex(tasksDir);

		const subtask = index.tasks["SHR-2"];
		expect(subtask).toBeDefined();
		expect(subtask?.kind).toBe("SUBTASK");
		expect(subtask?.parent).toBe("SHR-1");
		expect(subtask?.project).toBe("SHR");
	});

	it("should index multiple projects", () => {
		writeMetaFile(tasksDir, "SHR", 2);
		writeMetaFile(tasksDir, "CLI", 2);
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Shell relay task",
			status: "NOT STARTED",
			kind: "TASK",
			priority: "HIGH",
			assignee: "UNASSIGNED",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});
		writeTask(tasksDir, "CLI", "CLI-1", {
			title: "CLI task",
			status: "IN PROGRESS",
			kind: "TASK",
			priority: "MEDIUM",
			assignee: "USER",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});

		const index = updateIndex(tasksDir);

		expect(index.tasks["SHR-1"]).toBeDefined();
		expect(index.tasks["CLI-1"]).toBeDefined();
		expect(index.tasks["SHR-1"]?.project).toBe("SHR");
		expect(index.tasks["CLI-1"]?.project).toBe("CLI");
	});

	it("should index optional frontmatter fields", () => {
		writeMetaFile(tasksDir, "SHR", 2);
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Task with deps",
			status: "NOT STARTED",
			kind: "TASK",
			priority: "HIGH",
			assignee: "UNASSIGNED",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
			depends_on: ["SHR-2", "SHR-3"],
			blocked_by: ["SHR-4"],
			related: ["SHR-5"],
		});

		const index = updateIndex(tasksDir);

		const task = index.tasks["SHR-1"]!;
		expect(task.dependsOn).toEqual(["SHR-2", "SHR-3"]);
		expect(task.blockedBy).toEqual(["SHR-4"]);
		expect(task.related).toEqual(["SHR-5"]);
	});

	it("should skip files that have not been modified since last index", () => {
		writeMetaFile(tasksDir, "SHR", 2);
		const taskPath = writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Unchanged task",
			status: "NOT STARTED",
			kind: "TASK",
			priority: "HIGH",
			assignee: "UNASSIGNED",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});

		// First index
		const index1 = updateIndex(tasksDir);
		const firstIndexedAt = index1.tasks["SHR-1"]?.lastIndexedAt ?? 0;

		// Set mtime to before the last indexed time (simulate no changes)
		const pastDate = new Date(firstIndexedAt - 10_000);
		utimesSync(taskPath, pastDate, pastDate);

		// Small delay to ensure Date.now() differs
		const index2 = updateIndex(tasksDir);

		// lastIndexedAt should NOT have changed (file was skipped)
		expect(index2.tasks["SHR-1"]?.lastIndexedAt).toBe(firstIndexedAt);
	});

	it("should re-index files that have been modified since last index", () => {
		writeMetaFile(tasksDir, "SHR", 2);
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Original title",
			status: "NOT STARTED",
			kind: "TASK",
			priority: "HIGH",
			assignee: "UNASSIGNED",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});

		// First index
		const index1 = updateIndex(tasksDir);
		expect(index1.tasks["SHR-1"]?.title).toBe("Original title");

		// Modify the task
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Updated title",
			status: "IN PROGRESS",
			kind: "TASK",
			priority: "HIGH",
			assignee: "AGENT",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-21T10:00:00Z",
		});

		// Second index should pick up the changes
		const index2 = updateIndex(tasksDir);
		expect(index2.tasks["SHR-1"]?.title).toBe("Updated title");
		expect(index2.tasks["SHR-1"]?.status).toBe("IN PROGRESS");
	});

	it("should remove tasks from the index that no longer exist on disk", () => {
		writeMetaFile(tasksDir, "SHR", 3);
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Keeper",
			status: "NOT STARTED",
			kind: "TASK",
			priority: "HIGH",
			assignee: "UNASSIGNED",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});
		const removePath = writeTask(tasksDir, "SHR", "SHR-2", {
			title: "To be removed",
			status: "NOT STARTED",
			kind: "TASK",
			priority: "LOW",
			assignee: "UNASSIGNED",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T15:00:00Z",
		});

		// First index
		const index1 = updateIndex(tasksDir);
		const shrTasks1 = Object.values(index1.tasks).filter(
			(t) => t.project === "SHR",
		);
		expect(shrTasks1).toHaveLength(2);

		// Remove SHR-2
		rmSync(removePath);

		// Re-index — SHR-2 should be gone
		const index2 = updateIndex(tasksDir);
		const shrTasks2 = Object.values(index2.tasks).filter(
			(t) => t.project === "SHR",
		);
		expect(shrTasks2).toHaveLength(1);
		expect(index2.tasks["SHR-1"]).toBeDefined();
		expect(index2.tasks["SHR-2"]).toBeUndefined();
	});

	it("should set version to 1", () => {
		writeMetaFile(tasksDir, "SHR", 1);
		const index = updateIndex(tasksDir);
		expect(index.version).toBe(1);
	});

	it("should set lastUpdatedAt to a recent timestamp", () => {
		writeMetaFile(tasksDir, "SHR", 1);
		const before = Date.now();
		const index = updateIndex(tasksDir);
		const after = Date.now();
		expect(index.lastUpdatedAt).toBeGreaterThanOrEqual(before);
		expect(index.lastUpdatedAt).toBeLessThanOrEqual(after);
	});
});

describe("loadIndex", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "load-index-test-"));
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should return null when no index file exists", () => {
		expect(loadIndex(tasksDir)).toBeNull();
	});

	it("should round-trip through save and load", () => {
		writeMetaFile(tasksDir, "SHR", 2);
		writeTask(tasksDir, "SHR", "SHR-1", {
			title: "Round trip test",
			status: "IN PROGRESS",
			kind: "TASK",
			priority: "HIGH",
			assignee: "AGENT",
			reporter: "USER",
			created_at: "2026-03-20T15:00:00Z",
			updated_at: "2026-03-20T16:00:00Z",
		});

		// Update creates the index file
		updateIndex(tasksDir);

		// Load reads it back
		const loaded = loadIndex(tasksDir);
		expect(loaded).not.toBeNull();
		expect(loaded?.version).toBe(1);
		expect(loaded?.tasks["SHR-1"]?.title).toBe("Round trip test");
		expect(loaded?.tasks["SHR-1"]?.assignee).toBe("AGENT");
		expect(loaded?.tasks["SHR-1"]?.project).toBe("SHR");
	});
});
