import { mkdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { isRecord } from 'sandpiper-ai-core';
import sanitize from 'sanitize-filename';

// runtime directory constants
const TATTLER_RUNTIME_NAMESPACE_ENV_KEY = 'TATTLER_RUNTIME_NAMESPACE';
const PI_PACKAGE_DIR_ENV_KEY = 'PI_PACKAGE_DIR';
const XDG_RUNTIME_DIR_ENV_KEY = 'XDG_RUNTIME_DIR';
const DEFAULT_RUNTIME_NAMESPACE = 'pi';
const NON_HARNESS_PROCESS_TITLES = new Set(['bun', 'node', 'npm', 'pnpm', 'yarn', 'vitest', 'tsx', 'ts-node']);

export async function firstDefined<T>(candidates: Array<() => Promise<T>>): Promise<T> {
  for (const candidate of candidates) {
    try {
      return await candidate();
    } catch {
      // Try the next candidate. The caller only needs the first usable runtime directory.
    }
  }
  throw new Error("Couldn't locate a usable runtime directory base!");
}

// ============================================================================
// Runtime Directory Helpers
// ============================================================================
//#region Runtime Directory Helpers
interface PiConfigMetadata {
  readonly configDir?: string;
  readonly name?: string;
}

function normalizeRuntimeNamespace(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const namespace = sanitize(trimmed.replace(/^\.+/, ''));
  return namespace.length > 0 ? namespace : undefined;
}

function namespaceFromConfigDir(configDir: string | undefined): string | undefined {
  const dirName = configDir === undefined ? undefined : basename(configDir);
  return normalizeRuntimeNamespace(dirName);
}

async function readPiConfigMetadata(packageDir: string | undefined): Promise<PiConfigMetadata | undefined> {
  if (!packageDir?.trim()) {
    return undefined;
  }

  try {
    const packageJson = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as unknown;
    if (!isRecord(packageJson) || !isRecord(packageJson.piConfig)) {
      return undefined;
    }

    return {
      configDir: typeof packageJson.piConfig.configDir === 'string' ? packageJson.piConfig.configDir : undefined,
      name: typeof packageJson.piConfig.name === 'string' ? packageJson.piConfig.name : undefined,
    };
  } catch {
    return undefined;
  }
}

function namespaceFromProcessTitle(): string | undefined {
  const title = basename(process.title).trim();
  if (!title || /\s/.test(title)) {
    return undefined;
  }

  const namespace = normalizeRuntimeNamespace(title);
  if (namespace === undefined || NON_HARNESS_PROCESS_TITLES.has(namespace)) {
    return undefined;
  }

  return namespace;
}

export async function harnessConfigName(): Promise<string> {
  const packagePiConfig = await readPiConfigMetadata(process.env[PI_PACKAGE_DIR_ENV_KEY]);

  return (
    normalizeRuntimeNamespace(process.env[TATTLER_RUNTIME_NAMESPACE_ENV_KEY]) ??
    namespaceFromConfigDir(packagePiConfig?.configDir) ??
    normalizeRuntimeNamespace(packagePiConfig?.name) ??
    namespaceFromProcessTitle() ??
    DEFAULT_RUNTIME_NAMESPACE
  );
}

export async function checkRuntimeDir(tattlerRuntimeDir: string): Promise<boolean> {
  return (tattlerRuntimeDir && (await stat(tattlerRuntimeDir, { throwIfNoEntry: false }))?.isDirectory()) || false;
}

async function getTmpChecked(): Promise<string> {
  if (Object.hasOwn(process.env, 'TMPDIR') && process.env.TMPDIR) {
    try {
      await mkdir(process.env.TMPDIR, { recursive: true });
      return process.env.TMPDIR;
    } catch (mkdirErr) {
      throw new Error(`${process.env.TMPDIR} unavailable: `, { cause: mkdirErr });
    }
  }

  // if we're using /tmp and there's an access or other filesystem issue,
  // we're totally screwed, so we throw.
  try {
    await mkdir('/tmp', { recursive: true });
    return '/tmp';
  } catch (mkdirErr) {
    throw new Error('Unable to access "/tmp": ', { cause: mkdirErr });
  }
}

async function getXdgBasedir(): Promise<string> {
  const xdgRuntimeDir = process.env[XDG_RUNTIME_DIR_ENV_KEY];
  if (!xdgRuntimeDir) {
    throw new Error(`${XDG_RUNTIME_DIR_ENV_KEY} not set in environment`);
  }

  try {
    await mkdir(xdgRuntimeDir, { recursive: true });
    return xdgRuntimeDir;
  } catch (mkdirErr) {
    throw new Error(`${xdgRuntimeDir} unavailable: `, { cause: mkdirErr });
  }
}

async function darwinRuntimeBasedir(): Promise<string> {
  const osTmpdir = tmpdir();
  try {
    await mkdir(osTmpdir, { recursive: true });
    return osTmpdir;
  } catch (mkdirErr) {
    throw new Error(`${osTmpdir} unavailable: `, { cause: mkdirErr });
  }
}

async function linuxRuntimeBasedir(): Promise<string> {
  const uid = process.getuid?.();
  if (uid === undefined) {
    throw new Error('Unable to determine UID');
  }

  const runDir = `/run/user/${uid}`;
  try {
    const dirStats = await stat(runDir);
    if (!dirStats.isDirectory()) {
      const error = new Error(`${runDir} is not a directory`) as NodeJS.ErrnoException;
      error.code = 'ENOTDIR';
      throw error;
    }
    return runDir;
  } catch (runDirExistsErr) {
    throw new Error(`${runDir} unavailable: `, { cause: runDirExistsErr });
  }
}

// `XDG_RUNTIME_DIR` is the only XDG basedir spec member that doesn't have a default fallback.
// It does provide guidance on how to fall back, though.
// To be a "good citizen" various OS's, we have decided on the following policy for selecting
// a runtime dir, based on documentation from the various OS's:
//
// - If `XDG_RUNTIME_DIR` is set, we use `${XDG_RUNTIME_DIR}/<harness_name>`; even on macOS.
// - If it is *not* set, we branch based on OS:
//   - on macOS, we use the `tmpdir` as the root before the harness name dir, which maps to `/var/folders/.../.../T`.
//     It's stable based on the logged in user, and is meant to be used for runtime stuff like sockets.
//   - on Linux, we attempt to use `/run/user/<uid>/<harness_name>`, as this is a common convention.
//   - In the event that either of the above fail, we fall back to `${TMPDIR:-/tmp}/<harness_name>`
export async function runtimeDir(): Promise<string> {
  const base = await firstDefined([
    getXdgBasedir,
    process.platform === 'darwin' ? darwinRuntimeBasedir : linuxRuntimeBasedir,
    getTmpChecked,
  ]);

  const runtimeDir = join(base, await harnessConfigName());
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  return runtimeDir;
}
//#endregion
