import { describe, expect, it } from "vitest";
import {
	getBlocked,
	getBlockers,
	getDependencies,
	getDependents,
	getSubtasks,
	getTask,
	queryTasks,
} from "./query.js";
import type { Task } from "./types.js";

// ─── Test Fixtures ───────────────────────────────────────────────

function makeTask(overrides: Partial<Task> & { key: string }): Task {
	return {
		project: overrides.key.split("-")[0]!,
		title: `Task ${overrides.key}`,
		status: "NOT STARTED",
		kind: "TASK",
		priority: "MEDIUM",
		assignee: "UNASSIGNED",
		reporter: "USER",
		createdAt: "2026-03-20T15:00:00Z",
		updatedAt: "2026-03-20T15:00:00Z",
		dependsOn: [],
		blockedBy: [],
		related: [],
		...overrides,
	};
}

const FIXTURE_TASKS: readonly Task[] = [
	makeTask({
		key: "SHR-1",
		title: "Fish integration",
		status: "NEEDS REVIEW",
		kind: "TASK",
		priority: "HIGH",
		assignee: "AGENT",
		reporter: "USER",
	}),
	makeTask({
		key: "SHR-2",
		title: "Fish prompt hook",
		status: "NEEDS REVIEW",
		kind: "SUBTASK",
		priority: "HIGH",
		parent: "SHR-1",
		assignee: "AGENT",
	}),
	makeTask({
		key: "SHR-3",
		title: "Fish wrapper fn",
		status: "NEEDS REVIEW",
		kind: "SUBTASK",
		priority: "HIGH",
		parent: "SHR-1",
		assignee: "AGENT",
	}),
	makeTask({
		key: "SHR-4",
		title: "Enter key binding",
		status: "NOT STARTED",
		kind: "SUBTASK",
		priority: "MEDIUM",
		parent: "SHR-1",
	}),
	makeTask({
		key: "SHR-5",
		title: "FIFO manager",
		status: "IN PROGRESS",
		kind: "TASK",
		priority: "HIGH",
		assignee: "AGENT",
		dependsOn: ["SHR-1"],
	}),
	makeTask({
		key: "SHR-6",
		title: "Signal bug",
		status: "NOT STARTED",
		kind: "BUG",
		priority: "HIGH",
		blockedBy: ["SHR-5"],
		related: ["SHR-1"],
	}),
	makeTask({
		key: "SHR-7",
		title: "Docs",
		status: "NOT STARTED",
		kind: "TASK",
		priority: "LOW",
		reporter: "AGENT",
	}),
	makeTask({
		key: "CLI-1",
		title: "CLI scaffold",
		status: "COMPLETE",
		kind: "TASK",
		priority: "MEDIUM",
		assignee: "USER",
		reporter: "USER",
		createdAt: "2026-03-19T10:00:00Z",
	}),
	makeTask({
		key: "CLI-2",
		title: "CLI tests",
		status: "IN PROGRESS",
		kind: "TASK",
		priority: "HIGH",
		assignee: "AGENT",
		createdAt: "2026-03-21T10:00:00Z",
		updatedAt: "2026-03-21T12:00:00Z",
	}),
];

// ─── Filtering ───────────────────────────────────────────────────

describe("queryTasks filtering", () => {
	it("should return all tasks when no filter is provided", () => {
		const result = queryTasks(FIXTURE_TASKS);
		expect(result).toHaveLength(FIXTURE_TASKS.length);
	});

	describe("by project", () => {
		it("should filter by single project", () => {
			const result = queryTasks(FIXTURE_TASKS, { project: "SHR" });
			expect(result).toHaveLength(7);
			expect(result.every((t) => t.project === "SHR")).toBe(true);
		});

		it("should filter by multiple projects (OR)", () => {
			const result = queryTasks(FIXTURE_TASKS, { project: ["SHR", "CLI"] });
			expect(result).toHaveLength(9);
		});
	});

	describe("by status", () => {
		it("should filter by single status", () => {
			const result = queryTasks(FIXTURE_TASKS, { status: "NOT STARTED" });
			expect(result.every((t) => t.status === "NOT STARTED")).toBe(true);
		});

		it("should filter by multiple statuses (OR)", () => {
			const result = queryTasks(FIXTURE_TASKS, {
				status: ["IN PROGRESS", "NEEDS REVIEW"],
			});
			expect(
				result.every(
					(t) => t.status === "IN PROGRESS" || t.status === "NEEDS REVIEW",
				),
			).toBe(true);
		});
	});

	describe("by kind", () => {
		it("should filter by TASK", () => {
			const result = queryTasks(FIXTURE_TASKS, { kind: "TASK" });
			expect(result.every((t) => t.kind === "TASK")).toBe(true);
		});

		it("should filter by BUG", () => {
			const result = queryTasks(FIXTURE_TASKS, { kind: "BUG" });
			expect(result).toHaveLength(1);
			expect(result[0]?.key).toBe("SHR-6");
		});

		it("should filter by SUBTASK", () => {
			const result = queryTasks(FIXTURE_TASKS, { kind: "SUBTASK" });
			expect(result).toHaveLength(3);
		});
	});

	describe("by priority", () => {
		it("should filter by HIGH priority", () => {
			const result = queryTasks(FIXTURE_TASKS, { priority: "HIGH" });
			expect(result.every((t) => t.priority === "HIGH")).toBe(true);
		});

		it("should filter by multiple priorities (OR)", () => {
			const result = queryTasks(FIXTURE_TASKS, { priority: ["HIGH", "LOW"] });
			expect(
				result.every((t) => t.priority === "HIGH" || t.priority === "LOW"),
			).toBe(true);
		});
	});

	describe("by assignee", () => {
		it("should filter by AGENT", () => {
			const result = queryTasks(FIXTURE_TASKS, { assignee: "AGENT" });
			expect(result.every((t) => t.assignee === "AGENT")).toBe(true);
		});

		it("should filter by UNASSIGNED", () => {
			const result = queryTasks(FIXTURE_TASKS, { assignee: "UNASSIGNED" });
			expect(result.every((t) => t.assignee === "UNASSIGNED")).toBe(true);
		});
	});

	describe("by reporter", () => {
		it("should filter by AGENT reporter", () => {
			const result = queryTasks(FIXTURE_TASKS, { reporter: "AGENT" });
			expect(result).toHaveLength(1);
			expect(result[0]?.key).toBe("SHR-7");
		});
	});

	describe("by parent / isSubtask", () => {
		it("should filter subtasks of a specific parent", () => {
			const result = queryTasks(FIXTURE_TASKS, { parent: "SHR-1" });
			expect(result).toHaveLength(3);
			expect(result.every((t) => t.parent === "SHR-1")).toBe(true);
		});

		it("should filter to subtasks only", () => {
			const result = queryTasks(FIXTURE_TASKS, { isSubtask: true });
			expect(result).toHaveLength(3);
			expect(result.every((t) => t.parent !== undefined)).toBe(true);
		});

		it("should filter to top-level only", () => {
			const result = queryTasks(FIXTURE_TASKS, { isSubtask: false });
			expect(result.every((t) => t.parent === undefined)).toBe(true);
		});
	});

	describe("by relationships", () => {
		it("should filter by dependsOn", () => {
			const result = queryTasks(FIXTURE_TASKS, { dependsOn: "SHR-1" });
			expect(result).toHaveLength(1);
			expect(result[0]?.key).toBe("SHR-5");
		});

		it("should filter by blockedBy", () => {
			const result = queryTasks(FIXTURE_TASKS, { blockedBy: "SHR-5" });
			expect(result).toHaveLength(1);
			expect(result[0]?.key).toBe("SHR-6");
		});

		it("should filter by relatedTo", () => {
			const result = queryTasks(FIXTURE_TASKS, { relatedTo: "SHR-1" });
			expect(result).toHaveLength(1);
			expect(result[0]?.key).toBe("SHR-6");
		});

		it("should filter by linkedTo (any relationship)", () => {
			const result = queryTasks(FIXTURE_TASKS, { linkedTo: "SHR-1" });
			// SHR-5 depends on SHR-1, SHR-6 is related to SHR-1
			expect(result).toHaveLength(2);
			const keys = result.map((t) => t.key);
			expect(keys).toContain("SHR-5");
			expect(keys).toContain("SHR-6");
		});
	});

	describe("combined filters (AND)", () => {
		it("should AND project + status", () => {
			const result = queryTasks(FIXTURE_TASKS, {
				project: "SHR",
				status: "NOT STARTED",
			});
			expect(
				result.every((t) => t.project === "SHR" && t.status === "NOT STARTED"),
			).toBe(true);
		});

		it("should AND kind + priority + assignee", () => {
			const result = queryTasks(FIXTURE_TASKS, {
				kind: "TASK",
				priority: "HIGH",
				assignee: "AGENT",
			});
			expect(result).toHaveLength(3);
			// SHR-1 (NEEDS REVIEW, AGENT), SHR-5 (IN PROGRESS, AGENT), CLI-2 (IN PROGRESS, AGENT)
			const keys = result.map((t) => t.key);
			expect(keys).toContain("SHR-1");
			expect(keys).toContain("SHR-5");
			expect(keys).toContain("CLI-2");
		});

		it("should AND project + isSubtask=false + priority", () => {
			const result = queryTasks(FIXTURE_TASKS, {
				project: "SHR",
				isSubtask: false,
				priority: "HIGH",
			});
			// SHR-1 (TASK), SHR-5 (TASK), SHR-6 (BUG) — all HIGH, top-level, SHR
			expect(result).toHaveLength(3);
		});
	});
});

// ─── Sorting ─────────────────────────────────────────────────────

describe("queryTasks sorting", () => {
	it("should sort by priority ascending", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, {
			sort: { field: "priority", order: "asc" },
		});
		const priorities = result.map((t) => t.priority);
		for (let i = 1; i < priorities.length; i++) {
			const prev = ["LOW", "MEDIUM", "HIGH"].indexOf(priorities[i - 1]!);
			const curr = ["LOW", "MEDIUM", "HIGH"].indexOf(priorities[i]!);
			expect(prev).toBeLessThanOrEqual(curr);
		}
	});

	it("should sort by priority descending", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, {
			sort: { field: "priority", order: "desc" },
		});
		const priorities = result.map((t) => t.priority);
		for (let i = 1; i < priorities.length; i++) {
			const prev = ["LOW", "MEDIUM", "HIGH"].indexOf(priorities[i - 1]!);
			const curr = ["LOW", "MEDIUM", "HIGH"].indexOf(priorities[i]!);
			expect(prev).toBeGreaterThanOrEqual(curr);
		}
	});

	it("should sort by status", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, {
			sort: { field: "status", order: "asc" },
		});
		const statuses = result.map((t) => t.status);
		const order = ["NOT STARTED", "IN PROGRESS", "NEEDS REVIEW", "COMPLETE"];
		for (let i = 1; i < statuses.length; i++) {
			expect(order.indexOf(statuses[i - 1]!)).toBeLessThanOrEqual(
				order.indexOf(statuses[i]!),
			);
		}
	});

	it("should sort by key", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, {
			sort: { field: "key", order: "asc" },
		});
		const keys = result.map((t) => t.key);
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
	});

	it("should sort by createdAt", () => {
		const result = queryTasks(
			FIXTURE_TASKS,
			{ project: "CLI" },
			{ sort: { field: "createdAt", order: "asc" } },
		);
		expect(result[0]?.key).toBe("CLI-1");
		expect(result[1]?.key).toBe("CLI-2");
	});

	it("should support multi-field sort", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, {
			sort: [
				{ field: "priority", order: "desc" },
				{ field: "status", order: "asc" },
			],
		});
		// HIGH priority tasks first, then within same priority, by status
		expect(result[0]?.priority).toBe("HIGH");
	});

	it("should default to ascending order", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, {
			sort: { field: "key" },
		});
		const keys = result.map((t) => t.key);
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
	});
});

// ─── Pagination ──────────────────────────────────────────────────

describe("queryTasks pagination", () => {
	it("should limit results", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, { limit: 3 });
		expect(result).toHaveLength(3);
	});

	it("should offset results", () => {
		const sorted = queryTasks(FIXTURE_TASKS, undefined, {
			sort: { field: "key" },
		});
		const offset = queryTasks(FIXTURE_TASKS, undefined, {
			sort: { field: "key" },
			offset: 2,
		});
		expect(offset[0]?.key).toBe(sorted[2]?.key);
	});

	it("should combine offset and limit", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, {
			sort: { field: "key" },
			offset: 1,
			limit: 2,
		});
		expect(result).toHaveLength(2);
	});

	it("should return empty array if offset exceeds length", () => {
		const result = queryTasks(FIXTURE_TASKS, undefined, { offset: 100 });
		expect(result).toHaveLength(0);
	});
});

// ─── Lookup Functions ────────────────────────────────────────────

describe("getTask", () => {
	it("should return a task by key", () => {
		const task = getTask(FIXTURE_TASKS, "SHR-1");
		expect(task).toBeDefined();
		expect(task?.title).toBe("Fish integration");
	});

	it("should return undefined for nonexistent key", () => {
		expect(getTask(FIXTURE_TASKS, "SHR-99")).toBeUndefined();
	});
});

describe("getSubtasks", () => {
	it("should return all subtasks of a parent", () => {
		const subs = getSubtasks(FIXTURE_TASKS, "SHR-1");
		expect(subs).toHaveLength(3);
		expect(subs.every((t) => t.parent === "SHR-1")).toBe(true);
	});

	it("should return empty for a task with no subtasks", () => {
		expect(getSubtasks(FIXTURE_TASKS, "SHR-7")).toHaveLength(0);
	});
});

describe("getDependencies", () => {
	it("should return tasks that the given task depends on", () => {
		const deps = getDependencies(FIXTURE_TASKS, "SHR-5");
		expect(deps).toHaveLength(1);
		expect(deps[0]?.key).toBe("SHR-1");
	});

	it("should return empty for a task with no dependencies", () => {
		expect(getDependencies(FIXTURE_TASKS, "SHR-1")).toHaveLength(0);
	});

	it("should return empty for nonexistent task", () => {
		expect(getDependencies(FIXTURE_TASKS, "XXX-1")).toHaveLength(0);
	});
});

describe("getDependents", () => {
	it("should return tasks that depend on the given task", () => {
		const dependents = getDependents(FIXTURE_TASKS, "SHR-1");
		expect(dependents).toHaveLength(1);
		expect(dependents[0]?.key).toBe("SHR-5");
	});
});

describe("getBlockers", () => {
	it("should return tasks that are blocking the given task", () => {
		const blockers = getBlockers(FIXTURE_TASKS, "SHR-6");
		expect(blockers).toHaveLength(1);
		expect(blockers[0]?.key).toBe("SHR-5");
	});

	it("should return empty for unblocked task", () => {
		expect(getBlockers(FIXTURE_TASKS, "SHR-1")).toHaveLength(0);
	});
});

describe("getBlocked", () => {
	it("should return tasks that the given task is blocking", () => {
		const blocked = getBlocked(FIXTURE_TASKS, "SHR-5");
		expect(blocked).toHaveLength(1);
		expect(blocked[0]?.key).toBe("SHR-6");
	});
});
