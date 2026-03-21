/**
 * Core domain types for the task management system.
 *
 * These types are the canonical definitions — used by both the Query API
 * and the index. They are derived from the task management specification
 * (SPEC.md), not from any storage format.
 */

// ─── Domain Enums ────────────────────────────────────────────────

export type TaskStatus =
	| "NOT STARTED"
	| "IN PROGRESS"
	| "NEEDS REVIEW"
	| "COMPLETE";
export type TaskKind = "TASK" | "BUG" | "SUBTASK";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";
export type TaskAssignee = "UNASSIGNED" | "USER" | "AGENT";
export type TaskReporter = "USER" | "AGENT";

/** Resolution value — required when status is COMPLETE. */
export type TaskResolution = "DONE" | "WONTFIX";

// ─── Domain Model ────────────────────────────────────────────────

/** A task as understood by the domain. This is the canonical task shape. */
export interface Task {
	readonly key: string;
	readonly project: string;
	readonly title: string;
	readonly status: TaskStatus;
	readonly kind: TaskKind;
	readonly priority: TaskPriority;
	readonly assignee: TaskAssignee;
	readonly reporter: TaskReporter;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly parent?: string;
	/** Required when status is COMPLETE. */
	readonly resolution?: TaskResolution;
	readonly dependsOn: readonly string[];
	readonly blockedBy: readonly string[];
	readonly related: readonly string[];
}

// ─── Index Types ─────────────────────────────────────────────────
// These extend the domain model with index-specific metadata.

/** A task entry in the index. Extends the domain Task with indexing metadata. */
export interface IndexedTask extends Task {
	/** Unix epoch ms timestamp of when this task was last indexed. */
	readonly lastIndexedAt: number;
}

/** Per-project counter state stored in the index. */
export interface ProjectCounter {
	readonly projectKey: string;
	readonly nextTaskNumber: number;
}

/** The top-level index structure, serialized to index.toon. */
export interface TaskIndex {
	readonly version: number;
	readonly lastUpdatedAt: number;
	readonly tasks: Record<string, IndexedTask>;
	readonly counters: Record<string, ProjectCounter>;
}
