import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyProjectMetadataUpdates,
  parseProjectMetadata,
  readProjectMetadata,
  renderProjectMetadataContent,
  updateProjectMetadata,
  writeProjectMetadata,
} from './project-metadata.js';

const BASE_OPTS = {
  key: 'FOO',
  name: 'Foo Project',
  description: 'A test project',
  whenToRead: 'Use for all Foo-related work',
};

// ─── renderProjectMetadataContent ─────────────────────────────────

describe('renderProjectMetadataContent', () => {
  it('should include all required frontmatter fields', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    expect(content).toContain('key: FOO');
    expect(content).toContain('name: "Foo Project"');
    expect(content).toContain('description: "A test project"');
    expect(content).toContain('when_to_read: "Use for all Foo-related work"');
    expect(content).toContain('status: active');
    expect(content).toMatch(/created_at: \d{4}-\d{2}-\d{2}T/);
  });

  it('should scaffold body sections', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    expect(content).toContain('# Foo Project');
    expect(content).toContain('## Purpose');
    expect(content).toContain('## Scope');
    expect(content).toContain('## Related Projects');
  });

  it('should open and close with frontmatter delimiters', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    const lines = content.split('\n');
    expect(lines[0]).toBe('---');
    // Second --- closes frontmatter
    const closingIdx = lines.indexOf('---', 1);
    expect(closingIdx).toBeGreaterThan(1);
  });
});

// ─── parseProjectMetadata ─────────────────────────────────────────

describe('parseProjectMetadata', () => {
  it('should parse all frontmatter fields', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    const meta = parseProjectMetadata(content);
    expect(meta).not.toBeNull();
    expect(meta?.key).toBe('FOO');
    expect(meta?.name).toBe('Foo Project');
    expect(meta?.description).toBe('A test project');
    expect(meta?.whenToRead).toBe('Use for all Foo-related work');
    expect(meta?.status).toBe('active');
    expect(meta?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should return null when key field is missing', () => {
    const content = '---\nname: "No Key"\n---\n\n# No Key\n';
    expect(parseProjectMetadata(content)).toBeNull();
  });

  it('should return null for content without frontmatter', () => {
    expect(parseProjectMetadata('# Just a heading\n')).toBeNull();
  });

  it('should fall back gracefully for optional missing fields', () => {
    const content = '---\nkey: BAR\n---\n\n# Bar\n';
    const meta = parseProjectMetadata(content);
    expect(meta).not.toBeNull();
    expect(meta?.key).toBe('BAR');
    expect(meta?.name).toBe('BAR'); // falls back to key
    expect(meta?.description).toBe('');
    expect(meta?.whenToRead).toBe('');
    expect(meta?.status).toBe('active');
  });

  it('should handle all project status values', () => {
    for (const status of ['active', 'archived', 'paused'] as const) {
      const content = `---\nkey: FOO\nstatus: ${status}\n---\n\n# Foo\n`;
      expect(parseProjectMetadata(content)?.status).toBe(status);
    }
  });
});

// ─── readProjectMetadata ──────────────────────────────────────────

describe('readProjectMetadata', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'project-meta-test-'));
    mkdirSync(join(tasksDir, 'FOO'));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should return null when PROJECT.md does not exist', () => {
    expect(readProjectMetadata(tasksDir, 'FOO')).toBeNull();
  });

  it('should read and parse an existing PROJECT.md', () => {
    writeProjectMetadata(tasksDir, BASE_OPTS);
    const meta = readProjectMetadata(tasksDir, 'FOO');
    expect(meta).not.toBeNull();
    expect(meta?.key).toBe('FOO');
    expect(meta?.name).toBe('Foo Project');
  });

  it('should return null for a project directory that does not exist', () => {
    expect(readProjectMetadata(tasksDir, 'MISSING')).toBeNull();
  });
});

// ─── writeProjectMetadata ─────────────────────────────────────────

describe('writeProjectMetadata', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'project-meta-test-'));
    mkdirSync(join(tasksDir, 'FOO'));
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should write a PROJECT.md file at the correct path', () => {
    writeProjectMetadata(tasksDir, BASE_OPTS);
    expect(existsSync(join(tasksDir, 'FOO', 'PROJECT.md'))).toBe(true);
  });

  it('should write parseable content', () => {
    writeProjectMetadata(tasksDir, BASE_OPTS);
    const raw = readFileSync(join(tasksDir, 'FOO', 'PROJECT.md'), 'utf-8');
    const meta = parseProjectMetadata(raw);
    expect(meta?.key).toBe('FOO');
    expect(meta?.whenToRead).toBe('Use for all Foo-related work');
  });
});

// ─── applyProjectMetadataUpdates ──────────────────────────────────

describe('applyProjectMetadataUpdates', () => {
  it('should update name and heading together', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    const updated = applyProjectMetadataUpdates(content, { name: 'New Name' });
    expect(updated).toContain('name: "New Name"');
    expect(updated).toContain('# New Name');
    expect(updated).not.toContain('name: "Foo Project"');
    expect(updated).not.toContain('# Foo Project');
  });

  it('should update description', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    const updated = applyProjectMetadataUpdates(content, { description: 'New description' });
    expect(updated).toContain('description: "New description"');
    expect(updated).not.toContain('description: "A test project"');
  });

  it('should update when_to_read', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    const updated = applyProjectMetadataUpdates(content, { whenToRead: 'Use for bar work only' });
    expect(updated).toContain('when_to_read: "Use for bar work only"');
    expect(updated).not.toContain('when_to_read: "Use for all Foo-related work"');
  });

  it('should update status', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    const updated = applyProjectMetadataUpdates(content, { status: 'archived' });
    expect(updated).toContain('status: archived');
    expect(updated).not.toContain('status: active');
  });

  it('should apply multiple updates at once', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    const updated = applyProjectMetadataUpdates(content, {
      name: 'Renamed',
      status: 'paused',
      whenToRead: 'Updated trigger',
    });
    expect(updated).toContain('name: "Renamed"');
    expect(updated).toContain('# Renamed');
    expect(updated).toContain('status: paused');
    expect(updated).toContain('when_to_read: "Updated trigger"');
  });

  it('should leave content unchanged when no fields provided', () => {
    const content = renderProjectMetadataContent(BASE_OPTS);
    expect(applyProjectMetadataUpdates(content, {})).toBe(content);
  });
});

// ─── updateProjectMetadata ────────────────────────────────────────

describe('updateProjectMetadata', () => {
  let tasksDir: string;

  beforeEach(() => {
    tasksDir = mkdtempSync(join(tmpdir(), 'project-meta-test-'));
    mkdirSync(join(tasksDir, 'FOO'));
    writeProjectMetadata(tasksDir, BASE_OPTS);
  });

  afterEach(() => {
    rmSync(tasksDir, { recursive: true, force: true });
  });

  it('should update fields on disk', () => {
    updateProjectMetadata(tasksDir, 'FOO', { name: 'Updated Name' });
    const meta = readProjectMetadata(tasksDir, 'FOO');
    expect(meta?.name).toBe('Updated Name');
  });

  it('should throw when PROJECT.md does not exist', () => {
    mkdirSync(join(tasksDir, 'BAR'));
    expect(() => updateProjectMetadata(tasksDir, 'BAR', { name: 'X' })).toThrow('PROJECT.md');
  });

  it('should preserve unchanged fields after update', () => {
    updateProjectMetadata(tasksDir, 'FOO', { status: 'archived' });
    const meta = readProjectMetadata(tasksDir, 'FOO');
    expect(meta?.name).toBe('Foo Project');
    expect(meta?.whenToRead).toBe('Use for all Foo-related work');
    expect(meta?.status).toBe('archived');
  });
});
