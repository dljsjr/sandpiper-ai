import { randomUUID } from 'node:crypto';

const RELAY_SESSION_CUSTOM_TYPE = 'shell-relay-session';

export interface StoredRelaySession {
  readonly sessionName: string;
}

export interface SessionEntryLike {
  readonly type: string;
  readonly customType?: string;
  readonly data?: unknown;
}

/**
 * Derive a stable relay session name from the Sandpiper session UUID.
 * Uses the first 8 characters of the UUID for a short, recognizable slug.
 * Falls back to a fresh random UUID if the session ID is empty.
 */
export function deriveRelaySessionName(sandpiperSessionId: string): string {
  const slug = sandpiperSessionId.slice(0, 8);
  if (slug.length === 0) {
    return `relay-${randomUUID().slice(0, 8)}`;
  }
  return `relay-${slug}`;
}

/**
 * Decide whether to auto-reconnect to a stored relay session.
 *
 * Returns true only if:
 * - a session name was previously stored (via appendEntry)
 * - AND that name appears in the current list of available Zellij sessions
 *   (running OR EXITED — both are candidates for `zellij attach --create`)
 *
 * Returns false if the session name is absent from the list, which indicates
 * the user explicitly deleted the session (via `zellij delete-session`) rather
 * than it dying naturally from a reboot or terminal restart.
 */
export function shouldAutoReconnect(
  storedSessionName: string | undefined,
  availableSessions: readonly string[],
): boolean {
  if (!storedSessionName) return false;
  return availableSessions.includes(storedSessionName);
}

/**
 * Extract the most recent stored relay session name from the current session branch.
 * Returns undefined if no relay session has been stored in this branch.
 */
export function restoreSessionNameFromBranch(entries: readonly SessionEntryLike[]): string | undefined {
  let stored: string | undefined;
  for (const entry of entries) {
    if (entry.type === 'custom' && entry.customType === RELAY_SESSION_CUSTOM_TYPE) {
      const data = entry.data as StoredRelaySession | undefined;
      if (data?.sessionName) {
        stored = data.sessionName;
      }
    }
  }
  return stored;
}

export { RELAY_SESSION_CUSTOM_TYPE };
