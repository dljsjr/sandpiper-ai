import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './fs.js';

/**
 * Write a unified diff of a task file change to the history directory.
 *
 * History files are stored at:
 *   .sandpiper/tasks/history/<KEY>/<TIMESTAMP>.diff
 *
 * @param tasksDir - Path to the .sandpiper/tasks directory
 * @param key - Task key (e.g., "SHR-1")
 * @param oldContent - File content before the change
 * @param newContent - File content after the change
 * @param timestamp - ISO timestamp for the diff filename
 */
export function writeDiff(
  tasksDir: string,
  key: string,
  oldContent: string,
  newContent: string,
  timestamp: string,
): void {
  if (oldContent === newContent) return;

  const histDir = join(tasksDir, 'history', key);
  mkdirSync(histDir, { recursive: true });

  const diff = generateUnifiedDiff(key, oldContent, newContent);
  // Sanitize timestamp for filename (replace colons for Windows compat)
  const safeTs = timestamp.replace(/:/g, '-');

  // Ensure unique filename (append counter if collision)
  let filename = `${safeTs}.diff`;
  let counter = 1;
  while (existsSync(join(histDir, filename))) {
    filename = `${safeTs}-${counter}.diff`;
    counter++;
  }

  writeFileAtomic(join(histDir, filename), diff);
}

/**
 * Generate a unified diff between two strings.
 * Simple line-by-line diff without external dependencies.
 */
function generateUnifiedDiff(name: string, oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const hunks = computeHunks(oldLines, newLines);
  if (hunks.length === 0) return '';

  const lines: string[] = [`--- a/${name}.md`, `+++ b/${name}.md`];

  for (const hunk of hunks) {
    lines.push(`@@ -${hunk.oldStart + 1},${hunk.oldCount} +${hunk.newStart + 1},${hunk.newCount} @@`);
    for (const line of hunk.lines) {
      lines.push(line);
    }
  }

  return `${lines.join('\n')}\n`;
}

interface Hunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: string[];
}

/**
 * Compute diff hunks between two line arrays.
 * Uses a simple LCS-based approach with context lines.
 */
function computeHunks(oldLines: string[], newLines: string[], contextSize = 3): Hunk[] {
  // Find changed regions
  const changes = findChanges(oldLines, newLines);
  if (changes.length === 0) return [];

  // Group changes into hunks with context
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;

  for (const change of changes) {
    const contextStart = Math.max(0, change.oldStart - contextSize);
    const contextEnd = Math.min(oldLines.length, change.oldStart + change.oldCount + contextSize);

    if (currentHunk && contextStart <= currentHunk.oldStart + currentHunk.oldCount) {
      // Merge with current hunk
      extendHunk(currentHunk, change, oldLines, newLines, contextEnd);
    } else {
      // Start new hunk
      currentHunk = createHunk(change, oldLines, newLines, contextStart, contextEnd);
      hunks.push(currentHunk);
    }
  }

  return hunks;
}

interface Change {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
}

const MAX_DIFF_LOOKAHEAD = 20;

interface SyncPointMatch {
  nextOld: number;
  nextNew: number;
  change: Change;
}

function findSyncPoint(
  oldLines: string[],
  newLines: string[],
  oldIndex: number,
  newIndex: number,
  maxLookAhead: number,
): SyncPointMatch | undefined {
  for (let ahead = 1; ahead < maxLookAhead; ahead++) {
    if (oldIndex + ahead < oldLines.length && oldLines[oldIndex + ahead] === newLines[newIndex]) {
      return {
        nextOld: oldIndex + ahead,
        nextNew: newIndex,
        change: {
          oldStart: oldIndex,
          oldCount: ahead,
          newStart: newIndex,
          newCount: 0,
        },
      };
    }

    if (newIndex + ahead < newLines.length && oldLines[oldIndex] === newLines[newIndex + ahead]) {
      return {
        nextOld: oldIndex,
        nextNew: newIndex + ahead,
        change: {
          oldStart: oldIndex,
          oldCount: 0,
          newStart: newIndex,
          newCount: ahead,
        },
      };
    }
  }

  return undefined;
}

/**
 * Find changed regions between two line arrays.
 */
function findChanges(oldLines: string[], newLines: string[]): Change[] {
  const changes: Change[] = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++;
      j++;
      continue;
    }

    const syncPoint = findSyncPoint(oldLines, newLines, i, j, MAX_DIFF_LOOKAHEAD);
    if (syncPoint) {
      changes.push(syncPoint.change);
      i = syncPoint.nextOld;
      j = syncPoint.nextNew;
      continue;
    }

    changes.push({
      oldStart: i,
      oldCount: i < oldLines.length ? 1 : 0,
      newStart: j,
      newCount: j < newLines.length ? 1 : 0,
    });
    if (i < oldLines.length) i++;
    if (j < newLines.length) j++;
  }

  return mergeChanges(changes);
}

function mergeChanges(changes: Change[]): Change[] {
  if (changes.length === 0) return [];

  // biome-ignore lint/style/noNonNullAssertion: guarded by length check above
  const merged: Change[] = [{ ...changes[0]! }];

  for (let i = 1; i < changes.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: merged always has at least one element
    const prev = merged[merged.length - 1]!;
    // biome-ignore lint/style/noNonNullAssertion: loop bounded by changes.length
    const curr = changes[i]!;

    if (curr.oldStart <= prev.oldStart + prev.oldCount + 1 && curr.newStart <= prev.newStart + prev.newCount + 1) {
      // Adjacent — merge
      const oldEnd = Math.max(prev.oldStart + prev.oldCount, curr.oldStart + curr.oldCount);
      const newEnd = Math.max(prev.newStart + prev.newCount, curr.newStart + curr.newCount);
      prev.oldCount = oldEnd - prev.oldStart;
      prev.newCount = newEnd - prev.newStart;
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}

function createHunk(
  change: Change,
  oldLines: string[],
  newLines: string[],
  contextStart: number,
  contextEnd: number,
): Hunk {
  const lines: string[] = [];
  const newContextEnd = Math.min(
    newLines.length,
    change.newStart + change.newCount + (contextEnd - change.oldStart - change.oldCount),
  );

  // Leading context
  for (let k = contextStart; k < change.oldStart; k++) {
    lines.push(` ${oldLines[k]}`);
  }
  // Removed lines
  for (let k = change.oldStart; k < change.oldStart + change.oldCount; k++) {
    lines.push(`-${oldLines[k]}`);
  }
  // Added lines
  for (let k = change.newStart; k < change.newStart + change.newCount; k++) {
    lines.push(`+${newLines[k]}`);
  }
  // Trailing context
  const trailingStart = change.oldStart + change.oldCount;
  for (let k = trailingStart; k < contextEnd; k++) {
    lines.push(` ${oldLines[k]}`);
  }

  return {
    oldStart: contextStart,
    oldCount: contextEnd - contextStart,
    newStart: Math.max(0, change.newStart - (change.oldStart - contextStart)),
    newCount: newContextEnd - Math.max(0, change.newStart - (change.oldStart - contextStart)),
    lines,
  };
}

function extendHunk(hunk: Hunk, change: Change, oldLines: string[], newLines: string[], contextEnd: number): void {
  const gapStart = hunk.oldStart + hunk.oldCount;

  // Context between previous end and new change
  for (let k = gapStart; k < change.oldStart; k++) {
    hunk.lines.push(` ${oldLines[k]}`);
  }
  // Removed lines
  for (let k = change.oldStart; k < change.oldStart + change.oldCount; k++) {
    hunk.lines.push(`-${oldLines[k]}`);
  }
  // Added lines
  for (let k = change.newStart; k < change.newStart + change.newCount; k++) {
    hunk.lines.push(`+${newLines[k]}`);
  }
  // Trailing context
  const trailingStart = change.oldStart + change.oldCount;
  for (let k = trailingStart; k < contextEnd; k++) {
    hunk.lines.push(` ${oldLines[k]}`);
  }

  hunk.oldCount = contextEnd - hunk.oldStart;
  hunk.newCount += change.newCount - change.oldCount + (contextEnd - trailingStart);
}
