/**
 * Snapshot-diff output capture.
 *
 * Captures command output by diffing dump-screen snapshots taken before
 * and after command execution. The "command" parameter should be the full
 * injected text (e.g., `__relay_run 'escaped command'`) which serves as
 * a unique marker in the scrollback.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

/**
 * Extract the output of a command from before/after scrollback snapshots.
 *
 * Strategy:
 * 1. Find new content by diffing before/after line by line
 * 2. Join new content into a single string (handles viewport wrapping)
 * 3. Split on the injected command text — take the last segment
 * 4. Trim trailing prompt lines (matched from before snapshot)
 *
 * @param before - Scrollback snapshot taken before command injection
 * @param after - Scrollback snapshot taken after prompt_ready
 * @param injectedText - The full text that was pasted (e.g., `__relay_run 'cmd'`)
 * @returns The extracted command output (may be empty string)
 */
export function extractCommandOutput(before: string, after: string, injectedText: string): string {
  const beforeLines = normalizeLines(before);
  const afterLines = normalizeLines(after);

  // Find the divergence point
  const divergeIndex = findDivergencePoint(beforeLines, afterLines);
  const newLines = afterLines.slice(divergeIndex);
  if (newLines.length === 0) return '';

  // Join new lines without separator to handle viewport wrapping —
  // the command text may wrap across lines, but joining collapses that.
  const newTextJoined = newLines.map((l) => l.trimEnd()).join('');

  // Also collapse the injected text (remove any whitespace that wrapping added)
  const normalizedInjected = injectedText.trim();

  // Split on the injected command text — everything after the last
  // occurrence is the command output (plus trailing prompt)
  const parts = newTextJoined.split(normalizedInjected);
  if (parts.length < 2) {
    // Command marker not found — return all new content minus prompt
    return trimTrailingPrompt(newLines.join('\n'), beforeLines);
  }

  // The raw output is a single concatenated string. To restore line
  // structure, we match it back against the original newLines.
  // Find where the command echo ends in newLines and take everything after.
  const outputLines: string[] = [];
  let foundCommand = false;
  let accumulator = '';
  for (let i = 0; i < newLines.length; i++) {
    accumulator += newLines[i]?.trimEnd() ?? '';
    if (!foundCommand && accumulator.includes(normalizedInjected)) {
      // This line (or accumulated lines up to here) contains the end of the command.
      // The output portion of this line is everything after the command marker.
      const lineJoinedSoFar = newLines
        .slice(0, i + 1)
        .map((l) => l.trimEnd())
        .join('');
      const markerEnd = lineJoinedSoFar.indexOf(normalizedInjected) + normalizedInjected.length;
      const remainder = lineJoinedSoFar.slice(markerEnd);
      if (remainder.length > 0) {
        outputLines.push(remainder);
      }
      // All subsequent lines are output
      outputLines.push(...newLines.slice(i + 1));
      foundCommand = true;
      break;
    }
  }

  if (!foundCommand) {
    return trimTrailingPrompt(newLines.join('\n'), beforeLines);
  }

  // Trim trailing prompt from the output lines
  return trimTrailingPrompt(outputLines.join('\n'), beforeLines);
}

/**
 * Remove trailing prompt lines from output text.
 * Matches against the last non-empty lines of the before snapshot.
 */
function trimTrailingPrompt(text: string, beforeLines: string[]): string {
  // Collect prompt patterns from the end of the "before" snapshot
  const promptLines = new Set<string>();
  for (let i = beforeLines.length - 1; i >= 0 && promptLines.size < 5; i--) {
    const line = beforeLines[i]?.trim() ?? '';
    if (line.length > 0) {
      promptLines.add(line);
    }
  }

  const lines = text.split('\n');
  let endIndex = lines.length;

  // Strip trailing empty lines
  while (endIndex > 0 && (lines[endIndex - 1]?.trim() ?? '') === '') {
    endIndex--;
  }

  // Strip trailing lines that match prompt patterns
  while (endIndex > 0 && promptLines.has(lines[endIndex - 1]?.trim() ?? '')) {
    endIndex--;
  }

  return lines
    .slice(0, endIndex)
    .map((l) => l.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Find the first index where afterLines diverges from beforeLines.
 */
function findDivergencePoint(beforeLines: string[], afterLines: string[]): number {
  for (let i = 0; i < afterLines.length; i++) {
    if (i >= beforeLines.length || afterLines[i] !== beforeLines[i]) {
      return i;
    }
  }
  return afterLines.length;
}

/**
 * Normalize a scrollback dump into clean lines.
 */
function normalizeLines(dump: string): string[] {
  const lines = dump.split('\n').map((line) => line.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}
