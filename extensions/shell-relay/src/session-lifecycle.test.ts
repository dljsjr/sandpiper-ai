import { describe, expect, it } from 'vitest';
import { deriveRelaySessionName, shouldAutoReconnect } from './session-lifecycle.js';

describe('deriveRelaySessionName', () => {
  it('uses the first 8 chars of the sandpiper session ID', () => {
    expect(deriveRelaySessionName('0e5cb1a4-4133-404a-9c36-6e94354d38c4')).toBe('relay-0e5cb1a4');
  });

  it('works with a session ID shorter than 8 chars by taking all available chars', () => {
    expect(deriveRelaySessionName('abcd')).toBe('relay-abcd');
  });

  it('falls back to a non-empty name when session ID is empty', () => {
    const name = deriveRelaySessionName('');
    expect(name.startsWith('relay-')).toBe(true);
    expect(name.length).toBeGreaterThan('relay-'.length);
  });
});

describe('shouldAutoReconnect', () => {
  it('returns true when stored session is present in available sessions', () => {
    expect(shouldAutoReconnect('relay-abc12345', ['sandpiper', 'relay-abc12345', 'relay-old'])).toBe(true);
  });

  it('returns false when stored session is not in available sessions (deleted)', () => {
    expect(shouldAutoReconnect('relay-abc12345', ['sandpiper', 'relay-old'])).toBe(false);
  });

  it('returns false when no stored session name', () => {
    expect(shouldAutoReconnect(undefined, ['sandpiper', 'relay-abc12345'])).toBe(false);
  });

  it('returns false when available sessions list is empty', () => {
    expect(shouldAutoReconnect('relay-abc12345', [])).toBe(false);
  });

  it('returns false when available sessions is empty and stored name is undefined', () => {
    expect(shouldAutoReconnect(undefined, [])).toBe(false);
  });
});
