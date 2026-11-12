import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** How a source's text appears in the prompt: verbatim, or with `&`, `<`, and `>` escaped as XML text. */
export type SourceCodec = 'direct' | 'xml-text';

export class SourceChangedError extends Error {
  override name = 'SourceChangedError';
}

/** A span of a source file and the exact text it renders as in the prompt. */
export interface SourceCandidate {
  /** Real path: symlinks resolved, so writes edit the target and keep the link. */
  readonly path: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly renderedText: string;
  readonly codec: SourceCodec;
  readonly label: string;
  /** Where the text starts in the prompt. Unset: the text must occur exactly once. */
  readonly promptStart?: number;
}

export interface SourceRegion {
  readonly id: string;
  readonly path: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly promptStart: number;
  readonly promptEnd: number;
  readonly codec: SourceCodec;
  readonly sourceRevision: string;
  readonly label: string;
}

export interface PromptSegment {
  readonly text: string;
  readonly editable: boolean;
  readonly region?: SourceRegion;
}

export interface PromptProjection {
  readonly prompt: string;
  readonly segments: readonly PromptSegment[];
  readonly regions: readonly SourceRegion[];
}

export interface PendingSourceChange {
  readonly path: string;
  readonly previousSource: string;
  readonly updatedSource: string;
  readonly previousRevision: string;
}

export interface AppliedSourceEdit {
  readonly path: string;
  readonly previousSource: string;
  readonly updatedRevision: string;
}

export function contentRevision(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

export function readSource(path: string): string {
  return readFileSync(path, 'utf-8');
}

export function renderSourceText(text: string, codec: SourceCodec): string {
  return codec === 'xml-text' ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : text;
}

function sourceTextFromRendered(text: string, codec: SourceCodec): string {
  if (codec === 'direct') return text;
  const entities: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>' };
  return text.replace(/&(?:amp|lt|gt);/g, (entity) => entities[entity] ?? entity);
}

/** A candidate for a span of `path`, rendered with `codec`. */
export function sourceCandidate(
  path: string,
  sourceStart: number,
  sourceEnd: number,
  codec: SourceCodec = 'direct',
  promptStart?: number,
): SourceCandidate {
  const sourcePath = realpathSync(path);
  const source = readSource(sourcePath);
  return {
    path: sourcePath,
    sourceStart,
    sourceEnd,
    renderedText: renderSourceText(source.slice(sourceStart, sourceEnd), codec),
    codec,
    label: path,
    ...(promptStart === undefined ? {} : { promptStart }),
  };
}

/** A candidate for the whole of `path`, without its trailing whitespace. */
export function fileCandidate(path: string, codec: SourceCodec = 'direct'): SourceCandidate {
  return sourceCandidate(path, 0, readSource(realpathSync(path)).trimEnd().length, codec);
}

function regionId(candidate: SourceCandidate): string {
  return createHash('sha256')
    .update(`${candidate.path}:${candidate.sourceStart}:${candidate.sourceEnd}`)
    .digest('hex')
    .slice(0, 16);
}

/** The prompt offset of `text` when it occurs exactly once. */
export function uniqueOffset(prompt: string, text: string): number | undefined {
  const start = prompt.indexOf(text);
  if (start < 0 || prompt.indexOf(text, start + 1) >= 0) return undefined;
  return start;
}

function candidateRegion(prompt: string, candidate: SourceCandidate): SourceRegion | undefined {
  const promptStart = candidate.promptStart ?? uniqueOffset(prompt, candidate.renderedText);
  if (promptStart === undefined) return undefined;
  const promptEnd = promptStart + candidate.renderedText.length;
  if (prompt.slice(promptStart, promptEnd) !== candidate.renderedText) return undefined;
  return {
    id: regionId(candidate),
    path: candidate.path,
    sourceStart: candidate.sourceStart,
    sourceEnd: candidate.sourceEnd,
    promptStart,
    promptEnd,
    codec: candidate.codec,
    sourceRevision: contentRevision(readSource(candidate.path)),
    label: candidate.label,
  };
}

/**
 * Splits `prompt` into locked text and regions backed by source files. A candidate becomes a region when its
 * text is at its prompt offset, or occurs exactly once. Regions are sorted and never overlap: the earlier one wins.
 */
export function buildProjection(prompt: string, candidates: readonly SourceCandidate[]): PromptProjection {
  const regions = candidates
    .flatMap((candidate) => candidateRegion(prompt, candidate) ?? [])
    .sort((left, right) => left.promptStart - right.promptStart);
  const nonOverlapping: SourceRegion[] = [];
  for (const region of regions) {
    const previous = nonOverlapping.at(-1);
    if (previous && region.promptStart < previous.promptEnd) continue;
    nonOverlapping.push(region);
  }

  const segments: PromptSegment[] = [];
  let cursor = 0;
  for (const region of nonOverlapping) {
    if (cursor < region.promptStart) {
      segments.push({ text: prompt.slice(cursor, region.promptStart), editable: false });
    }
    segments.push({ text: prompt.slice(region.promptStart, region.promptEnd), editable: true, region });
    cursor = region.promptEnd;
  }
  if (cursor < prompt.length) segments.push({ text: prompt.slice(cursor), editable: false });

  return { prompt, segments, regions: nonOverlapping };
}

/** The file contents that staged region edits produce, one change per file. Writes nothing. */
export function buildSourceChanges(
  projection: PromptProjection,
  stagedEdits: ReadonlyMap<string, string>,
): PendingSourceChange[] {
  const regions = new Map(projection.regions.map((region) => [region.id, region]));
  const grouped = new Map<string, Array<{ readonly region: SourceRegion; readonly renderedText: string }>>();
  for (const [id, renderedText] of stagedEdits) {
    const region = regions.get(id);
    if (!region) throw new SourceChangedError('The editable source region no longer exists');
    const edits = grouped.get(region.path) ?? [];
    edits.push({ region, renderedText });
    grouped.set(region.path, edits);
  }

  const changes: PendingSourceChange[] = [];
  for (const [path, edits] of grouped) {
    const previousSource = readSource(path);
    const previousRevision = contentRevision(previousSource);
    if (edits.some(({ region }) => region.sourceRevision !== previousRevision)) {
      throw new SourceChangedError(`Source changed since render: ${path}`);
    }

    let updatedSource = previousSource;
    for (const { region, renderedText } of [...edits].sort((a, b) => b.region.sourceStart - a.region.sourceStart)) {
      updatedSource =
        updatedSource.slice(0, region.sourceStart) +
        sourceTextFromRendered(renderedText, region.codec) +
        updatedSource.slice(region.sourceEnd);
    }
    if (updatedSource !== previousSource) {
      changes.push({ path, previousSource, updatedSource, previousRevision });
    }
  }
  return changes;
}

/** The prompt as it would render with the staged edits, over the same regions. */
export function buildShadowProjection(
  projection: PromptProjection,
  stagedEdits: ReadonlyMap<string, string>,
): PromptProjection {
  const segments = projection.segments.map((segment) =>
    segment.region ? { ...segment, text: stagedEdits.get(segment.region.id) ?? segment.text } : segment,
  );
  return {
    prompt: segments.map((segment) => segment.text).join(''),
    segments,
    regions: projection.regions,
  };
}

// Replaces the file in one step and keeps its mode. `path` is a real path, so a symlink to it stays a symlink.
function atomicWrite(path: string, content: string): void {
  const mode = statSync(path).mode & 0o7777;
  const tempPath = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString('hex')}`);
  try {
    writeFileSync(tempPath, content, { encoding: 'utf-8', flag: 'wx', mode: 0o600 });
    chmodSync(tempPath, mode);
    renameSync(tempPath, path);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

/** Writes the changes when every file is still as previewed. A failed write restores the files already written. */
export function applySourceChanges(changes: readonly PendingSourceChange[]): AppliedSourceEdit[] {
  for (const change of changes) {
    if (contentRevision(readSource(change.path)) !== change.previousRevision) {
      throw new SourceChangedError(`Source changed since preview: ${change.path}`);
    }
  }

  const applied: AppliedSourceEdit[] = [];
  try {
    for (const change of changes) {
      atomicWrite(change.path, change.updatedSource);
      applied.push({
        path: change.path,
        previousSource: change.previousSource,
        updatedRevision: contentRevision(change.updatedSource),
      });
    }
  } catch (error) {
    rollbackSourceChanges(applied);
    throw error;
  }
  return applied;
}

/** Restores the files of applied edits, unless something else changed them since. */
export function rollbackSourceChanges(edits: readonly AppliedSourceEdit[]): void {
  for (const edit of [...edits].reverse()) {
    if (contentRevision(readSource(edit.path)) !== edit.updatedRevision) {
      throw new SourceChangedError(`Source changed after edit: ${edit.path}`);
    }
    atomicWrite(edit.path, edit.previousSource);
  }
}
