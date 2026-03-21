import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFrontmatter } from "./frontmatter.js";
import {
	completeTask,
	createProject,
	createTask,
	updateTaskFields,
} from "./mutate.js";

describe("Resolution field", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "resolution-test-"));
		createProject(tasksDir, "FOO");
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should not have resolution on a new task", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "New task",
			reporter: "USER",
		});
		const fm = parseFrontmatter(readFileSync(path, "utf-8"));
		expect(fm.resolution).toBeUndefined();
	});

	it("should require resolution when completing with final=true", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Will complete",
			reporter: "USER",
		});

		expect(() => completeTask(path, true)).toThrow("resolution");
	});

	it("should accept DONE resolution when completing", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Done task",
			reporter: "USER",
		});

		completeTask(path, true, "DONE");
		const fm = parseFrontmatter(readFileSync(path, "utf-8"));
		expect(fm.status).toBe("COMPLETE");
		expect(fm.resolution).toBe("DONE");
	});

	it("should accept WONTFIX resolution when completing", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Wontfix task",
			reporter: "USER",
		});

		completeTask(path, true, "WONTFIX");
		const fm = parseFrontmatter(readFileSync(path, "utf-8"));
		expect(fm.status).toBe("COMPLETE");
		expect(fm.resolution).toBe("WONTFIX");
	});

	it("should not require resolution for NEEDS REVIEW (final=false)", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Review task",
			reporter: "USER",
		});

		// Should not throw
		completeTask(path, false);
		const fm = parseFrontmatter(readFileSync(path, "utf-8"));
		expect(fm.status).toBe("NEEDS REVIEW");
	});

	it("should allow setting resolution via updateTaskFields", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Manual complete",
			reporter: "USER",
		});

		updateTaskFields(path, { status: "COMPLETE", resolution: "DONE" });
		const fm = parseFrontmatter(readFileSync(path, "utf-8"));
		expect(fm.status).toBe("COMPLETE");
		expect(fm.resolution).toBe("DONE");
	});

	it("should reject COMPLETE status without resolution via updateTaskFields", () => {
		const { path } = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "No resolution",
			reporter: "USER",
		});

		expect(() => updateTaskFields(path, { status: "COMPLETE" })).toThrow(
			"resolution",
		);
	});
});
