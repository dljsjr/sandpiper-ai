// In-process unit test of the guard's own mechanics: does its monkeypatch actually block
// fetch the way it claims to? This is deliberately narrower than "does pi's provider
// resolution actually get stopped from falling back to a real provider" -- that end-to-end
// guard-fires proof (deliberately misconfigure a spawn to skip the mock, assert the sentinel
// fires instead of a real response) is AGENT-252's own scoped deliverable per the approved
// design and the coordinator's ruling. This test verifies the piece AGENT-251 actually built:
// the guard's patch, in isolation, does what its code claims before AGENT-252 builds the
// harder end-to-end proof on top of it.
//
// Unlike the guard's production behavior (no restore path -- each spawned process is a
// throwaway for one isolated test), this test runs the guard IN-PROCESS against the shared
// vitest worker's globalThis.fetch, so it must restore fetch afterward -- otherwise every
// other test in this worker (including real web-fetch tests) would start rejecting with the
// sentinel error too.

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import networkDenyGuard, { NETWORK_DENY_SENTINEL } from './network-deny-guard.js';

describe('network-deny-guard', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    networkDenyGuard({} as ExtensionAPI);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects fetch with the sentinel error instead of attempting a real request', async () => {
    await expect(fetch('https://example.invalid')).rejects.toThrow(NETWORK_DENY_SENTINEL);
  });

  it('includes the requested URL in the rejection message', async () => {
    await expect(fetch('https://example.invalid/some/path')).rejects.toThrow('https://example.invalid/some/path');
  });
});
