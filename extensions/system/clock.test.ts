import type { ExtensionAPI, ExtensionContext, SessionEntry } from '@earendil-works/pi-coding-agent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatClockTime, formatElapsed, registerClockHooks } from './clock.js';

type Handler = (event: unknown, ctx: ExtensionContext) => unknown;

function createClock(branch: readonly SessionEntry[] = []) {
  const handlers = new Map<string, Handler>();
  const appendEntry = vi.fn();
  const pi = {
    on: ((event: string, handler: Handler) => {
      handlers.set(event, handler);
    }) as ExtensionAPI['on'],
    appendEntry: appendEntry as ExtensionAPI['appendEntry'],
  };
  registerClockHooks(pi);
  const ctx = { sessionManager: { getBranch: () => branch } } as unknown as ExtensionContext;
  return {
    appendEntry,
    startRun: () =>
      handlers.get('before_agent_start')?.({ type: 'before_agent_start', messageType: 'user', prompt: 'hi' }, ctx),
    settle: () => handlers.get('agent_settled')?.({ type: 'agent_settled', aborted: false }, ctx),
  };
}

function startRun(branch: readonly SessionEntry[]): unknown {
  return createClock(branch).startRun();
}

function entry(type: SessionEntry['type'], timestamp: string): SessionEntry {
  return { type, id: `${type}-${timestamp}`, parentId: null, timestamp } as SessionEntry;
}

function clockRunEntry(timestamp: string, data: unknown): SessionEntry {
  return { type: 'custom', id: `run-${timestamp}`, parentId: null, timestamp, customType: 'sandpiper:clock-run', data };
}

const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

afterEach(() => {
  vi.useRealTimers();
});

describe('formatClockTime', () => {
  const instant = new Date('2026-11-18T21:04:05Z');

  it.each([
    ['America/Chicago', 'Wednesday, 2026-11-18 15:04:05 -06:00 (America/Chicago)'],
    ['UTC', 'Wednesday, 2026-11-18 21:04:05 +00:00 (UTC)'],
    ['Asia/Kolkata', 'Thursday, 2026-11-19 02:34:05 +05:30 (Asia/Kolkata)'],
  ])('formats the local time in %s with its offset and zone name', (timeZone, expected) => {
    expect(formatClockTime(instant, timeZone)).toBe(expected);
  });
});

describe('formatElapsed', () => {
  const SECOND = 1_000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  it.each([
    [0, '0 s'],
    [59 * SECOND + 999, '59 s'],
    [MINUTE, '1 min'],
    [12 * MINUTE + 5 * SECOND, '12 min 5 s'],
    [2 * HOUR + 3 * MINUTE + 4 * SECOND, '2 h 3 min'],
    [3 * DAY, '3 d'],
    [3 * DAY + 4 * HOUR + 5 * MINUTE, '3 d 4 h'],
    [-5 * SECOND, '0 s'],
  ])('formats %d ms as %s, keeping the two largest units', (milliseconds, expected) => {
    expect(formatElapsed(milliseconds)).toBe(expected);
  });
});

describe('clock hook', () => {
  const now = new Date('2026-11-18T21:04:05Z');

  it('adds a hidden bare clock element with only the current time when the session has no messages', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    expect(startRun([])).toEqual({
      message: {
        customType: 'sandpiper:clock',
        content: `<clock currentTime="${formatClockTime(now, systemTimeZone)}"/>`,
        display: false,
      },
    });
  });

  it('measures the time since the last message in the branch, ignoring later non-message entries', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    const result = startRun([
      entry('message', '2026-11-18T18:00:00.000Z'),
      entry('message', '2026-11-18T19:01:00.000Z'),
      entry('custom_message', '2026-11-18T21:00:00.000Z'),
      entry('custom', '2026-11-18T21:04:00.000Z'),
    ]);

    expect(result).toMatchObject({
      message: {
        content: `<clock currentTime="${formatClockTime(now, systemTimeZone)}" timeSinceLastMessage="2 h 3 min"/>`,
      },
    });
  });

  it('records how long each run took, from its start until it settles', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    const clock = createClock();

    clock.startRun();
    vi.setSystemTime(now.getTime() + 12 * 60_000 + 30_000);
    clock.settle();

    expect(clock.appendEntry).toHaveBeenCalledExactlyOnceWith('sandpiper:clock-run', {
      version: 1,
      durationMs: 750_000,
    });
  });

  it('reports the duration of the previous run recorded in the branch, not the idle time since', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    const result = startRun([
      clockRunEntry('2026-11-16T09:00:00.000Z', { version: 1, durationMs: 60_000 }),
      entry('message', '2026-11-16T09:12:00.000Z'),
      clockRunEntry('2026-11-16T09:12:30.000Z', { version: 1, durationMs: 750_000 }),
    ]);

    expect(result).toMatchObject({
      message: {
        content: `<clock currentTime="${formatClockTime(now, systemTimeZone)}" timeSinceLastMessage="2 d 11 h" previousTurnDuration="12 min 30 s"/>`,
      },
    });
  });

  it.each([
    ['an unknown version', { version: 2, durationMs: 750_000 }],
    ['a missing duration', { version: 1 }],
  ])('leaves out the previous run duration when the recorded entry has %s', (_case, data) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);

    const result = startRun([clockRunEntry('2026-11-18T21:00:00.000Z', data)]);

    expect(result).toMatchObject({
      message: { content: `<clock currentTime="${formatClockTime(now, systemTimeZone)}"/>` },
    });
  });
});
