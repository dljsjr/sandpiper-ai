import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";
import {
	completeTask,
	createProject,
	createTask,
	pickupTask,
	updateTaskFields,
} from "./mutate.js";

function readTaskFrontmatter(path: string): Record<string, string | string[]> {
	return parseFrontmatter(readFileSync(path, "utf-8"));
}

describe("createProject", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "mutate-test-"));
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should create a project directory", () => {
		createProject(tasksDir, "FOO");
		expect(existsSync(join(tasksDir, "FOO"))).toBe(true);
	});

	it("should throw if project already exists", () => {
		createProject(tasksDir, "FOO");
		expect(() => createProject(tasksDir, "FOO")).toThrow("already exists");
	});

	it("should reject invalid project keys", () => {
		expect(() => createProject(tasksDir, "fo")).toThrow("3 uppercase");
		expect(() => createProject(tasksDir, "FOOO")).toThrow("3 uppercase");
		expect(() => createProject(tasksDir, "F1O")).toThrow("3 uppercase");
	});
});

describe("createTask", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "mutate-test-"));
		createProject(tasksDir, "FOO");
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should create a TASK at the project root", () => {
		const result = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "My first task",
			reporter: "USER",
		});

		expect(result.key).toBe("FOO-1");
		expect(existsSync(result.path)).toBe(true);

		const fm = readTaskFrontmatter(result.path);
		expect(fm.title).toBe("My first task");
		expect(fm.status).toBe("NOT STARTED");
		expect(fm.kind).toBe("TASK");
		expect(fm.priority).toBe("HIGH");
		expect(fm.assignee).toBe("UNASSIGNED");
		expect(fm.reporter).toBe("USER");
	});

	it("should create a BUG at the project root", () => {
		const result = createTask(tasksDir, {
			project: "FOO",
			kind: "BUG",
			priority: "HIGH",
			title: "Something broke",
			reporter: "AGENT",
		});

		expect(result.key).toBe("FOO-1");
		const fm = readTaskFrontmatter(result.path);
		expect(fm.kind).toBe("BUG");
		expect(fm.reporter).toBe("AGENT");
	});

	it("should create a SUBTASK under a parent", () => {
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Parent",
			reporter: "USER",
		});

		const result = createTask(tasksDir, {
			project: "FOO",
			kind: "SUBTASK",
			priority: "MEDIUM",
			title: "Child subtask",
			reporter: "AGENT",
			parent: "FOO-1",
		});

		expect(result.key).toBe("FOO-2");
		expect(result.path).toContain(join("FOO", "FOO-1", "FOO-2.md"));
	});

	it("should increment task numbers monotonically", () => {
		const r1 = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "First",
			reporter: "USER",
		});
		const r2 = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "MEDIUM",
			title: "Second",
			reporter: "USER",
		});
		const r3 = createTask(tasksDir, {
			project: "FOO",
			kind: "BUG",
			priority: "LOW",
			title: "Third",
			reporter: "AGENT",
		});

		expect(r1.key).toBe("FOO-1");
		expect(r2.key).toBe("FOO-2");
		expect(r3.key).toBe("FOO-3");
	});

	it("should require parent for SUBTASK", () => {
		expect(() =>
			createTask(tasksDir, {
				project: "FOO",
				kind: "SUBTASK",
				priority: "HIGH",
				title: "Orphan",
				reporter: "USER",
			}),
		).toThrow("parent");
	});

	it("should auto-create project if it doesn't exist", () => {
		const result = createTask(tasksDir, {
			project: "BAR",
			kind: "TASK",
			priority: "MEDIUM",
			title: "Auto project",
			reporter: "USER",
		});

		expect(result.key).toBe("BAR-1");
		expect(existsSync(join(tasksDir, "BAR"))).toBe(true);
	});

	it("should include optional relationship fields", () => {
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Dep target",
			reporter: "USER",
		});

		const result = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "MEDIUM",
			title: "With deps",
			reporter: "USER",
			dependsOn: ["FOO-1"],
			related: ["FOO-1"],
		});

		const fm = readTaskFrontmatter(result.path);
		expect(fm.depends_on).toEqual(["FOO-1"]);
		expect(fm.related).toEqual(["FOO-1"]);
	});
});

describe("updateTaskFields", () => {
	let tasksDir: string;
	let taskPath: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "mutate-test-"));
		createProject(tasksDir, "FOO");
		const result = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Original",
			reporter: "USER",
		});
		taskPath = result.path;
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should update status", () => {
		updateTaskFields(taskPath, { status: "IN PROGRESS" });
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.status).toBe("IN PROGRESS");
	});

	it("should update assignee", () => {
		updateTaskFields(taskPath, { assignee: "AGENT" });
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.assignee).toBe("AGENT");
	});

	it("should update priority", () => {
		updateTaskFields(taskPath, { priority: "LOW" });
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.priority).toBe("LOW");
	});

	it("should update multiple fields at once", () => {
		updateTaskFields(taskPath, {
			status: "IN PROGRESS",
			assignee: "AGENT",
			priority: "MEDIUM",
		});
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.status).toBe("IN PROGRESS");
		expect(fm.assignee).toBe("AGENT");
		expect(fm.priority).toBe("MEDIUM");
	});

	it("should update the updated_at timestamp", async () => {
		const before = readTaskFrontmatter(taskPath).updated_at as string;
		// Small delay to ensure timestamp differs
		await new Promise((r) => setTimeout(r, 10));
		updateTaskFields(taskPath, { status: "IN PROGRESS" });
		const after = readTaskFrontmatter(taskPath).updated_at as string;
		expect(new Date(after).getTime()).toBeGreaterThan(
			new Date(before).getTime(),
		);
	});

	it("should update title (frontmatter and heading)", () => {
		updateTaskFields(taskPath, { title: "New title" });
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.title).toBe("New title");
		const content = readFileSync(taskPath, "utf-8");
		expect(content).toContain("# New title");
	});

	it("should update reporter", () => {
		updateTaskFields(taskPath, { reporter: "AGENT" });
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.reporter).toBe("AGENT");
	});

	it("should add depends_on", () => {
		updateTaskFields(taskPath, { dependsOn: ["FOO-2", "FOO-3"] });
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.depends_on).toEqual(["FOO-2", "FOO-3"]);
	});

	it("should clear depends_on with empty array", () => {
		updateTaskFields(taskPath, { dependsOn: ["FOO-2"] });
		updateTaskFields(taskPath, { dependsOn: [] });
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.depends_on).toBeUndefined();
	});

	it("should add blocked_by and related", () => {
		updateTaskFields(taskPath, {
			blockedBy: ["FOO-5"],
			related: ["FOO-6", "FOO-7"],
		});
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.blocked_by).toEqual(["FOO-5"]);
		expect(fm.related).toEqual(["FOO-6", "FOO-7"]);
	});

	it("should not modify created_at", () => {
		const before = readTaskFrontmatter(taskPath).created_at;
		updateTaskFields(taskPath, { status: "COMPLETE", resolution: "DONE" });
		const after = readTaskFrontmatter(taskPath).created_at;
		expect(after).toBe(before);
	});
});

describe("pickupTask", () => {
	let tasksDir: string;
	let taskPath: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "mutate-test-"));
		createProject(tasksDir, "FOO");
		const result = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Available task",
			reporter: "USER",
		});
		taskPath = result.path;
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should set assignee to AGENT and status to IN PROGRESS", () => {
		pickupTask(taskPath);
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.assignee).toBe("AGENT");
		expect(fm.status).toBe("IN PROGRESS");
	});
});

describe("completeTask", () => {
	let tasksDir: string;
	let taskPath: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "mutate-test-"));
		createProject(tasksDir, "FOO");
		const result = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Work done",
			reporter: "USER",
		});
		taskPath = result.path;
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should set status to NEEDS REVIEW by default", () => {
		completeTask(taskPath);
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.status).toBe("NEEDS REVIEW");
	});

	it("should set status to COMPLETE when final=true with resolution", () => {
		completeTask(taskPath, true, "DONE");
		const fm = readTaskFrontmatter(taskPath);
		expect(fm.status).toBe("COMPLETE");
		expect(fm.resolution).toBe("DONE");
	});
});
