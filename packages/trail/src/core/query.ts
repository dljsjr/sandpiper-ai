/**
 * Task Query API
 *
 * Designed against the task management specification (SPEC.md) without
 * assumptions about how tasks are stored or indexed. The API operates
 * on a flat array of Task objects and provides filtering, sorting, and
 * relationship traversal.
 */

import type { Task, TaskAssignee, TaskKind, TaskPriority, TaskReporter, TaskResolution, TaskStatus } from './types.js';

// ─── Query Filter ────────────────────────────────────────────────
// Each field accepts a single value or an array of values (OR semantics).
// Multiple fields are AND'd together.

export interface TaskFilter {
  /** Match tasks in this project (or any of these projects). */
  readonly project?: string | readonly string[];
  /** Match tasks with this status (or any of these statuses). */
  readonly status?: TaskStatus | readonly TaskStatus[];
  /** Match tasks of this kind (or any of these kinds). */
  readonly kind?: TaskKind | readonly TaskKind[];
  /** Match tasks with this priority (or any of these priorities). */
  readonly priority?: TaskPriority | readonly TaskPriority[];
  /** Match tasks with this assignee (or any of these assignees). */
  readonly assignee?: TaskAssignee | readonly TaskAssignee[];
  /** Match tasks with this reporter (or any of these reporters). */
  readonly reporter?: TaskReporter | readonly TaskReporter[];
  /** Match subtasks of this parent (exact key). */
  readonly parent?: string;
  /** true = subtasks only, false = top-level only, undefined = both. */
  readonly isSubtask?: boolean;
  /** Match tasks that depend on this key (this key appears in their dependsOn). */
  readonly dependsOn?: string;
  /** Match tasks blocked by this key (this key appears in their blockedBy). */
  readonly blockedBy?: string;
  /** Match tasks related to this key (this key appears in their related). */
  readonly relatedTo?: string;
  /** Match tasks whose dependsOn, blockedBy, or related includes this key. */
  readonly linkedTo?: string;
  /** Match tasks with this resolution (or any of these resolutions). */
  readonly resolution?: TaskResolution | readonly TaskResolution[];
  /** Restrict results to this set of task keys (used for search pre-filtering). */
  readonly keys?: ReadonlySet<string>;
}

// ─── Sort ────────────────────────────────────────────────────────

export type SortField = 'key' | 'priority' | 'status' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

export interface SortSpec {
  readonly field: SortField;
  readonly order?: SortOrder;
}

// ─── Query Options ───────────────────────────────────────────────

export interface QueryOptions {
  readonly sort?: SortSpec | readonly SortSpec[];
  readonly limit?: number;
  readonly offset?: number;
}

// ─── Priority/Status ordinals for sorting ────────────────────────

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

const STATUS_ORDER: Record<TaskStatus, number> = {
  'NOT STARTED': 0,
  'IN PROGRESS': 1,
  'NEEDS REVIEW': 2,
  COMPLETE: 3,
};

// ─── Query Function ─────────────────────────────────────────────

/**
 * Query a collection of tasks with optional filtering, sorting, and pagination.
 *
 * Filters are AND'd: a task must match ALL specified filter fields.
 * Within a single filter field, multiple values are OR'd: a task matches
 * if it matches ANY of the specified values.
 */
export function queryTasks(tasks: readonly Task[], filter?: TaskFilter, options?: QueryOptions): readonly Task[] {
  let result = filter ? tasks.filter((task) => matchesFilter(task, filter)) : [...tasks];

  if (options?.sort) {
    const sorts = Array.isArray(options.sort) ? options.sort : [options.sort];
    result = [...result].sort((a, b) => compareMulti(a, b, sorts as SortSpec[]));
  }

  if (options?.offset) {
    result = result.slice(options.offset);
  }

  if (options?.limit !== undefined) {
    result = result.slice(0, options.limit);
  }

  return result;
}

/**
 * Get a single task by key. Returns undefined if not found.
 */
export function getTask(tasks: readonly Task[], key: string): Task | undefined {
  return tasks.find((t) => t.key === key);
}

/**
 * Get all subtasks of a given parent task.
 */
export function getSubtasks(tasks: readonly Task[], parentKey: string): readonly Task[] {
  return tasks.filter((t) => t.parent === parentKey);
}

/**
 * Get all tasks that the given task depends on (its prerequisites).
 */
export function getDependencies(tasks: readonly Task[], key: string): readonly Task[] {
  const task = getTask(tasks, key);
  if (!task) return [];
  return tasks.filter((t) => task.dependsOn.includes(t.key));
}

/**
 * Get all tasks that depend on the given task (its dependents).
 */
export function getDependents(tasks: readonly Task[], key: string): readonly Task[] {
  return tasks.filter((t) => t.dependsOn.includes(key));
}

/**
 * Get all tasks that are blocking the given task.
 */
export function getBlockers(tasks: readonly Task[], key: string): readonly Task[] {
  const task = getTask(tasks, key);
  if (!task) return [];
  return tasks.filter((t) => task.blockedBy.includes(t.key));
}

/**
 * Get all tasks that the given task is blocking.
 */
export function getBlocked(tasks: readonly Task[], key: string): readonly Task[] {
  return tasks.filter((t) => t.blockedBy.includes(key));
}

// ─── Internals ───────────────────────────────────────────────────

type ScalarFilterKey = 'project' | 'status' | 'kind' | 'priority' | 'assignee' | 'reporter';
type RelationFilterKey = 'dependsOn' | 'blockedBy' | 'relatedTo';
type TaskRelationKey = 'dependsOn' | 'blockedBy' | 'related';

const SCALAR_FILTERS: ReadonlyArray<{ readonly filterKey: ScalarFilterKey; readonly taskKey: ScalarFilterKey }> = [
  { filterKey: 'project', taskKey: 'project' },
  { filterKey: 'status', taskKey: 'status' },
  { filterKey: 'kind', taskKey: 'kind' },
  { filterKey: 'priority', taskKey: 'priority' },
  { filterKey: 'assignee', taskKey: 'assignee' },
  { filterKey: 'reporter', taskKey: 'reporter' },
];

const RELATION_FILTERS: ReadonlyArray<{
  readonly filterKey: RelationFilterKey;
  readonly taskKey: TaskRelationKey;
}> = [
  { filterKey: 'dependsOn', taskKey: 'dependsOn' },
  { filterKey: 'blockedBy', taskKey: 'blockedBy' },
  { filterKey: 'relatedTo', taskKey: 'related' },
];

function matchesFilter(task: Task, filter: TaskFilter): boolean {
  if (!matchesKeySet(task, filter)) return false;
  if (!matchesScalarFilters(task, filter)) return false;
  if (!matchesResolutionFilter(task, filter)) return false;
  if (!matchesParentFilter(task, filter)) return false;
  if (!matchesSubtaskFilter(task, filter)) return false;
  if (!matchesRelationFilters(task, filter)) return false;
  if (!matchesLinkedFilter(task, filter)) return false;

  return true;
}

function matchesKeySet(task: Task, filter: TaskFilter): boolean {
  return filter.keys === undefined || filter.keys.has(task.key);
}

function matchesScalarFilters(task: Task, filter: TaskFilter): boolean {
  for (const { filterKey, taskKey } of SCALAR_FILTERS) {
    if (!matchesOptionalStringValue(task[taskKey], filter[filterKey])) {
      return false;
    }
  }
  return true;
}

function matchesResolutionFilter(task: Task, filter: TaskFilter): boolean {
  if (filter.resolution === undefined) {
    return true;
  }
  return task.resolution !== undefined && matchesValue(task.resolution, filter.resolution);
}

function matchesParentFilter(task: Task, filter: TaskFilter): boolean {
  return filter.parent === undefined || task.parent === filter.parent;
}

function matchesSubtaskFilter(task: Task, filter: TaskFilter): boolean {
  if (filter.isSubtask === undefined) {
    return true;
  }
  return filter.isSubtask ? task.parent !== undefined : task.parent === undefined;
}

function matchesRelationFilters(task: Task, filter: TaskFilter): boolean {
  for (const { filterKey, taskKey } of RELATION_FILTERS) {
    const key = filter[filterKey];
    if (key !== undefined && !task[taskKey].includes(key)) {
      return false;
    }
  }
  return true;
}

function matchesLinkedFilter(task: Task, filter: TaskFilter): boolean {
  if (filter.linkedTo === undefined) {
    return true;
  }

  const key = filter.linkedTo;
  return task.dependsOn.includes(key) || task.blockedBy.includes(key) || task.related.includes(key);
}

function matchesOptionalStringValue(value: string, filterValue: string | readonly string[] | undefined): boolean {
  return filterValue === undefined || matchesValue(value, filterValue);
}

function matchesValue<T>(value: T, filterValue: T | readonly T[]): boolean {
  if (Array.isArray(filterValue)) {
    return filterValue.includes(value);
  }
  return value === filterValue;
}

function compareMulti(a: Task, b: Task, sorts: readonly SortSpec[]): number {
  for (const sort of sorts) {
    const cmp = compareField(a, b, sort.field);
    if (cmp !== 0) {
      return sort.order === 'desc' ? -cmp : cmp;
    }
  }
  return 0;
}

function compareField(a: Task, b: Task, field: SortField): number {
  switch (field) {
    case 'key':
      return a.key.localeCompare(b.key);
    case 'priority':
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    case 'status':
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case 'createdAt':
      return a.createdAt.localeCompare(b.createdAt);
    case 'updatedAt':
      return a.updatedAt.localeCompare(b.updatedAt);
  }
}
