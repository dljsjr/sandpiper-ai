export interface SessionEntryLike {
  readonly type: string;
}

export function shouldTreatInitialLoadAsColdStart(
  sessionFile: string | undefined,
  entries: readonly SessionEntryLike[],
): boolean {
  return sessionFile === undefined || !entries.some((entry) => entry.type === 'message');
}
