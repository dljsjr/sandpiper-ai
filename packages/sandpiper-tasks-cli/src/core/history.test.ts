import {
	existsSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createProject, createTask, updateTaskFields } from "./mutate.js";

describe("History diffs", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "history-test-"));
		createProject(tasksDir, "FOO");
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should not create history for a new task", () => {
		const { key } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "New task",
			reporter: "USER",
		});

		const histDir = join(tasksDir, "history", key);
		expect(existsSync(histDir)).toBe(false);
	});

	it("should create a diff file when a field is updated", () => {
		const { key, path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Will be updated",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS" });

		const histDir = join(tasksDir, "history", key);
		expect(existsSync(histDir)).toBe(true);
		const diffs = readdirSync(histDir).filter((f) => f.endsWith(".diff"));
		expect(diffs).toHaveLength(1);
	});

	it("should write a valid unified diff", () => {
		const { key, path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Diff content",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS", assignee: "AGENT" });

		const histDir = join(tasksDir, "history", key);
		const diffs = readdirSync(histDir).filter((f) => f.endsWith(".diff"));
		const diffContent = readFileSync(join(histDir, diffs[0]!), "utf-8");

		// Should contain unified diff markers
		expect(diffContent).toContain("---");
		expect(diffContent).toContain("+++");
		expect(diffContent).toContain("-status: NOT STARTED");
		expect(diffContent).toContain("+status: IN PROGRESS");
	});

	it("should accumulate diff files across multiple updates", () => {
		const { key, path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Multi update",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS" });
		updateTaskFields(path, { priority: "LOW" });
		updateTaskFields(path, { assignee: "AGENT" });

		const histDir = join(tasksDir, "history", key);
		const diffs = readdirSync(histDir).filter((f) => f.endsWith(".diff"));
		expect(diffs).toHaveLength(3);
	});

	it("should capture description changes in the diff", () => {
		const { key, path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Desc change",
			reporter: "USER",
		});

		updateTaskFields(path, {
			description: "First version of the description.",
		});

		const histDir = join(tasksDir, "history", key);
		const diffs = readdirSync(histDir).filter((f) => f.endsWith(".diff"));
		const diffContent = readFileSync(join(histDir, diffs[0]!), "utf-8");
		expect(diffContent).toContain("+First version of the description.");
	});

	it("should capture description edits showing old and new content", async () => {
		const { key, path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Desc edit",
			reporter: "USER",
		});

		updateTaskFields(path, { description: "Original content." });
		await new Promise((r) => setTimeout(r, 10));
		updateTaskFields(path, { description: "Revised content." });

		const histDir = join(tasksDir, "history", key);
		const diffs = readdirSync(histDir)
			.filter((f) => f.endsWith(".diff"))
			.sort();
		expect(diffs).toHaveLength(2);

		// The later diff should show the description change
		const allContents = diffs.map((f) =>
			readFileSync(join(histDir, f), "utf-8"),
		);
		const revisionDiff = allContents.find(
			(c) =>
				c.includes("-Original content.") && c.includes("+Revised content."),
		);
		expect(revisionDiff).toBeDefined();
	});

	it("should use timestamp-based filenames that sort chronologically", async () => {
		const { key, path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Timestamp order",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS" });
		await new Promise((r) => setTimeout(r, 10));
		updateTaskFields(path, { status: "NEEDS REVIEW" });

		const histDir = join(tasksDir, "history", key);
		const diffs = readdirSync(histDir)
			.filter((f) => f.endsWith(".diff"))
			.sort();
		expect(diffs).toHaveLength(2);
		// Lexicographic sort of ISO timestamps = chronological
		expect(diffs[0]! < diffs[1]!).toBe(true);
	});

	it("should use the tasks root history dir, not project-nested", () => {
		const { key, path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Root history",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS" });

		// History is at tasksDir/history/KEY, NOT tasksDir/FOO/history/KEY
		expect(existsSync(join(tasksDir, "history", key))).toBe(true);
		expect(existsSync(join(tasksDir, "FOO", "history"))).toBe(false);
	});
});
