import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { PromptDiagnosticError } from './diagnostic.js';
import type { PromptEditorState } from './state.js';
import { SourceWatcher } from './watcher.js';

/** The part of a Glimpse window the editor uses. */
export interface EditorWindow {
  on(event: 'ready' | 'closed', listener: () => void): unknown;
  on(event: 'message', listener: (data: unknown) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  send(js: string): void;
  close(): void;
}

type EditorMethod = 'render' | 'updateStage' | 'showPreview' | 'showError' | 'sourcesChanged';

export type EditorMessage =
  | { readonly action: 'stage'; readonly generation: number; readonly regionId: string; readonly text: string }
  | { readonly action: 'preview'; readonly generation: number; readonly regions: ReadonlyMap<string, string> }
  | { readonly action: 'apply'; readonly generation: number; readonly draftRevision: number }
  | { readonly action: 'refresh' | 'discard' }
  | { readonly action: 'reveal' | 'open'; readonly path: string };

export type OpenSource = (path: string, reveal: boolean) => Promise<void>;

export interface EditorSessionOptions {
  readonly openSource: OpenSource;
  readonly watchIntervalMs: number;
}

export function editorCall(method: EditorMethod, value: unknown): string {
  return `window.promptEditor.${method}(${JSON.stringify(value)})`;
}

function messageField(data: Readonly<Record<string, unknown>>, key: string): unknown {
  if (!(key in data)) throw new TypeError(`Editor message is missing ${key}`);
  return data[key];
}

function integerField(data: Readonly<Record<string, unknown>>, key: string): number {
  const value = messageField(data, key);
  if (typeof value !== 'number' || !Number.isInteger(value))
    throw new TypeError(`Editor message ${key} is not an integer`);
  return value;
}

function stringField(data: Readonly<Record<string, unknown>>, key: string): string {
  const value = messageField(data, key);
  if (typeof value !== 'string') throw new TypeError(`Editor message ${key} is not text`);
  return value;
}

function regionsField(data: Readonly<Record<string, unknown>>): Map<string, string> {
  const value = messageField(data, 'regions');
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Preview regions must be an object');
  }
  const regions = new Map<string, string>();
  for (const [id, text] of Object.entries(value)) {
    if (typeof text !== 'string') throw new TypeError('Preview regions must map region ids to text');
    regions.set(id, text);
  }
  return regions;
}

/** A message from the page. Unknown actions are ignored; a known action with bad fields is an error. */
export function parseEditorMessage(data: unknown): EditorMessage | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const fields = data as Readonly<Record<string, unknown>>;
  switch (fields.action) {
    case 'stage':
      return {
        action: 'stage',
        generation: integerField(fields, 'generation'),
        regionId: stringField(fields, 'regionId'),
        text: stringField(fields, 'text'),
      };
    case 'preview':
      return { action: 'preview', generation: integerField(fields, 'generation'), regions: regionsField(fields) };
    case 'apply':
      return {
        action: 'apply',
        generation: integerField(fields, 'generation'),
        draftRevision: integerField(fields, 'draftRevision'),
      };
    case 'refresh':
    case 'discard':
      return { action: fields.action };
    case 'reveal':
    case 'open':
      return { action: fields.action, path: stringField(fields, 'path') };
    default:
      return undefined;
  }
}

async function dispatch(
  state: PromptEditorState,
  message: EditorMessage,
  openSource: OpenSource,
): Promise<{ readonly method: EditorMethod; readonly value: unknown } | undefined> {
  switch (message.action) {
    case 'stage':
      return { method: 'updateStage', value: state.stage(message.generation, message.regionId, message.text) };
    case 'preview':
      state.stageAll(message.generation, message.regions);
      return { method: 'showPreview', value: state.preview() };
    case 'apply':
      return { method: 'render', value: await state.apply(message.generation, message.draftRevision) };
    case 'refresh':
      return { method: 'render', value: await state.refresh() };
    case 'discard':
      return { method: 'render', value: await state.refresh(true) };
    case 'reveal':
    case 'open':
      await openSource(state.sourcePath(message.path), message.action === 'reveal');
      return undefined;
  }
}

/** Shows a file in the file manager, or opens it in its default application. */
export function openSourceWithSystem(path: string, reveal: boolean): Promise<void> {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', reveal ? ['-R', path] : [path]]
      : ['xdg-open', [reveal ? dirname(path) : path]];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore' });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

/**
 * Serves the page in `window` until it closes: renders on load, handles page messages one at a time, and tells the
 * page when an editable source changes on disk.
 */
export function runEditorSession(
  window: EditorWindow,
  state: PromptEditorState,
  options: EditorSessionOptions,
): Promise<void> {
  const call = (method: EditorMethod, value: unknown): void => window.send(editorCall(method, value));
  let queue = Promise.resolve();
  const enqueue = (task: () => Promise<void> | void): void => {
    queue = queue.then(task);
  };

  const handle = async (data: unknown): Promise<void> => {
    state.busy = true;
    try {
      const message = parseEditorMessage(data);
      const result = message && (await dispatch(state, message, options.openSource));
      if (result) call(result.method, result.value);
    } catch (error) {
      call('showError', error instanceof Error ? error.message : String(error));
    } finally {
      state.busy = false;
    }
  };

  const watcher = new SourceWatcher(state);
  watcher.check();
  return new Promise((resolve, reject) => {
    const stopWatching = watcher.watch(
      (paths) => enqueue(() => call('sourcesChanged', paths)),
      options.watchIntervalMs,
    );
    window.on('ready', () => enqueue(() => call('render', state.renderPayload())));
    window.on('message', (data) => enqueue(() => handle(data)));
    window.on('error', (error) => {
      stopWatching();
      window.close();
      reject(new PromptDiagnosticError(error.message));
    });
    window.on('closed', () => {
      stopWatching();
      resolve();
    });
  });
}
