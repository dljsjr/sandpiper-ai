/**
 * Snapshot-diff output capture.
 *
 * Captures command output by diffing dump-screen snapshots taken before
 * and after command execution. The diff extracts only the new content
 * produced by the command, stripping the command echo and trailing prompt.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

/**
 * Extract the output of a command from before/after scrollback snapshots.
 *
 * Strategy:
 * 1. Find the divergence point between before and after snapshots
 * 2. In the new content, find and skip the command echo
 * 3. Trim the trailing prompt (matches the prompt from the before snapshot)
 * 4. Return the content between command echo and trailing prompt
 *
 * @param before - Scrollback snapshot taken before command injection
 * @param after - Scrollback snapshot taken after prompt_ready
 * @param command - The command that was injected (used to identify the echo)
 * @returns The extracted command output (may be empty string)
 */
export function extractCommandOutput(before: string, after: string, command: string): string {
  const beforeLines = normalizeLines(before);
  const afterLines = normalizeLines(after);

  // Find the divergence point — where "after" starts differing from "before"
  const divergeIndex = findDivergencePoint(beforeLines, afterLines);

  // Everything from the divergence point onward is new content
  const newLines = afterLines.slice(divergeIndex);
  if (newLines.length === 0) return '';

  // Find where the command echo ends and output begins
  const outputStart = findOutputStart(newLines, command);

  // Find where output ends and the trailing prompt begins
  const outputEnd = findOutputEnd(newLines, outputStart, beforeLines);

  // Extract and clean the output
  const outputLines = newLines.slice(outputStart, outputEnd);
  return outputLines
    .map((line) => line.trimEnd())
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
 * Find where the command output starts (after the command echo).
 *
 * The shell echoes the command before executing it. This may span multiple
 * lines if the terminal is narrow. We concatenate the first few new lines
 * and look for the command text as a substring of the concatenation.
 * Once we've accumulated enough text to contain the full command, the
 * next line is where output begins.
 */
function findOutputStart(newLines: string[], command: string): number {
  const commandNormalized = command.trim();
  if (commandNormalized.length === 0) return 0;

  // Concatenate lines progressively until we find the command text.
  // The command echo may wrap across multiple narrow viewport lines,
  // so we accumulate until the full command is found.
  let accumulated = '';
  for (let i = 0; i < Math.min(newLines.length, 10); i++) {
    const line = newLines[i]?.trim() ?? '';
    accumulated += line;

    if (accumulated.includes(commandNormalized)) {
      // Found the full command text — output starts after this line
      return i + 1;
    }
  }

  // Command text not found in first 10 lines — skip nothing
  return 0;
}

/**
 * Find where the command output ends (before the trailing prompt).
 *
 * The trailing prompt is identified by matching against the last few
 * non-empty lines of the "before" snapshot, since the prompt repeats
 * after every command.
 */
function findOutputEnd(newLines: string[], outputStart: number, beforeLines: string[]): number {
  // Collect the prompt pattern from the end of the "before" snapshot.
  // The last few non-empty lines before the command are the prompt.
  const promptLines = new Set<string>();
  for (let i = beforeLines.length - 1; i >= 0 && promptLines.size < 5; i--) {
    const line = beforeLines[i]?.trim() ?? '';
    if (line.length > 0) {
      promptLines.add(line);
    }
  }

  if (promptLines.size === 0) return newLines.length;

  // Trim from the end: remove empty lines, then remove any lines that
  // match prompt lines from the "before" snapshot.
  let endIndex = newLines.length;

  // Strip trailing empty lines
  while (endIndex > outputStart && (newLines[endIndex - 1]?.trim() ?? '') === '') {
    endIndex--;
  }

  // Strip trailing prompt lines
  while (endIndex > outputStart && promptLines.has(newLines[endIndex - 1]?.trim() ?? '')) {
    endIndex--;
  }

  return endIndex;
}

/**
 * Normalize a scrollback dump into clean lines.
 */
function normalizeLines(dump: string): string[] {
  const lines = dump.split('\n').map((line) => line.trimEnd());
  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}
