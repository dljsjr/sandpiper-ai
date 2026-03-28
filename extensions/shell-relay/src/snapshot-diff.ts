/**
 * Snapshot-diff output capture.
 *
 * Captures command output by diffing dump-screen snapshots taken before
 * and after command execution. The "injectedText" parameter should be the
 * full text that was pasted (e.g., `__relay_run 'escaped command'`) which
 * serves as a unique split marker in the scrollback.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

/**
 * Extract the output of a command from before/after scrollback snapshots.
 *
 * Strategy:
 * 1. Find new content by diffing before/after
 * 2. Join new lines without separator to find the command marker
 *    (handles viewport wrapping where command spans multiple lines)
 * 3. Map the marker position back to the original line array
 * 4. Take all lines after the command echo
 * 5. Trim trailing prompt lines
 *
 * @param before - Scrollback snapshot taken before command injection
 * @param after - Scrollback snapshot taken after prompt_ready
 * @param injectedText - The full text that was pasted (e.g., `__relay_run 'cmd'`)
 * @returns The extracted command output (may be empty string)
 */
export function extractCommandOutput(before: string, after: string, injectedText: string): string {
  const beforeLines = normalizeLines(before);
  const afterLines = normalizeLines(after);

  // Find new content
  const divergeIndex = findDivergencePoint(beforeLines, afterLines);
  const newLines = afterLines.slice(divergeIndex);
  if (newLines.length === 0) return '';

  // Join without separator to find the marker regardless of wrapping
  const joined = newLines.map((l) => l.trimEnd()).join('');
  const marker = injectedText.trim();
  const markerEnd = joined.indexOf(marker);

  if (markerEnd < 0) {
    // Marker not found — return new content minus prompt
    return trimTrailingPrompt(newLines, beforeLines);
  }

  // Find which original line the marker ends on by walking through
  // accumulated character counts
  const endPos = markerEnd + marker.length;
  let charCount = 0;
  let outputStartLine = 0;
  for (let i = 0; i < newLines.length; i++) {
    charCount += (newLines[i]?.trimEnd() ?? '').length;
    if (charCount >= endPos) {
      // Marker ends on this line. Check if there's leftover text on this
      // line after the marker (output starting on the same line).
      const overshoot = charCount - endPos;
      if (overshoot > 0) {
        // There's output text on the same line as the command echo end.
        // Extract just that trailing portion.
        const fullLine = newLines[i]?.trimEnd() ?? '';
        const trailing = fullLine.slice(fullLine.length - overshoot);
        const remainingLines = [trailing, ...newLines.slice(i + 1)];
        return trimTrailingPrompt(remainingLines, beforeLines);
      }
      // Marker ends exactly at the end of this line
      outputStartLine = i + 1;
      break;
    }
  }

  const outputLines = newLines.slice(outputStartLine);
  return trimTrailingPrompt(outputLines, beforeLines);
}

/**
 * Remove trailing prompt lines from output.
 */
function trimTrailingPrompt(lines: string[], beforeLines: string[]): string {
  // Collect prompt lines from end of before snapshot
  const promptLines = new Set<string>();
  for (let i = beforeLines.length - 1; i >= 0 && promptLines.size < 5; i--) {
    const line = beforeLines[i]?.trim() ?? '';
    if (line.length > 0) {
      promptLines.add(line);
    }
  }

  let endIndex = lines.length;

  // Strip trailing empty lines
  while (endIndex > 0 && (lines[endIndex - 1]?.trim() ?? '') === '') {
    endIndex--;
  }

  // Strip trailing lines matching prompt patterns
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
