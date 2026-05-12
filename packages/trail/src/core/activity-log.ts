/**
 * Activity log for task files.
 *
 * Format: appended to the end of the task file, separated by a `---` delimiter:
 *
 * ```markdown
 * ---
 *
 * # Activity Log
 *
 * ## 2026-03-21T22:00:00-05:00
 *
 * - **status**: NOT STARTED → IN PROGRESS
 * - **assignee**: UNASSIGNED → AGENT
 *
 * ## 2026-03-21T23:30:00-05:00
 *
 * - **priority**: HIGH → LOW
 * ```
 */

export interface FieldChange {
  readonly field: string;
  readonly from: string | undefined;
  readonly to: string;
}

export interface ActivityEntry {
  readonly timestamp: string;
  readonly changes: readonly FieldChange[];
}

const ACTIVITY_LOG_DELIMITER = '\n---\n\n# Activity Log\n';

/**
 * Extract activity log entries from a task file's content.
 */
export function extractActivityLog(content: string): readonly ActivityEntry[] {
  const delimIdx = content.indexOf('---\n\n# Activity Log');
  if (delimIdx === -1) return [];

  // Skip the frontmatter --- at line 0
  const afterFrontmatter = content.indexOf('---', 3);
  if (delimIdx <= afterFrontmatter) return [];

  const logSection = content.slice(delimIdx);
  const entries: ActivityEntry[] = [];
  const entryPattern = /^## (.+)$/gm;
  let match: RegExpExecArray | null;
  const positions: { timestamp: string; start: number }[] = [];

  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((match = entryPattern.exec(logSection)) !== null) {
    // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by pattern
    positions.push({ timestamp: match[1]!, start: match.index });
  }

  for (let i = 0; i < positions.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: loop bounded by positions.length
    const pos = positions[i]!;
    const nextStart = positions[i + 1]?.start ?? logSection.length;
    const body = logSection.slice(pos.start + `## ${pos.timestamp}`.length, nextStart);

    const changes: FieldChange[] = [];
    const changePattern = /^- \*\*(.+?)\*\*: (.+)$/gm;
    let changeMatch: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
    while ((changeMatch = changePattern.exec(body)) !== null) {
      // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by pattern
      const field = changeMatch[1]!;
      // biome-ignore lint/style/noNonNullAssertion: regex capture group guaranteed by pattern
      const valueStr = changeMatch[2]!;

      if (valueStr === 'updated') {
        changes.push({ field, from: undefined, to: 'updated' });
      } else {
        const arrowIdx = valueStr.indexOf(' → ');
        if (arrowIdx !== -1) {
          changes.push({
            field,
            from: valueStr.slice(0, arrowIdx),
            to: valueStr.slice(arrowIdx + 3),
          });
        } else {
          changes.push({ field, from: undefined, to: valueStr });
        }
      }
    }

    entries.push({ timestamp: pos.timestamp, changes });
  }

  return entries;
}

/**
 * Format a single activity log entry as markdown.
 */
export function formatActivityEntry(timestamp: string, changes: readonly FieldChange[]): string {
  const lines = [`## ${timestamp}`, ''];
  for (const change of changes) {
    if (change.from !== undefined) {
      lines.push(`- **${change.field}**: ${change.from} → ${change.to}`);
    } else {
      lines.push(`- **${change.field}**: ${change.to}`);
    }
  }
  return lines.join('\n');
}

/**
 * Append an activity log entry to a task file's content.
 * Creates the activity log section if it doesn't exist.
 */
export function appendActivityEntry(content: string, changes: readonly FieldChange[]): string {
  if (changes.length === 0) return content;

  const timestamp = new Date().toISOString();
  const entry = formatActivityEntry(timestamp, changes);

  const delimIdx = findActivityLogDelimiter(content);
  if (delimIdx === -1) {
    // No activity log yet — append delimiter + header + entry
    // Ensure content ends with a newline before the delimiter
    const base = content.endsWith('\n') ? content : `${content}\n`;
    return `${base}${ACTIVITY_LOG_DELIMITER}\n${entry}\n`;
  }

  // Append to existing activity log
  const beforeEnd = content.trimEnd();
  return `${beforeEnd}\n\n${entry}\n`;
}

/**
 * Find the position of the activity log delimiter, skipping the frontmatter delimiter.
 */
function findActivityLogDelimiter(content: string): number {
  // The frontmatter has --- at position 0 and a closing --- somewhere after.
  // The activity log delimiter is any --- after the frontmatter closing.
  const firstClose = content.indexOf('---', 3);
  if (firstClose === -1) return -1;

  const logDelim = content.indexOf('---\n\n# Activity Log', firstClose + 3);
  return logDelim;
}
