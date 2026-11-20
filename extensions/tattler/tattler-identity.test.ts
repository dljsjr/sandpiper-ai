import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import * as net from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listPeerSockets, sweepDeadEndpoints } from './tattler-identity';
import { buildMessage, serializeToJsonl, type TattlerIdentityV0 } from './tattler-protocol';

const dirs: string[] = [];
const servers: net.Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function runtimeDir(): string {
  // Unix socket paths are capped near 104 bytes on macOS, so stay directly under /tmp.
  const dir = mkdtempSync('/tmp/tt-sweep-');
  dirs.push(dir);
  return dir;
}

/** A socket file whose server is gone, as a SIGKILLed session leaves it. */
function deadSocket(path: string): void {
  const script = `require('node:net').createServer().listen(${JSON.stringify(path)}, () => process.kill(process.pid, 'SIGKILL'))`;
  spawnSync(process.execPath, ['-e', script]);
  if (!existsSync(path)) throw new Error(`expected a leftover socket file at ${path}`);
}

async function liveSocket(path: string): Promise<void> {
  const server = net.createServer((socket) => socket.end());
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(path, resolve));
}

function age(path: string, seconds: number): void {
  const time = new Date(Date.now() - seconds * 1000);
  utimesSync(path, time, time);
}

function identityFile(dir: string, name: string, socketPath: string): string {
  const path = join(dir, `${name}.id`);
  const identity: TattlerIdentityV0 = buildMessage('tattler.identity.v0', { name, shortId: name, socketPath });
  writeFileSync(path, serializeToJsonl(identity));
  return path;
}

describe('sweepDeadEndpoints', () => {
  it('removes old dead sockets and the identity files that point at them, and keeps live ones', async () => {
    const dir = runtimeDir();
    const dead = join(dir, 'dead.sock');
    const live = join(dir, 'live.sock');
    deadSocket(dead);
    await liveSocket(live);
    const deadId = identityFile(dir, 'dead-agent', dead);
    const liveId = identityFile(dir, 'live-agent', live);
    for (const path of [dead, live, deadId, liveId]) age(path, 60);

    const removed = await sweepDeadEndpoints(dir, { minAgeMs: 10_000 });

    expect(removed.sort()).toEqual([dead, deadId].sort());
    expect(existsSync(live)).toBe(true);
    expect(existsSync(liveId)).toBe(true);
  });

  it('keeps a dead socket younger than the minimum age, which may be a session between bind and listen', async () => {
    const dir = runtimeDir();
    const young = join(dir, 'young.sock');
    deadSocket(young);

    expect(await sweepDeadEndpoints(dir, { minAgeMs: 10_000 })).toEqual([]);
    expect(existsSync(young)).toBe(true);
  });

  it('removes an old identity file whose socket file is already gone, and keeps files it cannot read', async () => {
    const dir = runtimeDir();
    const orphan = identityFile(dir, 'orphan', join(dir, 'missing.sock'));
    const unreadable = join(dir, 'garbled.id');
    writeFileSync(unreadable, 'not json');
    for (const path of [orphan, unreadable]) age(path, 60);

    expect(await sweepDeadEndpoints(dir, { minAgeMs: 10_000 })).toEqual([orphan]);
    expect(existsSync(unreadable)).toBe(true);
  });
});

describe('listPeerSockets', () => {
  it('leaves out the session itself, whether found through its identity file or its bare socket', async () => {
    const dir = runtimeDir();
    const own = join(dir, 'own.sock');
    const peer = join(dir, 'peer.sock');
    await liveSocket(own);
    await liveSocket(peer);
    identityFile(dir, 'me', own);
    identityFile(dir, 'them', peer);
    const ownIdentity: TattlerIdentityV0 = buildMessage('tattler.identity.v0', {
      name: 'me',
      shortId: 'own',
      socketPath: own,
    });

    const peers = await listPeerSockets(dir, ownIdentity);

    expect(peers.map((p) => p.name)).toEqual(['them']);
  });
});
