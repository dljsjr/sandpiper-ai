// TAT-84: a session that exits without session_shutdown must not leave its Tattler socket behind.
// SIGTERM and SIGHUP already run session_shutdown; process.exit, which Pi's emergencyTerminalExit
// and uncaughtCrash call, does not.

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { startRpcSession } from './rpc-driver.js';

const EXIT_AFTER_RUN = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'exit-after-run.ts');
const TIMEOUT_MS = 30_000;

describe('Tattler endpoint cleanup (TAT-84)', () => {
  it('removes its socket file when the process exits without session_shutdown', async () => {
    const session = startRpcSession({
      entry: 'sandpiper',
      extraExtensions: [EXIT_AFTER_RUN],
      commandTimeoutMs: TIMEOUT_MS,
    });
    const tattlerDir = join(session.runtimeDir, 'sandpiper');
    const sockets = () =>
      existsSync(tattlerDir) ? readdirSync(tattlerDir).filter((name) => name.endsWith('.sock')) : [];
    try {
      await vi.waitFor(() => expect(sockets()).toHaveLength(1), { timeout: 20_000, interval: 100 });

      await session.sendCommand({ type: 'prompt', message: 'hi' });
      const exit = await session.waitForEvent(() => false, TIMEOUT_MS).catch((error: unknown) => error);

      expect(String(exit)).toContain('RPC session process exited');
      expect(sockets()).toEqual([]);
    } finally {
      await session.close();
    }
  }, 60_000);
});
