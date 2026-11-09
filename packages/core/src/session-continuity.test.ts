import { describe, expect, it } from 'vitest';
import { setSandpiperSessionEnv } from './session-continuity.js';

describe('setSandpiperSessionEnv', () => {
  it('sets the session id and session file', () => {
    const env: NodeJS.ProcessEnv = {};

    setSandpiperSessionEnv(env, { sessionId: 'session-1', sessionFile: '/tmp/session.jsonl' });

    expect(env.SANDPIPER_SESSION_ID).toBe('session-1');
    expect(env.SANDPIPER_SESSION_FILE).toBe('/tmp/session.jsonl');
  });

  it('clears a stale session-file env var when no session file is available', () => {
    const env: NodeJS.ProcessEnv = { SANDPIPER_SESSION_FILE: '/old/session.jsonl' };

    setSandpiperSessionEnv(env, { sessionId: 'session-1', sessionFile: null });

    expect(env.SANDPIPER_SESSION_ID).toBe('session-1');
    expect(env).not.toHaveProperty('SANDPIPER_SESSION_FILE');
  });
});
