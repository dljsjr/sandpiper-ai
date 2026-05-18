// Tattler v0 validation spike.
// Intentionally single-file and not a stable API.
// Do not extend this into the v1 architecture without first extracting core/runtime boundaries.

import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { tmpdir } from 'os';

const piCodingAgentResolveDir = dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent')));
const CONFIG_DIR_NAME: string = (await import(join(piCodingAgentResolveDir, 'config.js'))).CONFIG_DIR_NAME;

const XDG_RUNTIME_DIR_ENV_KEY = 'XDG_RUNTIME_DIR';

const VERBOSE = process.env['TATTLER_DEBUG'] === '1';

function harnessConfigName(): string {
  return CONFIG_DIR_NAME.replace(/^\./, '');
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

async function firstDefined<T>(candidates: Array<() => Promise<T>>): Promise<T> {
  for (const candidate of candidates) {
    try {
      return await candidate();
    } catch (candidateError) {
      if (VERBOSE) {
        console.warn('Encountered error while attempting to find suitable runtime dir: ', candidateError);
      }
    }
  }
  throw new Error("Couldn't locate a usable runtime directory base!");
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
async function runtimeDir(): Promise<string> {
  const base = await firstDefined([
    getXdgBasedir,
    process.platform === 'darwin' ? darwinRuntimeBasedir : linuxRuntimeBasedir,
    getTmpChecked,
  ]);

  const runtimeDir = join(base, harnessConfigName());
  await mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  return runtimeDir;
}

export default async function (_pi: ExtensionAPI) {
  if (VERBOSE) {
    console.log(`config dir name: ${CONFIG_DIR_NAME}`);
    console.log(`harness config name: ${harnessConfigName()}`);
    console.log(`runtime dir: ${await runtimeDir()}`);
  }
}
