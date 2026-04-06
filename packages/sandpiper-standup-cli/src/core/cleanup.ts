import { checkProcessLiveness } from './liveness.js';
import { parseStandup, type StandupSection, serializeStandup } from './parser.js';

export interface CleanupResult {
  /** Sections that are alive and should be written to the file */
  readonly cleanedSections: readonly StandupSection[];
  /** Sections that are dead but have recent content - returned for display */
  readonly inactiveSections: readonly StandupSection[];
  /** Serialized cleaned standup content */
  readonly serialized: string;
}

export interface CleanupOptions {
  readonly currentSessionId: string | undefined;
}

/**
 * Clean a standup file by removing sections from dead sessions.
 * Returns both the cleaned sections (for writing) and inactive sections (for display).
 */
export function cleanupStandup(content: string, opts: CleanupOptions): CleanupResult {
  const parsed = parseStandup(content);
  const currentSessionId = opts.currentSessionId;

  const cleanedSections: StandupSection[] = [];
  const inactiveSections: StandupSection[] = [];

  for (const section of parsed.sections) {
    // Always keep the current session
    if (section.uuid === currentSessionId) {
      cleanedSections.push(section);
      continue;
    }

    // Check liveness for other sessions
    const pidInfo = checkProcessLiveness(section.uuid);

    if (pidInfo === null) {
      // No PID file = dead session
      inactiveSections.push(section);
    } else if (pidInfo.isAlive) {
      // Process is alive
      cleanedSections.push(section);
    } else {
      // Process is dead
      inactiveSections.push(section);
    }
  }

  return {
    cleanedSections,
    inactiveSections,
    serialized: serializeStandup(cleanedSections),
  };
}
