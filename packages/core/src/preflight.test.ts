import { describe, expect, it } from 'vitest';
import { collectPreflightDiagnostics, registerPreflightCheck } from './preflight.js';

/** Create a minimal mock pi object with a compatible event bus. */
function createMockPi() {
  const listeners = new Map<string, ((data: unknown) => void)[]>();
  return {
    events: {
      on(event: string, handler: (data: unknown) => void) {
        listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      },
      emit(event: string, data: unknown) {
        for (const handler of listeners.get(event) ?? []) {
          handler(data);
        }
      },
    },
  };
}

describe('registerPreflightCheck', () => {
  it('registers a listener on PREFLIGHT_EVENT', () => {
    const pi = createMockPi();
    registerPreflightCheck(pi, 'test:register', () => ({
      key: 'test:register',
      healthy: true,
      message: 'ok',
    }));
    const results = collectPreflightDiagnostics(pi);
    expect(results.some((d) => d.key === 'test:register')).toBe(true);
  });

  it('result is healthy when check returns healthy', () => {
    const pi = createMockPi();
    registerPreflightCheck(pi, 'test:healthy', () => ({
      key: 'test:healthy',
      healthy: true,
      message: 'all good',
    }));
    const results = collectPreflightDiagnostics(pi);
    const d = results.find((r) => r.key === 'test:healthy');
    expect(d?.healthy).toBe(true);
    expect(d?.message).toBe('all good');
  });

  it('result is unhealthy when check returns unhealthy', () => {
    const pi = createMockPi();
    registerPreflightCheck(pi, 'test:unhealthy', () => ({
      key: 'test:unhealthy',
      healthy: false,
      message: 'something is wrong',
      instructions: ['do this', 'then that'],
    }));
    const results = collectPreflightDiagnostics(pi);
    const d = results.find((r) => r.key === 'test:unhealthy');
    expect(d?.healthy).toBe(false);
    expect(d?.instructions).toEqual(['do this', 'then that']);
  });

  it('catches a throwing check and returns a failure diagnostic', () => {
    const pi = createMockPi();
    registerPreflightCheck(pi, 'test:throws', () => {
      throw new Error('boom');
    });
    const results = collectPreflightDiagnostics(pi);
    expect(results[0]?.healthy).toBe(false);
    expect(results[0]?.message).toContain('boom');
  });

  it('collects results from multiple registered checks', () => {
    const pi = createMockPi();
    registerPreflightCheck(pi, 'test:multi-a', () => ({ key: 'test:multi-a', healthy: true, message: 'a' }));
    registerPreflightCheck(pi, 'test:multi-b', () => ({ key: 'test:multi-b', healthy: false, message: 'b' }));
    const results = collectPreflightDiagnostics(pi);
    expect(results).toHaveLength(2);
    expect(results.some((d) => d.key === 'test:multi-a')).toBe(true);
    expect(results.some((d) => d.key === 'test:multi-b')).toBe(true);
  });
});

describe('collectPreflightDiagnostics', () => {
  it('returns empty array when no checks registered', () => {
    const pi = createMockPi();
    expect(collectPreflightDiagnostics(pi)).toEqual([]);
  });

  it('is synchronous — all results present immediately on return', () => {
    const pi = createMockPi();
    registerPreflightCheck(pi, 'test:sync', () => ({ key: 'test:sync', healthy: true, message: 'sync' }));
    const results = collectPreflightDiagnostics(pi);
    // If async, results would be empty here
    expect(results).toHaveLength(1);
  });

  it('simulates cross-extension communication via separate pi instances sharing the same event', () => {
    // In real usage, each extension gets its own pi object but they share
    // the same underlying events bus. We simulate this by wiring two mock
    // pis through the same listeners map.
    const listeners = new Map<string, ((data: unknown) => void)[]>();
    const makePi = () => ({
      events: {
        on(event: string, handler: (data: unknown) => void) {
          listeners.set(event, [...(listeners.get(event) ?? []), handler]);
        },
        emit(event: string, data: unknown) {
          for (const handler of listeners.get(event) ?? []) handler(data);
        },
      },
    });

    const piShellRelay = makePi();
    const piSystem = makePi();

    // shell-relay registers its check via its own pi instance
    registerPreflightCheck(piShellRelay, 'shell-relay:integration', () => ({
      key: 'shell-relay:integration',
      healthy: false,
      message: 'not sourced',
    }));

    // system collects via its own pi instance — should find shell-relay's check
    const results = collectPreflightDiagnostics(piSystem);
    expect(results).toHaveLength(1);
    expect(results[0]?.key).toBe('shell-relay:integration');
  });
});
