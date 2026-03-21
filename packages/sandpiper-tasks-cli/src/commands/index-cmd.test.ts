import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveTasksDir } from "./helpers.js";

const CLI_PATH = join(import.meta.dirname!, "..", "index.ts");

function runCli(
	args: string,
	cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
	try {
		const stdout = execSync(`bun ${CLI_PATH} ${args}`, {
			encoding: "utf-8",
			cwd,
			timeout: 10_000,
			env: { ...process.env },
		});
		return { stdout, stderr: "", exitCode: 0 };
	} catch (error: unknown) {
		const execError = error as {
			stdout?: string;
			stderr?: string;
			status?: number;
		};
		return {
			stdout: execError.stdout ?? "",
			stderr: execError.stderr ?? "",
			exitCode: execError.status ?? 1,
		};
	}
}

function setupTasksDir(baseDir: string): string {
	const tasksDir = join(baseDir, ".sandpiper", "tasks", "TST");
	mkdirSync(tasksDir, { recursive: true });
	writeFileSync(
		join(tasksDir, ".meta.yml"),
		"project_key: TST\nnext_task_number: 2\n",
	);
	writeFileSync(
		join(tasksDir, "TST-1.md"),
		`---
title: "Test task"
status: NOT STARTED
kind: TASK
priority: HIGH
assignee: UNASSIGNED
reporter: USER
created_at: 2026-03-20T15:00:00Z
updated_at: 2026-03-20T15:00:00Z
---

# Test task

A test task.
`,
	);
	return join(baseDir, ".sandpiper", "tasks");
}

describe("resolveTasksDir", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("should resolve tasks dir from an explicit base path", () => {
		setupTasksDir(tempDir);
		const result = resolveTasksDir(tempDir);
		expect(result).toBe(join(tempDir, ".sandpiper", "tasks"));
	});

	it("should throw if tasks directory does not exist", () => {
		expect(() => resolveTasksDir(tempDir)).toThrow("Tasks directory not found");
	});
});

describe("CLI: index update", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cli-e2e-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("should create an index file and report task count", () => {
		setupTasksDir(tempDir);

		const result = runCli(`--dir ${tempDir} index update`);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("1 task");
		expect(result.stdout).toContain("1 project");
		expect(existsSync(join(tempDir, ".sandpiper", "tasks", "index.toon"))).toBe(
			true,
		);
	});

	it("should report error when tasks directory does not exist", () => {
		const result = runCli(`--dir ${tempDir} index update`);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Tasks directory not found");
	});

	it("should print help for index subcommand", () => {
		const result = runCli("index --help");
		expect(result.stdout).toContain("Manage the task index");
		expect(result.stdout).toContain("update");
	});

	it("should print help for index update subcommand", () => {
		const result = runCli("index update --help");
		expect(result.stdout).toContain("Scan task files");
	});

	it("should handle multiple projects", () => {
		const tasksBase = join(tempDir, ".sandpiper", "tasks");
		mkdirSync(join(tasksBase, "AAA"), { recursive: true });
		mkdirSync(join(tasksBase, "BBB"), { recursive: true });
		writeFileSync(
			join(tasksBase, "AAA", ".meta.yml"),
			"project_key: AAA\nnext_task_number: 2\n",
		);
		writeFileSync(
			join(tasksBase, "BBB", ".meta.yml"),
			"project_key: BBB\nnext_task_number: 2\n",
		);
		writeFileSync(
			join(tasksBase, "AAA", "AAA-1.md"),
			'---\ntitle: "Task A"\nstatus: NOT STARTED\nkind: TASK\npriority: HIGH\nassignee: UNASSIGNED\nreporter: USER\ncreated_at: 2026-03-20T15:00:00Z\nupdated_at: 2026-03-20T15:00:00Z\n---\n\n# Task A\n',
		);
		writeFileSync(
			join(tasksBase, "BBB", "BBB-1.md"),
			'---\ntitle: "Task B"\nstatus: NOT STARTED\nkind: TASK\npriority: LOW\nassignee: UNASSIGNED\nreporter: USER\ncreated_at: 2026-03-20T15:00:00Z\nupdated_at: 2026-03-20T15:00:00Z\n---\n\n# Task B\n',
		);

		const result = runCli(`--dir ${tempDir} index update`);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("2 tasks");
		expect(result.stdout).toContain("2 projects");
	});
});
