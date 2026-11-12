import { accessSync, constants, realpathSync, statSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PromptDiagnosticError } from './diagnostic.js';
import type { EditorWindow } from './session.js';

export interface GlimpseOpenOptions {
  readonly width: number;
  readonly height: number;
  readonly title: string;
}

interface GlimpseModule {
  readonly open: (html: string, options: GlimpseOpenOptions) => unknown;
}

function isExecutableFile(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The `glimpseui` executable: `SANDPIPER_GLIMPSEUI`, or the first one on `PATH`. */
export function findGlimpseExecutable(env: NodeJS.ProcessEnv): string | undefined {
  if (env.SANDPIPER_GLIMPSEUI) return env.SANDPIPER_GLIMPSEUI;
  return (env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .map((directory) => join(directory, 'glimpseui'))
    .find(isExecutableFile);
}

/** Glimpse's library module, which its package keeps at `src/glimpse.mjs` beside `bin/`. */
export function glimpseModulePath(executable: string): string {
  return resolve(dirname(realpathSync(executable)), '..', 'src', 'glimpse.mjs');
}

function isGlimpseModule(value: unknown): value is GlimpseModule {
  return typeof value === 'object' && value !== null && 'open' in value && typeof value.open === 'function';
}

function isEditorWindow(value: unknown): value is EditorWindow {
  return (
    typeof value === 'object' &&
    value !== null &&
    'on' in value &&
    typeof value.on === 'function' &&
    'send' in value &&
    typeof value.send === 'function' &&
    'close' in value &&
    typeof value.close === 'function'
  );
}

/** Loads Glimpse from the installed `glimpseui` executable. Glimpse is optional, so it is not a dependency. */
export async function loadGlimpse(env: NodeJS.ProcessEnv): Promise<GlimpseModule> {
  const executable = findGlimpseExecutable(env);
  if (!executable) {
    throw new PromptDiagnosticError('glimpseui is not installed or not on PATH; set SANDPIPER_GLIMPSEUI to its path');
  }
  const loaded: unknown = await import(pathToFileURL(glimpseModulePath(executable)).href);
  if (!isGlimpseModule(loaded)) {
    throw new PromptDiagnosticError(`Glimpse at ${executable} does not provide open()`);
  }
  return loaded;
}

export function openGlimpseWindow(glimpse: GlimpseModule, html: string, options: GlimpseOpenOptions): EditorWindow {
  const window = glimpse.open(html, options);
  if (!isEditorWindow(window)) throw new PromptDiagnosticError('Glimpse open() did not return a window');
  return window;
}
