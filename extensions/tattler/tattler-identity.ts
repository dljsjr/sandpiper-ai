import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, normalize } from 'node:path';
import { isSocketAlive } from './tattler-ipc';
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
    if (id) {
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
