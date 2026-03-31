import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type SignalEvent, SignalParser } from './signal.js';

describe('SignalParser', () => {
  let parser: SignalParser;
  let events: SignalEvent[];

  beforeEach(() => {
    parser = new SignalParser();
    events = [];
    parser.on('signal', (event) => {
      events.push(event);
    });
  });

  afterEach(() => {
    parser.removeAllListeners();
  });

  describe('parsing', () => {
    it('should parse prompt_ready', () => {
      parser.feed('prompt_ready\n');
      expect(events).toEqual([{ type: 'prompt_ready' }]);
    });

    it('should parse last_status:0', () => {
      parser.feed('last_status:0\n');
      expect(events).toEqual([{ type: 'last_status', exitCode: 0 }]);
    });

    it('should parse last_status with non-zero exit code', () => {
      parser.feed('last_status:127\n');
      expect(events).toEqual([{ type: 'last_status', exitCode: 127 }]);
    });

    it('should parse last_status:1', () => {
      parser.feed('last_status:1\n');
      expect(events).toEqual([{ type: 'last_status', exitCode: 1 }]);
    });

    it('should handle multiple messages in a single chunk', () => {
      parser.feed('prompt_ready\nlast_status:0\nprompt_ready\n');
      expect(events).toEqual([
        { type: 'prompt_ready' },
        { type: 'last_status', exitCode: 0 },
        { type: 'prompt_ready' },
      ]);
    });

    it('should handle messages split across multiple chunks', () => {
      parser.feed('prompt_');
      expect(events).toEqual([]);

      parser.feed('ready\n');
      expect(events).toEqual([{ type: 'prompt_ready' }]);
    });

    it('should handle last_status split across chunks', () => {
      parser.feed('last_sta');
      expect(events).toEqual([]);

      parser.feed('tus:42\n');
      expect(events).toEqual([{ type: 'last_status', exitCode: 42 }]);
    });

    it('should handle newline split from message', () => {
      parser.feed('prompt_ready');
      expect(events).toEqual([]);

      parser.feed('\n');
      expect(events).toEqual([{ type: 'prompt_ready' }]);
    });

    it('should handle multiple chunks building up to multiple messages', () => {
      parser.feed('last_status:0\nprompt_re');
      expect(events).toEqual([{ type: 'last_status', exitCode: 0 }]);

      parser.feed('ady\nlast_status:1\n');
      expect(events).toEqual([
        { type: 'last_status', exitCode: 0 },
        { type: 'prompt_ready' },
        { type: 'last_status', exitCode: 1 },
      ]);
    });
  });

  describe('error handling', () => {
    it('should ignore empty lines', () => {
      parser.feed('\n\nprompt_ready\n\n');
      expect(events).toEqual([{ type: 'prompt_ready' }]);
    });

    it('should ignore malformed lines', () => {
      parser.feed('garbage_data\n');
      expect(events).toEqual([]);
    });

    it('should ignore last_status with non-numeric exit code', () => {
      parser.feed('last_status:abc\n');
      expect(events).toEqual([]);
    });

    it('should continue parsing after malformed lines', () => {
      parser.feed('bad_line\nprompt_ready\nalso_bad\nlast_status:0\n');
      expect(events).toEqual([{ type: 'prompt_ready' }, { type: 'last_status', exitCode: 0 }]);
    });

    it('should ignore last_status with negative exit code', () => {
      parser.feed('last_status:-1\n');
      expect(events).toEqual([]);
    });
  });

  describe('promise-based waiting', () => {
    it('should resolve waitFor when matching event arrives', async () => {
      const promise = parser.waitFor('prompt_ready', 1000);
      parser.feed('prompt_ready\n');
      const event = await promise;
      expect(event).toEqual({ type: 'prompt_ready' });
    });

    it('should resolve waitFor for last_status', async () => {
      const promise = parser.waitFor('last_status', 1000);
      parser.feed('last_status:42\n');
      const event = await promise;
      expect(event).toEqual({ type: 'last_status', exitCode: 42 });
    });

    it('should skip non-matching events when waiting', async () => {
      const promise = parser.waitFor('last_status', 1000);
      parser.feed('prompt_ready\n'); // should be skipped
      parser.feed('last_status:0\n'); // should resolve
      const event = await promise;
      expect(event).toEqual({ type: 'last_status', exitCode: 0 });
    });

    it('should resolve from buffered events that arrived before waitFor', async () => {
      parser.feed('last_status:0\n');
      const event = await parser.waitFor('last_status', 50);
      expect(event).toEqual({ type: 'last_status', exitCode: 0 });
    });

    it('should reject on timeout', async () => {
      const promise = parser.waitFor('prompt_ready', 50);
      await expect(promise).rejects.toThrow('timed out');
    });
  });
});
