import type { TaskIndex } from './types.js';

/**
 * Current schema version for the index file format.
 * Increment this when making breaking changes to the index structure.
 */
export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Maximum schema version we know how to read.
 * If an index has a version higher than this, we can't safely load it.
 */
const MAX_SUPPORTED_VERSION = CURRENT_SCHEMA_VERSION;

/**
 * Validate and extract the schema version from a raw decoded index.
 * Throws if the version is unsupported.
 */
export function validateSchemaVersion(raw: Record<string, unknown>): number {
  const version = typeof raw.version === 'number' ? raw.version : 1;

  if (version > MAX_SUPPORTED_VERSION) {
    throw new Error(
      `Index schema version ${version} is unsupported. ` +
        `This CLI supports up to version ${MAX_SUPPORTED_VERSION}. ` +
        `Please update the tasks CLI.`,
    );
  }

  return version;
}

/**
 * Migrate an index from its current version to the current schema version.
 * Each migration step transforms the data incrementally.
 *
 * If the index is already at the current version, returns it as-is.
 */
export function migrateIndex(index: TaskIndex): TaskIndex {
  const version = index.version ?? 1;

  // Already at current version with explicit version field — no migration needed
  if (version === CURRENT_SCHEMA_VERSION && 'version' in index && index.version !== undefined) {
    return index;
  }

  // Either needs migration or needs the version field stamped
  const migrated = { ...index } as Record<string, unknown>;

  // Migration chain: each case falls through to the next
  // When adding a new version, add a case here:
  //
  // if (version === 1) {
  //   migrated = migrateV1toV2(migrated);
  //   version = 2;
  // }
  // if (version === 2) {
  //   migrated = migrateV2toV3(migrated);
  //   version = 3;
  // }

  migrated.version = CURRENT_SCHEMA_VERSION;
  return migrated as unknown as TaskIndex;
}
