import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ActivityEntry, extractActivityLog } from "./activity-log.js";
import {
	completeTask,
	createProject,
	createTask,
	pickupTask,
	updateTaskFields,
} from "./mutate.js";

describe("Activity Log", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "activity-test-"));
		createProject(tasksDir, "FOO");
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should not have an activity log on a newly created task", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "New task",
			reporter: "USER",
		});

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(0);
	});

	it("should add an entry when status is updated", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Status change",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS" });

		const content = readFileSync(path, "utf-8");
		const log = extractActivityLog(content);
		expect(log).toHaveLength(1);
		expect(log[0]!.changes).toContainEqual({
			field: "status",
			from: "NOT STARTED",
			to: "IN PROGRESS",
		});
	});

	it("should add an entry when multiple fields are updated", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Multi update",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS", assignee: "AGENT" });

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(1);
		expect(log[0]!.changes).toHaveLength(2);
		expect(log[0]!.changes).toContainEqual({
			field: "status",
			from: "NOT STARTED",
			to: "IN PROGRESS",
		});
		expect(log[0]!.changes).toContainEqual({
			field: "assignee",
			from: "UNASSIGNED",
			to: "AGENT",
		});
	});

	it("should accumulate entries across multiple updates", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Accumulate",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS", assignee: "AGENT" });
		updateTaskFields(path, { priority: "LOW" });

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(2);
	});

	it("should record pickup as status + assignee change", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Pickup test",
			reporter: "USER",
		});

		pickupTask(path);

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(1);
		expect(log[0]!.changes).toContainEqual({
			field: "status",
			from: "NOT STARTED",
			to: "IN PROGRESS",
		});
		expect(log[0]!.changes).toContainEqual({
			field: "assignee",
			from: "UNASSIGNED",
			to: "AGENT",
		});
	});

	it("should record complete with resolution", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Complete test",
			reporter: "USER",
		});

		completeTask(path, true, "DONE");

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(1);
		expect(log[0]!.changes).toContainEqual({
			field: "status",
			from: "NOT STARTED",
			to: "COMPLETE",
		});
		expect(log[0]!.changes).toContainEqual({
			field: "resolution",
			from: undefined,
			to: "DONE",
		});
	});

	it("should record title change", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Old title",
			reporter: "USER",
		});

		updateTaskFields(path, { title: "New title" });

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(1);
		expect(log[0]!.changes).toContainEqual({
			field: "title",
			from: "Old title",
			to: "New title",
		});
	});

	it("should record description addition with line count", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Desc test",
			reporter: "USER",
		});

		updateTaskFields(path, { description: "New body content." });

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(1);
		const descChange = log[0]!.changes.find((c) => c.field === "description");
		expect(descChange).toBeDefined();
		expect(descChange!.to).toContain("added");
		expect(descChange!.to).toContain("1 line");
	});

	it("should record description line count change", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Desc lines",
			reporter: "USER",
		});

		updateTaskFields(path, { description: "Line one." });
		updateTaskFields(path, {
			description: "Line one.\n\nLine two.\n\nLine three.",
		});

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(2);
		const secondChange = log[1]!.changes.find((c) => c.field === "description");
		expect(secondChange).toBeDefined();
		expect(secondChange!.from).toContain("1 line");
		expect(secondChange!.to).toContain("5 line"); // includes blank lines
	});

	it("should have valid ISO timestamps on entries", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Timestamp test",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS" });

		const log = extractActivityLog(readFileSync(path, "utf-8"));
		expect(log).toHaveLength(1);
		const ts = new Date(log[0]!.timestamp);
		expect(ts.getTime()).not.toBeNaN();
	});

	it("should preserve description content when adding activity log", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Preserve desc",
			reporter: "USER",
		});

		updateTaskFields(path, {
			description: "Important description.\n\nDon't lose this.",
		});
		updateTaskFields(path, { status: "IN PROGRESS" });

		const content = readFileSync(path, "utf-8");
		expect(content).toContain("Important description.");
		expect(content).toContain("Don't lose this.");
		expect(content).toContain("Activity Log");
	});

	it("should be rendered as valid markdown", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Markdown test",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "IN PROGRESS", assignee: "AGENT" });
		updateTaskFields(path, { status: "NEEDS REVIEW" });

		const content = readFileSync(path, "utf-8");
		// Should have the activity log delimiter and header
		expect(content).toContain("---\n\n# Activity Log");
		// Each entry is an H2 with timestamp
		const h2Count = (content.match(/^## \d{4}-/gm) ?? []).length;
		expect(h2Count).toBe(2);
	});
});
