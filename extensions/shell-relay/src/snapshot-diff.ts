/**
 * Snapshot-diff output capture.
 *
 * Captures command output by diffing dump-screen snapshots taken before
 * and after command execution. The diff extracts only the new content
 * produced by the command, stripping prompt decorations and prior history.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */

/**
 * Extract the output of a command from before/after scrollback snapshots.
 *
 * Strategy: the "after" snapshot contains everything from "before" plus:
 * 1. The command itself (as echoed by the shell)
 * 2. The command's output
 * 3. A new prompt
 *
 * We find where the new content starts by locating the divergence point
 * between the two snapshots, then trim the command echo and trailing prompt.
 *
 * @param before - Scrollback snapshot taken before command injection
 * @param after - Scrollback snapshot taken after prompt_ready
 * @param command - The command that was injected (used to identify and skip the echo)
 * @returns The extracted command output (may be empty string)
 */
export function extractCommandOutput(before: string, after: string, command: string): string {
  const beforeLines = normalizeLines(before);
  const afterLines = normalizeLines(after);

  // Find the first line in "after" that diverges from "before".
  // This is where the injected command starts appearing.
  let divergeIndex = 0;
  for (let i = 0; i < afterLines.length; i++) {
    if (i >= beforeLines.length || afterLines[i] !== beforeLines[i]) {
      divergeIndex = i;
      break;
    }
    divergeIndex = i + 1;
  }

  // Everything from the divergence point onward is new content
  const newLines = afterLines.slice(divergeIndex);
  if (newLines.length === 0) return '';

  // Skip the command echo — the shell prints the command before executing it.
  // The command may wrap across multiple lines in the viewport, so we need to
  // match it flexibly. We strip the lines that contain the command text.
  const commandNormalized = command.trim();
  let outputStartIndex = 0;
  let accumulated = '';

  for (let i = 0; i < newLines.length; i++) {
    accumulated += (accumulated ? '' : '') + newLines[i]?.trim();
    // Check if we've accumulated enough to contain the full command
    if (accumulated.includes(commandNormalized) || i > 5) {
      // Found the command echo — output starts after this line
      outputStartIndex = accumulated.includes(commandNormalized) ? i + 1 : 0;
      break;
    }
  }

  // Trim trailing lines that appeared after the output — these are the new
  // prompt and any decorations. We know the "before" snapshot ended with a
  // prompt, so we find lines at the end of "newLines" that match lines from
  // the end of "beforeLines" (prompt pattern repeats). We also trim trailing
  // empty lines.
  //
  // Simple approach: the prompt_ready signal tells us the command is done,
  // so everything after the last line of actual output is prompt. We trim
  // from the end, removing empty lines and then the prompt block.
  // The prompt block is identified by comparing against the last non-empty
  // lines of the "before" snapshot (which was just a prompt).
  const beforePromptLines = beforeLines.slice(-5).filter((l) => l.trim() !== '');
  let outputEndIndex = newLines.length;
  // First strip trailing empty lines
  while (outputEndIndex > outputStartIndex && (newLines[outputEndIndex - 1]?.trim() ?? '') === '') {
    outputEndIndex--;
  }
  // Then strip lines that match the prompt pattern from "before"
  // Walk backward, checking if each line matches any prompt line
  while (outputEndIndex > outputStartIndex) {
    const line = newLines[outputEndIndex - 1]?.trim() ?? '';
    if (beforePromptLines.some((pl) => pl.trim() === line)) {
      outputEndIndex--;
    } else {
      break;
    }
  }

  const outputLines = newLines.slice(outputStartIndex, outputEndIndex);

  // Trim trailing whitespace from each line and join
  return outputLines
    .map((line) => line?.trimEnd() ?? '')
    .join('\n')
    .trim();
}

/**
 * Normalize a scrollback dump into clean lines.
 * Strips trailing whitespace and filters empty trailing lines.
 */
function normalizeLines(dump: string): string[] {
  const lines = dump.split('\n').map((line) => line.trimEnd());
  // Remove trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}
