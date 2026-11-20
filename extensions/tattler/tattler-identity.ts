import { lstat, readdir, readFile, stat, unlink } from 'node:fs/promises';
import { basename, extname, join, normalize } from 'node:path';
import { isSocketAlive, probeSocket } from './tattler-ipc';
import { buildMessage, type MessageProps, type TattlerIdentityV0 } from './tattler-protocol';
import { checkRuntimeDir } from './tattler-runtime-dir';

async function identityFromIdFile(identityFile: string): Promise<TattlerIdentityV0 | undefined> {
  const fileStat = await stat(identityFile, { throwIfNoEntry: false });
  if (!fileStat) {
    return;
  }

  try {
    const fromJson: unknown = JSON.parse(await readFile(identityFile, { encoding: 'utf8' }));

    if (
      fromJson &&
      typeof fromJson === 'object' &&
      Object.hasOwn(fromJson, 'name') &&
      Object.hasOwn(fromJson, 'socketPath') &&
      Object.hasOwn(fromJson, 'shortId')
    ) {
      const jsonMessageProps = fromJson as MessageProps<'tattler.identity.v0', TattlerIdentityV0>;
      const sockStat = await stat(jsonMessageProps.socketPath, { throwIfNoEntry: false });
      if (sockStat?.isSocket() && (await isSocketAlive(jsonMessageProps.socketPath))) {
        return buildMessage('tattler.identity.v0', jsonMessageProps);
      }
    }
  } catch (err) {
    console.warn(`error processing identity file ${identityFile} (skipping file): `, err);
  }
}

async function identityFromSocket(socketPath: string): Promise<TattlerIdentityV0 | undefined> {
  if (!(await isSocketAlive(socketPath))) return;

  const shortId = basename(socketPath, extname(socketPath));
  return buildMessage('tattler.identity.v0', {
    socketPath,
    shortId,
    name: `session:${shortId}`,
  });
}

export async function listPeerSockets(
  tattlerRuntimeDir: string,
  ownIdentity: TattlerIdentityV0,
): Promise<TattlerIdentityV0[]> {
  if (!(await checkRuntimeDir(tattlerRuntimeDir))) {
    return [];
  }

  const livePeers: TattlerIdentityV0[] = [];

  const socketFiles = new Set<string>();
  const identityFiles = new Set<string>();
  for (const entry of await readdir(tattlerRuntimeDir, { withFileTypes: true })) {
    const normalizedEntryPath = normalize(join(tattlerRuntimeDir, entry.name));
    if (entry.isSocket()) {
      if (normalizedEntryPath !== ownIdentity.socketPath) {
        socketFiles.add(normalizedEntryPath);
      }
    } else if (extname(entry.name) === '.id') {
      identityFiles.add(normalizedEntryPath);
    }
  }

  for (const idFile of identityFiles) {
    const id = await identityFromIdFile(idFile);
    if (id && normalize(id.socketPath) !== ownIdentity.socketPath) {
      socketFiles.delete(id.socketPath);
      livePeers.push(id);
    }
  }

  for (const socketPath of socketFiles) {
    const id = await identityFromSocket(socketPath);
    if (id) {
      livePeers.push(id);
    }
  }

  return livePeers;
}

export interface SweepDeadEndpointsOptions {
  /**
   * Files younger than this are kept: a session creates its socket file when it binds, a moment
   * before it listens, and a probe in between is refused.
   */
  readonly minAgeMs: number;
}

/**
 * Removes the socket files no process listens on, and the identity files that point at a missing
 * or dead socket, so sessions that exited without session_shutdown (SIGKILL, process.exit) do not
 * leave them behind. Returns the removed paths.
 */
export async function sweepDeadEndpoints(
  tattlerRuntimeDir: string,
  options: SweepDeadEndpointsOptions,
): Promise<string[]> {
  const isOldEnough = async (path: string): Promise<boolean> => {
    const fileStat = await lstat(path).catch(() => undefined);
    return fileStat !== undefined && Date.now() - fileStat.mtimeMs >= options.minAgeMs;
  };
  const remove = (path: string): Promise<string | undefined> =>
    unlink(path).then(
      () => path,
      () => undefined,
    );

  const entries = await readdir(tattlerRuntimeDir, { withFileTypes: true });
  const sockets = entries.filter((entry) => entry.isSocket()).map((entry) => join(tattlerRuntimeDir, entry.name));
  const identityFiles = entries
    .filter((entry) => entry.isFile() && extname(entry.name) === '.id')
    .map((entry) => join(tattlerRuntimeDir, entry.name));

  const removedSockets = await Promise.all(
    sockets.map(async (path) =>
      (await isOldEnough(path)) && (await probeSocket(path)) === 'refused' ? remove(path) : undefined,
    ),
  );
  const removedIdentityFiles = await Promise.all(
    identityFiles.map(async (path) => {
      if (!(await isOldEnough(path))) return undefined;
      const socketPath = await readIdentitySocketPath(path);
      if (socketPath === undefined) return undefined;
      const socketGone = (await stat(socketPath, { throwIfNoEntry: false })) === undefined;
      return socketGone || (await probeSocket(socketPath)) === 'refused' ? remove(path) : undefined;
    }),
  );
  return [...removedSockets, ...removedIdentityFiles].filter((path): path is string => path !== undefined);
}

async function readIdentitySocketPath(identityFile: string): Promise<string | undefined> {
  try {
    const parsed: unknown = JSON.parse(await readFile(identityFile, { encoding: 'utf8' }));
    if (parsed && typeof parsed === 'object' && 'socketPath' in parsed && typeof parsed.socketPath === 'string') {
      return parsed.socketPath;
    }
  } catch {}
  return undefined;
}
