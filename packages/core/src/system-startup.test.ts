import { describe, expect, it } from 'vitest';
import { shouldTreatInitialLoadAsColdStart } from './system-startup.js';

describe('system-startup', () => {
  describe('shouldTreatInitialLoadAsColdStart', () => {
    it('treats missing session file as a cold start', () => {
      expect(shouldTreatInitialLoadAsColdStart(undefined, [{ type: 'custom' }])).toBe(true);
    });

    it('treats sessions with no message entries as a cold start', () => {
      expect(shouldTreatInitialLoadAsColdStart('/tmp/session.jsonl', [{ type: 'custom' }])).toBe(true);
    });

    it('does not treat resumed sessions with a file and message history as a cold start', () => {
      expect(shouldTreatInitialLoadAsColdStart('/tmp/session.jsonl', [{ type: 'custom' }, { type: 'message' }])).toBe(
        false,
      );
    });
  });
});
