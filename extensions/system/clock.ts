import type { ExtensionAPI, SessionEntry } from '@earendil-works/pi-coding-agent';

const CLOCK_CUSTOM_TYPE = 'sandpiper:clock';
const CLOCK_RUN_ENTRY_TYPE = 'sandpiper:clock-run';

interface ClockRunEntryV1 {
  readonly version: 1;
  readonly durationMs: number;
}

const ELAPSED_UNITS = [
  { label: 'd', seconds: 86_400 },
  { label: 'h', seconds: 3_600 },
  { label: 'min', seconds: 60 },
  { label: 's', seconds: 1 },
] as const;

export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const largest = ELAPSED_UNITS.findIndex((unit) => totalSeconds >= unit.seconds);
  const major = ELAPSED_UNITS[largest];
  if (!major) return '0 s';

  const minor = ELAPSED_UNITS[largest + 1];
  const majorCount = Math.floor(totalSeconds / major.seconds);
  const minorCount = minor ? Math.floor((totalSeconds % major.seconds) / minor.seconds) : 0;
  return minor && minorCount > 0
    ? `${majorCount} ${major.label} ${minorCount} ${minor.label}`
    : `${majorCount} ${major.label}`;
}

export function formatClockTime(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((entry) => entry.type === type)?.value ?? '';
  // longOffset renders UTC as "GMT" in some ICU versions and "GMT+00:00" in others.
  const offset = part('timeZoneName').replace('GMT', '') || '+00:00';
  return `${part('weekday')}, ${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}:${part('second')} ${offset} (${timeZone})`;
}

function parseClockRunEntry(data: unknown): ClockRunEntryV1 | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const { version, durationMs } = data as Record<string, unknown>;
  return version === 1 && typeof durationMs === 'number' && Number.isFinite(durationMs)
    ? { version, durationMs }
    : undefined;
}

function previousRunDuration(branch: readonly SessionEntry[]): number | undefined {
  const lastRun = branch.findLast((entry) => entry.type === 'custom' && entry.customType === CLOCK_RUN_ENTRY_TYPE);
  return lastRun?.type === 'custom' ? parseClockRunEntry(lastRun.data)?.durationMs : undefined;
}

function lastMessageTime(branch: readonly SessionEntry[]): number | undefined {
  const lastMessage = branch.findLast((entry) => entry.type === 'message');
  return lastMessage ? Date.parse(lastMessage.timestamp) : undefined;
}

export function registerClockHooks(pi: Pick<ExtensionAPI, 'on' | 'appendEntry'>): void {
  let runStartedAt: number | undefined;

  pi.on('before_agent_start', (_event, ctx) => {
    const now = new Date();
    runStartedAt = now.getTime();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Pi adds this run's starting message to the session after before_agent_start, so the last
    // message entry belongs to an earlier run.
    const branch = ctx.sessionManager.getBranch();
    const lastMessage = lastMessageTime(branch);
    const previousRun = previousRunDuration(branch);
    const sinceLastMessage =
      lastMessage === undefined ? '' : ` timeSinceLastMessage="${formatElapsed(now.getTime() - lastMessage)}"`;
    const previousTurn = previousRun === undefined ? '' : ` previousTurnDuration="${formatElapsed(previousRun)}"`;
    return {
      message: {
        customType: CLOCK_CUSTOM_TYPE,
        content: `<clock currentTime="${formatClockTime(now, timeZone)}"${sinceLastMessage}${previousTurn}/>`,
        display: false,
      },
    };
  });

  pi.on('agent_settled', () => {
    if (runStartedAt === undefined) return;
    const run: ClockRunEntryV1 = { version: 1, durationMs: Date.now() - runStartedAt };
    pi.appendEntry(CLOCK_RUN_ENTRY_TYPE, run);
    runStartedAt = undefined;
  });
}
