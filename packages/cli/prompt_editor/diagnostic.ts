import { spawn } from 'node:child_process';
import type { SourceCodec } from './projection.js';

export class PromptDiagnosticError extends Error {
  override name = 'PromptDiagnosticError';
}

export interface PromptSources {
  readonly identity?: string;
  readonly systemPrompt?: string;
  readonly appendSystemPrompts: readonly string[];
  readonly contextFiles: readonly string[];
}

/** A span of the prompt rendered from a span of a file, as the diagnostic reports it. */
export interface EditableSpan {
  readonly start: number;
  readonly end: number;
  readonly path: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly codec: SourceCodec;
}

export interface DiagnosticPrompt {
  readonly prompt: string;
  readonly warnings: readonly string[];
  readonly sources: PromptSources;
  readonly editableSpans: readonly EditableSpan[];
}

export interface DiagnosticCommand {
  readonly program: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

type JsonObject = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function field<T>(object: JsonObject, key: string, parse: (value: unknown) => T | undefined): T {
  const parsed = parse(object[key]);
  if (parsed === undefined) throw new PromptDiagnosticError(`Invalid JSON from system prompt diagnostic: ${key}`);
  return parsed;
}

function optionalField<T>(object: JsonObject, key: string, parse: (value: unknown) => T | undefined): T | undefined {
  return object[key] === undefined || object[key] === null ? undefined : field(object, key, parse);
}

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const asOffset = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
const asCodec = (value: unknown): SourceCodec | undefined =>
  value === 'direct' || value === 'xml-text' ? value : undefined;
const asObject = (value: unknown): JsonObject | undefined => (isObject(value) ? value : undefined);
const asUnknown = (value: unknown): unknown => value;

function asList<T>(parse: (value: unknown) => T | undefined): (value: unknown) => T[] | undefined {
  return (value) => {
    if (!Array.isArray(value)) return undefined;
    const items: T[] = [];
    for (const item of value) {
      const parsed = parse(item);
      if (parsed === undefined) return undefined;
      items.push(parsed);
    }
    return items;
  };
}

function asSpan(value: unknown): EditableSpan | undefined {
  if (!isObject(value)) return undefined;
  const start = asOffset(value.start);
  const end = asOffset(value.end);
  const path = asString(value.path);
  const sourceStart = asOffset(value.sourceStart);
  const sourceEnd = asOffset(value.sourceEnd);
  const codec = asCodec(value.codec);
  if (start === undefined || end === undefined || path === undefined) return undefined;
  if (sourceStart === undefined || sourceEnd === undefined || codec === undefined) return undefined;
  return { start, end, path, sourceStart, sourceEnd, codec };
}

/** Reads the `--json` output of `sandpiper-system-prompt`. `editableSpans` is optional; older output lacks it. */
export function parseDiagnosticOutput(stdout: string, stderr: string): DiagnosticPrompt {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new PromptDiagnosticError(
      `Invalid JSON from system prompt diagnostic: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isObject(payload)) throw new PromptDiagnosticError('Invalid JSON from system prompt diagnostic: not an object');

  const sources = field(payload, 'sources', asObject);
  const warnings = optionalField(payload, 'warnings', asList(asString)) ?? [];
  // The diagnostic also prints each warning to stderr. Keep other stderr lines, which may be the only report.
  const printed = new Set(warnings.map((warning) => `Warning: ${warning}`));
  const stderrWarnings = stderr.split(/\r?\n/).filter((line) => line.trim() && !printed.has(line));
  const identity = optionalField(sources, 'identity', asString);
  const systemPrompt = optionalField(sources, 'systemPrompt', asString);

  return {
    prompt: field(payload, 'prompt', asString),
    warnings: [...warnings, ...stderrWarnings],
    sources: {
      ...(identity === undefined ? {} : { identity }),
      ...(systemPrompt === undefined ? {} : { systemPrompt }),
      appendSystemPrompts: optionalField(sources, 'appendSystemPrompts', asList(asString)) ?? [],
      contextFiles: optionalField(sources, 'contextFiles', asList(asString)) ?? [],
    },
    // A malformed span is dropped like one whose text does not match.
    editableSpans:
      optionalField(payload, 'editableSpans', asList(asUnknown))?.flatMap((span) => asSpan(span) ?? []) ?? [],
  };
}

/** Runs the diagnostic as a subprocess and reads its `--json` output. */
export function runPromptDiagnostic(command: DiagnosticCommand): Promise<DiagnosticPrompt> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.program, [...command.args], {
      cwd: command.cwd,
      env: command.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', (error) =>
      reject(new PromptDiagnosticError(`System prompt diagnostic failed: ${error.message}`)),
    );
    child.on('close', (code, signal) => {
      const out = Buffer.concat(stdout).toString('utf-8');
      const err = Buffer.concat(stderr).toString('utf-8');
      if (code !== 0) {
        const detail = err.trim() || out.trim();
        reject(new PromptDiagnosticError(`System prompt diagnostic failed (${code ?? signal}): ${detail}`));
        return;
      }
      try {
        resolve(parseDiagnosticOutput(out, err));
      } catch (error) {
        reject(error);
      }
    });
  });
}
