export function* sessionShortIdGenerator(sessionUuid: string): Generator<string> {
  const shortIdSections = [];
  for (const match of sessionUuid.matchAll(/([^-]+)-?/g)) {
    shortIdSections.push(match[1]);
    yield shortIdSections.join('-');
  }
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
