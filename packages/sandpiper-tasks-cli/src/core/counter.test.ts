import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decode, encode } from "@toon-format/toon";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadIndex, updateIndex } from "./index-update.js";
import { createProject, createTask } from "./mutate.js";
import type { TaskIndex } from "./types.js";

describe("Counter state management", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "counter-test-"));
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should preserve existing counters from the index when no new tasks are added", () => {
		createProject(tasksDir, "FOO");
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Task 1",
			reporter: "USER",
		});

		// First index — establishes counter
		const index1 = updateIndex(tasksDir);
		const counter1 = index1.counters.FOO?.nextTaskNumber;
		expect(counter1).toBe(2);

		// Second index — nothing changed, counter should be preserved, not rebuilt
		const index2 = updateIndex(tasksDir);
		expect(index2.counters.FOO?.nextTaskNumber).toBe(counter1);
	});

	it("should update counter when a new task file appears", () => {
		createProject(tasksDir, "FOO");
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Task 1",
			reporter: "USER",
		});

		const index1 = updateIndex(tasksDir);
		expect(index1.counters.FOO?.nextTaskNumber).toBe(2);

		// Add a task with a higher number out-of-band
		writeFileSync(
			join(tasksDir, "FOO", "FOO-10.md"),
			'---\ntitle: "Jumped ahead"\nstatus: NOT STARTED\nkind: TASK\npriority: LOW\nassignee: UNASSIGNED\nreporter: USER\ncreated_at: 2026-03-21T10:00:00Z\nupdated_at: 2026-03-21T10:00:00Z\n---\n\n# Jumped ahead\n',
		);

		const index2 = updateIndex(tasksDir);
		// Counter should be max(existing=2, scanned=10) + 1 = 11
		expect(index2.counters.FOO?.nextTaskNumber).toBe(11);
	});

	it("should rebuild counters when index file is missing", () => {
		createProject(tasksDir, "FOO");
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Task 1",
			reporter: "USER",
		});
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "MEDIUM",
			title: "Task 2",
			reporter: "USER",
		});

		// Build index, then delete it
		updateIndex(tasksDir);
		rmSync(join(tasksDir, "index.toon"));

		// Rebuild — should recover counter from scanning files
		const index = updateIndex(tasksDir);
		expect(index.counters.FOO?.nextTaskNumber).toBe(3);
	});

	it("should rebuild counter for a project missing from existing counters", () => {
		createProject(tasksDir, "FOO");
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Foo task",
			reporter: "USER",
		});

		// Build index with FOO counter
		const index1 = updateIndex(tasksDir);
		expect(index1.counters.FOO).toBeDefined();

		// Now add a BAR project out-of-band
		mkdirSync(join(tasksDir, "BAR"));
		writeFileSync(
			join(tasksDir, "BAR", "BAR-5.md"),
			'---\ntitle: "Bar task"\nstatus: NOT STARTED\nkind: TASK\npriority: LOW\nassignee: UNASSIGNED\nreporter: USER\ncreated_at: 2026-03-21T10:00:00Z\nupdated_at: 2026-03-21T10:00:00Z\n---\n\n# Bar task\n',
		);

		// Re-index — BAR counter should be rebuilt from scan
		const index2 = updateIndex(tasksDir);
		expect(index2.counters.BAR?.nextTaskNumber).toBe(6);
		// FOO counter should be preserved
		expect(index2.counters.FOO?.nextTaskNumber).toBe(2);
	});

	it("should not downgrade counter if a task file is removed (defensive — spec prohibits deletion)", () => {
		createProject(tasksDir, "FOO");
		const t1 = createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Task 1",
			reporter: "USER",
		});
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "MEDIUM",
			title: "Task 2",
			reporter: "USER",
		});

		const index1 = updateIndex(tasksDir);
		expect(index1.counters.FOO?.nextTaskNumber).toBe(3);

		// Delete task 2 — counter should NOT go back to 2
		rmSync(join(tasksDir, "FOO", "FOO-2.md"));

		const index2 = updateIndex(tasksDir);
		// Should still be 3 (preserved from existing index counter)
		expect(index2.counters.FOO?.nextTaskNumber).toBe(3);
	});
});
