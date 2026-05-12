import { encode } from '@toon-format/toon';
import type { ProjectListItem, Task } from './types.js';

export type OutputFormat = 'raw' | 'json' | 'toon';

/**
 * Serialize an array of tasks to the specified format.
 */
export function formatTasksOutput(tasks: readonly Task[], format: 'json' | 'toon'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(tasks, null, 2);
    case 'toon':
      return encode(tasks);
  }
}

/**
 * Format raw file contents for stdout output.
 * Single files are output as-is. Multiple files get path headers.
 */
export function formatRawOutput(files: readonly { path: string; content: string }[]): string {
  if (files.length === 1) {
    // biome-ignore lint/style/noNonNullAssertion: we have validated the length precondition
    return files[0]!.content;
  }

  return files.map((f) => `── ${f.path} ${'─'.repeat(Math.max(0, 60 - f.path.length))}\n${f.content}`).join('\n');
}

/**
 * Serialize an array of project list items to the specified format.
 */
export function formatProjectsOutput(projects: readonly ProjectListItem[], format: 'json' | 'toon'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(projects, null, 2);
    case 'toon':
      return encode(projects);
  }
}

/**
 * Extract just the YAML frontmatter block from a markdown file's raw content.
 * Returns the content between the opening and closing `---` delimiters (inclusive).
 * If no frontmatter is found, returns the original content unchanged.
 */
export function extractFrontmatter(content: string): string {
  const lines = content.split('\n');
  if (lines[0]?.trim() !== '---') return content;

  const closeIdx = lines.indexOf('---', 1);
  if (closeIdx === -1) return content;

  return `${lines.slice(0, closeIdx + 1).join('\n')}\n`;
}
