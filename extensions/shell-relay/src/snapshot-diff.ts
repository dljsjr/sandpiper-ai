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

  // Find the command echo and skip past it.
  // The command is wrapped by __relay_run, so look for that marker first.
  // If not found (e.g., raw command injection), fall back to searching
  // for the command text with whitespace normalization.
  const commandNormalized = command.trim();
  let outputStartPos = 0;

  // Strategy 1: Look for __relay_run marker in newLines
  // The __relay_run echo may span multiple wrapped lines. Find the first
  // line containing __relay_run, then skip forward until we find a line
  // that doesn't look like part of the command echo (doesn't contain
  // the command text or the closing quote).
  const relayRunIndex = newLines.findIndex((l) => l.includes('__relay_run'));
  if (relayRunIndex >= 0) {
    // Skip all lines that are part of the command echo.
    // The command echo ends when we hit a line that is NOT part of the
    // __relay_run invocation. We use the closing quote as a signal —
    // scan forward until we pass a line ending with ' (the closing quote
    // of the shell-escaped command).
    let echoEnd = relayRunIndex + 1;
    for (let i = relayRunIndex; i < newLines.length && i < relayRunIndex + 10; i++) {
      echoEnd = i + 1;
      const line = newLines[i] ?? '';
      // If this line ends with the closing quote of __relay_run 'cmd',
      // the command echo is complete
      if (line.trimEnd().endsWith("'")) {
        break;
      }
    }
    // Convert line index back to position in newText
    outputStartPos = newLines.slice(0, echoEnd).join('\n').length + 1;
    if (outputStartPos > newText.length) outputStartPos = newText.length;
  } else {
    // Strategy 2: No __relay_run marker — search for command text directly
    const newTextCollapsed = newText.replace(/\s+/g, ' ');
    const cmdCollapsed = commandNormalized.replace(/\s+/g, ' ');
    const cmdIndex = newTextCollapsed.indexOf(cmdCollapsed);
    if (cmdIndex >= 0) {
      // Find the end of the line containing the last part of the command
      const endInCollapsed = cmdIndex + cmdCollapsed.length;
      let collapsedPos = 0;
      let originalPos = 0;
      let inWhitespace = false;
      for (originalPos = 0; originalPos < newText.length && collapsedPos < endInCollapsed; originalPos++) {
        const ch = newText[originalPos];
        if (ch === ' ' || ch === '\n' || ch === '\t') {
          if (!inWhitespace) {
            collapsedPos++;
            inWhitespace = true;
          }
        } else {
          collapsedPos++;
          inWhitespace = false;
        }
      }
      const afterCmd = newText.indexOf('\n', originalPos);
      if (afterCmd >= 0) {
        outputStartPos = afterCmd + 1;
      } else {
        return '';
      }
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
