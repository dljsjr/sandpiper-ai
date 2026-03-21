import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encode } from "@toon-format/toon";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadIndex, updateIndex } from "./index-update.js";
import { createProject, createTask } from "./mutate.js";
import { CURRENT_SCHEMA_VERSION, migrateIndex } from "./schema.js";
import type { TaskIndex } from "./types.js";

describe("Schema versioning", () => {
	let tasksDir: string;

	beforeEach(() => {
		tasksDir = mkdtempSync(join(tmpdir(), "schema-test-"));
	});

	afterEach(() => {
		rmSync(tasksDir, { recursive: true, force: true });
	});

	it("should write the current schema version when creating a new index", () => {
		createProject(tasksDir, "FOO");
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Test",
			reporter: "USER",
		});

		const index = updateIndex(tasksDir);
		expect(index.version).toBe(CURRENT_SCHEMA_VERSION);
	});

	it("should load an index with the current version without migration", () => {
		createProject(tasksDir, "FOO");
		createTask(tasksDir, {
			project: "FOO",
			kind: "TASK",
			priority: "HIGH",
			title: "Test",
			reporter: "USER",
		});
		updateIndex(tasksDir);

		const loaded = loadIndex(tasksDir);
		expect(loaded).not.toBeNull();
		expect(loaded!.version).toBe(CURRENT_SCHEMA_VERSION);
	});

	it("should reject an index with an unsupported future version", () => {
		const futureIndex = {
			version: 999,
			lastUpdatedAt: Date.now(),
			tasks: {},
		};
		writeFileSync(join(tasksDir, "index.toon"), encode(futureIndex));

		expect(() => loadIndex(tasksDir)).toThrow("unsupported");
	});

	it("should migrate a v1 index to the current version", () => {
		// Write a v1 index directly
		const v1Index = {
			version: 1,
			lastUpdatedAt: Date.now(),
			tasks: {
				"FOO-1": {
					key: "FOO-1",
					project: "FOO",
					title: "Old task",
					status: "NOT STARTED",
					kind: "TASK",
					priority: "HIGH",
					assignee: "UNASSIGNED",
					reporter: "USER",
					createdAt: "2026-03-20T15:00:00Z",
					updatedAt: "2026-03-20T15:00:00Z",
					dependsOn: [],
					blockedBy: [],
					related: [],
					lastIndexedAt: 1234567890,
				},
			},
		};

		const migrated = migrateIndex(v1Index as unknown as TaskIndex);
		expect(migrated.version).toBe(CURRENT_SCHEMA_VERSION);
		expect(migrated.tasks["FOO-1"]).toBeDefined();
		expect(migrated.tasks["FOO-1"]!.title).toBe("Old task");
	});

	it("should handle an index with no version field (pre-versioning)", () => {
		const noVersion = {
			lastUpdatedAt: Date.now(),
			tasks: {
				"FOO-1": {
					key: "FOO-1",
					project: "FOO",
					title: "Legacy task",
					status: "COMPLETE",
					kind: "TASK",
					priority: "LOW",
					assignee: "USER",
					reporter: "USER",
					createdAt: "2026-03-20T15:00:00Z",
					updatedAt: "2026-03-20T15:00:00Z",
					dependsOn: [],
					blockedBy: [],
					related: [],
					lastIndexedAt: 1234567890,
				},
			},
		};
		writeFileSync(join(tasksDir, "index.toon"), encode(noVersion));

		// Should treat as v1 and migrate
		const loaded = loadIndex(tasksDir);
		expect(loaded).not.toBeNull();
		expect(loaded!.version).toBe(CURRENT_SCHEMA_VERSION);
	});
});
