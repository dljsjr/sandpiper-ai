import { describe, expect, it } from 'vitest';
import { registerPreflightCheck, runPreflightChecks } from './preflight.js';

// Access the module-level registry via the public API only.
// We reset state between tests by registering over the same key.

describe('registerPreflightCheck', () => {
  it('registers a check that appears in runPreflightChecks()', () => {
    registerPreflightCheck('test:register', () => ({
      key: 'test:register',
      healthy: true,
      message: 'ok',
    }));
    const results = runPreflightChecks();
    expect(results.some((d) => d.key === 'test:register')).toBe(true);
  });

  it('deduplicates by key — re-registering replaces the previous check', () => {
    registerPreflightCheck('test:dedup', () => ({
      key: 'test:dedup',
      healthy: false,
      message: 'first',
    }));
    registerPreflightCheck('test:dedup', () => ({
      key: 'test:dedup',
      healthy: true,
      message: 'second',
    }));

    const results = runPreflightChecks();
    const matches = results.filter((d) => d.key === 'test:dedup');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.message).toBe('second');
  });
});

describe('runPreflightChecks', () => {
  it('returns diagnostic from a healthy check', () => {
    registerPreflightCheck('test:healthy', () => ({
      key: 'test:healthy',
      healthy: true,
      message: 'all good',
    }));
    const results = runPreflightChecks();
    const d = results.find((r) => r.key === 'test:healthy');
    expect(d?.healthy).toBe(true);
    expect(d?.message).toBe('all good');
  });

  it('returns diagnostic from an unhealthy check with instructions', () => {
    registerPreflightCheck('test:unhealthy', () => ({
      key: 'test:unhealthy',
      healthy: false,
      message: 'something is wrong',
      instructions: ['do this', 'then that'],
    }));
    const results = runPreflightChecks();
    const d = results.find((r) => r.key === 'test:unhealthy');
    expect(d?.healthy).toBe(false);
    expect(d?.instructions).toEqual(['do this', 'then that']);
  });

  it('catches a throwing check and returns a failure diagnostic', () => {
    registerPreflightCheck('test:throws', () => {
      throw new Error('boom');
    });
    const results = runPreflightChecks();
    const d = results.find((r) => r.key === 'preflight:error');
    expect(d?.healthy).toBe(false);
    expect(d?.message).toContain('boom');
  });

  it('returns results for all registered checks', () => {
    registerPreflightCheck('test:multi-a', () => ({ key: 'test:multi-a', healthy: true, message: 'a' }));
    registerPreflightCheck('test:multi-b', () => ({ key: 'test:multi-b', healthy: true, message: 'b' }));
    const results = runPreflightChecks();
    expect(results.some((d) => d.key === 'test:multi-a')).toBe(true);
    expect(results.some((d) => d.key === 'test:multi-b')).toBe(true);
  });
});
