/**
 * Snapshot-diff output capture.
 *
 * Captures command output by diffing dump-screen snapshots taken before
 * and after command execution. Works with narrow viewports (e.g., 50-col
 * Zellij background sessions) where lines may wrap.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

/**
 * Extract the output of a command from before/after scrollback snapshots.
 *
 * Strategy: find the new content in "after" that wasn't in "before",
 * then strip the command echo from the beginning and the prompt from
 * the end. Uses line-by-line comparison for the diff, then marker-based
 * extraction for the output boundaries.
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

  // Find the output boundaries within the new content.
  // Join all new lines into a single string for marker-based extraction.
  // This handles viewport wrapping gracefully — wrapped lines are just
  // concatenated, and we search for markers in the joined text.
  const newText = newLines.map((l) => l.trimEnd()).join('\n');

  // Find the command echo. The command appears after being echoed by the shell.
  // In narrow viewports, the command wraps across lines, so we normalize
  // whitespace (collapse newlines and spaces) when searching.
  const commandNormalized = command.trim();
  let outputStartPos = 0;

  // Collapse whitespace in both the new text and command for matching
  const newTextCollapsed = newText.replace(/\s+/g, ' ');
  const cmdCollapsed = commandNormalized.replace(/\s+/g, ' ');

  const cmdIndex = newTextCollapsed.indexOf(cmdCollapsed);
  if (cmdIndex >= 0) {
    // Map back from collapsed position to original position.
    // Find the end of the command in the original text by counting
    // through characters, skipping whitespace differences.
    const endInCollapsed = cmdIndex + cmdCollapsed.length;

    // Walk through original text to find the position that corresponds
    // to endInCollapsed in the collapsed version
    let collapsedPos = 0;
    let originalPos = 0;
    let inWhitespace = false;
    for (originalPos = 0; originalPos < newText.length && collapsedPos < endInCollapsed; originalPos++) {
      const ch = newText[originalPos];
      if (ch === ' ' || ch === '\n' || ch === '\t') {
        if (!inWhitespace) {
          collapsedPos++; // One space in collapsed for each whitespace run
          inWhitespace = true;
        }
      } else {
        collapsedPos++;
        inWhitespace = false;
      }
    }

    // Find the next newline after the command ends in the original text
    const afterCmd = newText.indexOf('\n', originalPos);
    if (afterCmd >= 0) {
      outputStartPos = afterCmd + 1;
    } else {
      return '';
    }
  }

  // Extract from after the command echo to end of new content
  const output = newText.slice(outputStartPos);

  // Trim trailing prompt lines by matching against the before snapshot's
  // last non-empty lines (the prompt pattern)
  const promptLines = new Set<string>();
  for (let i = beforeLines.length - 1; i >= 0 && promptLines.size < 5; i--) {
    const line = beforeLines[i]?.trim() ?? '';
    if (line.length > 0) {
      promptLines.add(line);
    }
  }

  // Strip trailing empty lines, then trailing prompt lines
  const outputLines = output.split('\n');
  let endIndex = outputLines.length;

  while (endIndex > 0 && (outputLines[endIndex - 1]?.trim() ?? '') === '') {
    endIndex--;
  }
  while (endIndex > 0 && promptLines.has(outputLines[endIndex - 1]?.trim() ?? '')) {
    endIndex--;
  }

  return outputLines
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
