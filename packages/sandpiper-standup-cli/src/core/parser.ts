export interface StandupSection {
  readonly id: string;
  readonly updated: string;
  readonly sessionFile: string;
  /**
   * Optional liveness anchor recorded directly on the section, independent of
   * sandpiper's own pidfile registry. Lets any harness (not just sandpiper's)
   * supply a portable liveness signal — a raw OS PID any caller can check with
   * `process.kill(pid, 0)`, no participation in sandpiper's pidfile directory
   * convention required. Absent for sections written without `--pid`.
   */
  readonly pid?: number;
  readonly body: string;
}

export interface ParsedStandup {
  readonly sections: readonly StandupSection[];
}

/**
 * Parse a standup markdown file into structured sections.
 * Handles both new multi-section format and legacy single-section format.
 */
export function parseStandup(content: string): ParsedStandup {
  const sections: StandupSection[] = [];

  if (!content.trim()) {
    return { sections: [] };
  }

  // Try to parse new format first (## <id> headers, with an optional legacy
  // "Session " prefix still accepted for files written before the header
  // format dropped it — new writes never emit the prefix, but old on-disk
  // sections must keep parsing).
  // New format takes precedence; any file with ## <id> headers is treated as new format.
  // Legacy content mixed with new format headers will be silently dropped (unlikely in practice).
  // Match section headers and capture everything until next header or end
  const lines = content.split('\n');
  let currentSection: {
    id: string;
    updated: string;
    sessionFile: string;
    pid?: number;
    bodyLines: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const sectionMatch = line.match(/^## (?:Session )?(\S+) \(Updated: ([^)]+)\)$/);

    if (sectionMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections.push({
          id: currentSection.id,
          updated: currentSection.updated,
          sessionFile: currentSection.sessionFile,
          pid: currentSection.pid,
          body: currentSection.bodyLines.join('\n').trim(),
        });
      }

      // Start new section
      currentSection = {
        id: sectionMatch[1] || '',
        updated: sectionMatch[2] || '',
        sessionFile: '',
        bodyLines: [],
      };

      // Look for session file on next non-empty line
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j] || '';
        if (!nextLine.trim()) continue; // Skip empty lines
        if (nextLine.startsWith('Session file:')) {
          currentSection.sessionFile = nextLine.replace('Session file:', '').trim();
          i = j; // Skip to session file line

          // Optional PID line, harness-agnostic liveness anchor — check the line
          // right after "Session file:" for it.
          for (let k = j + 1; k < lines.length; k++) {
            const pidLine = lines[k] || '';
            if (!pidLine.trim()) continue;
            if (pidLine.startsWith('PID:')) {
              const parsedPid = Number.parseInt(pidLine.replace('PID:', '').trim(), 10);
              if (!Number.isNaN(parsedPid)) {
                currentSection.pid = parsedPid;
              }
              i = k;
            }
            break;
          }
        }
        break;
      }
    } else if (currentSection) {
      currentSection.bodyLines.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection?.id && currentSection.updated) {
    sections.push({
      id: currentSection.id,
      updated: currentSection.updated,
      sessionFile: currentSection.sessionFile,
      pid: currentSection.pid,
      body: currentSection.bodyLines.join('\n').trim(),
    });
  }

  // If we found sections in new format, return them
  if (sections.length > 0) {
    return { sections };
  }

  // Fall back to legacy format parsing
  // Legacy format: # Session Stand-Up followed by Updated: line, then body content
  // Real legacy files don't have Session: or Session file: lines
  const legacyHeaderMatch = content.match(/^# Session Stand-Up\n\nUpdated: ([^\n]+)\n/);
  if (legacyHeaderMatch) {
    const updated = legacyHeaderMatch[1]?.trim() || '';
    // Extract everything after the header as the body
    const headerEndIndex = legacyHeaderMatch[0]?.length || 0;
    const body = content.slice(headerEndIndex).trim();

    if (body) {
      sections.push({
        id: 'unknown',
        updated,
        sessionFile: '',
        body,
      });
    }
  }

  return { sections };
}

/**
 * Serialize sections back to markdown format.
 */
export function serializeStandup(sections: readonly StandupSection[]): string {
  if (sections.length === 0) {
    return '# Session Stand-Up\n';
  }

  const parts = sections.map((section) => {
    const pidLine = section.pid !== undefined ? `\nPID: ${section.pid}` : '';
    return `## ${section.id} (Updated: ${section.updated})\n\nSession file: ${section.sessionFile}${pidLine}\n\n${section.body}`;
  });

  return `# Session Stand-Up\n\n${parts.join('\n\n')}\n`;
}
