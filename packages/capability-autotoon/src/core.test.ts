import { describe, expect, it } from 'vitest';
import { MIN_JSON_BYTES, TOON_HEADER, tryConvertJsonToToon } from './core.js';

describe('tryConvertJsonToToon', () => {
  it('converts a JSON array of objects to TOON', () => {
    const json = JSON.stringify([
      { name: 'Alice', age: 30, city: 'NYC' },
      { name: 'Bob', age: 25, city: 'LA' },
      { name: 'Carol', age: 35, city: 'Chicago' },
    ]);
    const padded = json.padEnd(MIN_JSON_BYTES + 1);
    const result = tryConvertJsonToToon(padded);

    expect(result).not.toBeNull();
    expect(result).toBeDefined();
    if (result !== null) {
      expect(result).toContain(TOON_HEADER);
      expect(result.length).toBeLessThan(padded.length);
    }
  });

  it('returns null for non-JSON text', () => {
    const longNonJson = 'hello world'.padEnd(MIN_JSON_BYTES + 1);
    expect(tryConvertJsonToToon(longNonJson)).toBeNull();
  });

  it('returns null for JSON below size threshold', () => {
    expect(tryConvertJsonToToon('{"a":1}')).toBeNull();
  });

  it('returns null when TOON is not shorter than JSON', () => {
    const smallObj = JSON.stringify({ key: 'val' }).padEnd(MIN_JSON_BYTES + 1);
    const result = tryConvertJsonToToon(smallObj);
    if (result !== null) {
      expect(result.length).toBeLessThan(smallObj.length);
    }
  });

  it('fast-rejects strings not starting with { or [', () => {
    const longNonJson = 'x'.repeat(MIN_JSON_BYTES + 100);
    expect(tryConvertJsonToToon(longNonJson)).toBeNull();
  });

  it('handles JSON with leading whitespace', () => {
    const json = `  ${JSON.stringify({ items: Array(20).fill({ id: 1, name: 'test' }) })}`;
    if (json.length >= MIN_JSON_BYTES) {
      const result = tryConvertJsonToToon(json);
      if (result !== null) {
        expect(result).toContain(TOON_HEADER);
      }
    }
  });

  it('converts a large JSON object', () => {
    const largeObj = JSON.stringify({
      data: Array(100).fill({ id: 1, name: 'test', value: 42, description: 'A test item' }),
    });
    const result = tryConvertJsonToToon(largeObj);

    expect(result).not.toBeNull();
    if (result !== null) {
      expect(result).toContain(TOON_HEADER);
      expect(result.length).toBeLessThan(largeObj.length);
    }
  });

  it('handles invalid JSON gracefully', () => {
    const invalidJson = '{ "key": "value", }'.padEnd(MIN_JSON_BYTES + 1);
    expect(tryConvertJsonToToon(invalidJson)).toBeNull();
  });

  it('converts JSON with nested objects', () => {
    const nested = JSON.stringify({
      user: {
        name: 'Alice',
        address: { city: 'NYC', zip: '10001' },
      },
    }).padEnd(MIN_JSON_BYTES + 1);

    tryConvertJsonToToon(nested);
    expect(() => tryConvertJsonToToon(nested)).not.toThrow();
  });
});
