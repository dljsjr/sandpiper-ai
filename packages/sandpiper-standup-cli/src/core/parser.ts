export interface StandupSection {
  readonly uuid: string;
  readonly updated: string;
  readonly sessionFile: string;
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

  // Try to parse new format first (## Session <uuid> headers)
  // New format takes precedence; any file with ## Session headers is treated as new format.
  // Legacy content mixed with new format headers will be silently dropped (unlikely in practice).
  // Match section headers and capture everything until next header or end
  const lines = content.split('\n');
  let currentSection: {
    uuid: string;
    updated: string;
    sessionFile: string;
    bodyLines: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || '';
    const sectionMatch = line.match(/^## Session (\S+) \(Updated: ([^)]+)\)$/);

    if (sectionMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections.push({
          uuid: currentSection.uuid,
          updated: currentSection.updated,
          sessionFile: currentSection.sessionFile,
          body: currentSection.bodyLines.join('\n').trim(),
        });
      }

      // Start new section
      currentSection = {
        uuid: sectionMatch[1] || '',
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
        }
        break;
      }
    } else if (currentSection) {
      currentSection.bodyLines.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection?.uuid && currentSection.updated) {
    sections.push({
      uuid: currentSection.uuid,
      updated: currentSection.updated,
      sessionFile: currentSection.sessionFile,
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
        uuid: 'unknown',
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
    return `## Session ${section.uuid} (Updated: ${section.updated})\n\nSession file: ${section.sessionFile}\n\n${section.body}`;
  });

  return `# Session Stand-Up\n\n${parts.join('\n\n')}\n`;
}
