import type { ExtensionAPI, SessionEntry } from '@earendil-works/pi-coding-agent';

const CLOCK_CUSTOM_TYPE = 'sandpiper:clock';

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

function lastMessageTime(branch: readonly SessionEntry[]): number | undefined {
  const lastMessage = branch.findLast((entry) => entry.type === 'message');
  return lastMessage ? Date.parse(lastMessage.timestamp) : undefined;
}

export function registerClockHooks(pi: Pick<ExtensionAPI, 'on'>): void {
  pi.on('before_agent_start', (_event, ctx) => {
    const now = new Date();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Pi adds this run's starting message to the session after before_agent_start, so the last
    // message entry belongs to an earlier run.
    const lastMessage = lastMessageTime(ctx.sessionManager.getBranch());
    const sinceLastMessage =
      lastMessage === undefined ? '' : ` timeSinceLastMessage="${formatElapsed(now.getTime() - lastMessage)}"`;
    return {
      message: {
        customType: CLOCK_CUSTOM_TYPE,
        content: `<clock currentTime="${formatClockTime(now, timeZone)}"${sinceLastMessage}/>`,
        display: false,
      },
    };
  });
}
