import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.js';
import { writeFileAtomic } from './fs.js';
import { PROJECT_METADATA_FILENAME } from './patterns.js';
import type { ProjectMetadata, ProjectStatus } from './types.js';

// ─── Types ────────────────────────────────────────────────────────

export interface CreateProjectMetadataOptions {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly whenToRead: string;
}

export interface UpdateProjectMetadataFields {
  readonly name?: string;
  readonly description?: string;
  readonly whenToRead?: string;
  readonly status?: ProjectStatus;
}

// ─── Rendering ────────────────────────────────────────────────────

/**
 * Render the full content of a PROJECT.md file from its options.
 * Produces frontmatter + scaffolded markdown body sections.
 */
export function renderProjectMetadataContent(opts: CreateProjectMetadataOptions): string {
  const ts = new Date().toISOString();
  return [
    '---',
    `key: ${opts.key}`,
    `name: "${opts.name}"`,
    `description: "${opts.description}"`,
    `when_to_read: "${opts.whenToRead}"`,
    'status: active',
    `created_at: ${ts}`,
    '---',
    '',
    `# ${opts.name}`,
    '',
    '## Purpose',
    '',
    '',
    '',
    '## Scope',
    '',
    '',
    '',
    '## Related Projects',
    '',
    '',
    '',
  ].join('\n');
}

// ─── Parsing ──────────────────────────────────────────────────────

/**
 * Parse a PROJECT.md file's content into a ProjectMetadata object.
 * Returns null if the content is missing the required `key` field.
 */
export function parseProjectMetadata(content: string): ProjectMetadata | null {
  const fm = parseFrontmatter(content);
  const str = (v: string | string[] | undefined, fallback: string): string => (typeof v === 'string' ? v : fallback);

  const key = str(fm.key, '');
  if (!key) return null;

  return {
    key,
    name: str(fm.name, key),
    description: str(fm.description, ''),
    whenToRead: str(fm.when_to_read, ''),
    status: str(fm.status, 'active') as ProjectStatus,
    createdAt: str(fm.created_at, ''),
  };
}

// ─── Disk I/O ─────────────────────────────────────────────────────

/**
 * Read and parse the PROJECT.md for a given project key.
 * Returns null if the file does not exist or cannot be parsed.
 */
export function readProjectMetadata(tasksDir: string, projectKey: string): ProjectMetadata | null {
  const metaPath = join(tasksDir, projectKey, PROJECT_METADATA_FILENAME);
  if (!existsSync(metaPath)) return null;
  try {
    return parseProjectMetadata(readFileSync(metaPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Write a new PROJECT.md for a project.
 * The project directory must already exist.
 */
export function writeProjectMetadata(tasksDir: string, opts: CreateProjectMetadataOptions): void {
  const metaPath = join(tasksDir, opts.key, PROJECT_METADATA_FILENAME);
  writeFileAtomic(metaPath, renderProjectMetadataContent(opts));
}

// ─── Updates ──────────────────────────────────────────────────────

/**
 * Apply field updates to a PROJECT.md content string (in memory).
 * Returns the modified content without writing to disk.
 */
export function applyProjectMetadataUpdates(content: string, fields: UpdateProjectMetadataFields): string {
  let result = content;

  if (fields.name !== undefined) {
    result = result.replace(/^name: .+$/m, `name: "${fields.name}"`);
    result = result.replace(/^# .+$/m, `# ${fields.name}`);
  }
  if (fields.description !== undefined) {
    result = result.replace(/^description: .+$/m, `description: "${fields.description}"`);
  }
  if (fields.whenToRead !== undefined) {
    result = result.replace(/^when_to_read: .+$/m, `when_to_read: "${fields.whenToRead}"`);
  }
  if (fields.status !== undefined) {
    result = result.replace(/^status: .+$/m, `status: ${fields.status}`);
  }

  return result;
}

/**
 * Update fields in an existing PROJECT.md on disk.
 * Throws if PROJECT.md does not exist for the given project.
 */
export function updateProjectMetadata(tasksDir: string, projectKey: string, fields: UpdateProjectMetadataFields): void {
  const metaPath = join(tasksDir, projectKey, PROJECT_METADATA_FILENAME);
  if (!existsSync(metaPath)) {
    throw new Error(
      `No PROJECT.md found for project "${projectKey}". ` + `Run 'project create ${projectKey}' to initialize it.`,
    );
  }
  const content = readFileSync(metaPath, 'utf-8');
  writeFileAtomic(metaPath, applyProjectMetadataUpdates(content, fields));
}
