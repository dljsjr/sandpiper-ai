import { describe, expect, it } from 'vitest';
import packageAutotoon, {
  tryConvertJsonToToon as packageTryConvertJsonToToon,
} from '../../packages/capability-autotoon/src/pi-extension.js';
import autotoon, { tryConvertJsonToToon } from './autotoon.js';

describe('legacy AutoTOON extension bridge', () => {
  it('re-exports the package-first Pi adapter', () => {
    expect(autotoon).toBe(packageAutotoon);
    expect(tryConvertJsonToToon).toBe(packageTryConvertJsonToToon);
  });
});
