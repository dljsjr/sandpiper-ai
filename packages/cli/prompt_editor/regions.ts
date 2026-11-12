import { realpathSync, statSync } from 'node:fs';
import type { DiagnosticPrompt, EditableSpan } from './diagnostic.js';
import { frontmatterBodyStart } from './frontmatter.js';
import { xmlTagSpans } from './markup.js';
import {
  buildProjection,
  type PromptProjection,
  readSource,
  renderSourceText,
  type SourceCandidate,
  type SourceCodec,
  uniqueOffset,
} from './projection.js';

/** Files to look for in the prompt besides the ones the diagnostic reports. */
export interface PromptSourceCatalog {
  /** `--prompt-source` paths, absolute. */
  readonly promptSources: readonly string[];
  /**
   * `--prompt-source-xml` paths, absolute: files the prompt holds XML-escaped. A file without `&`, `<` or `>` reads
   * the same either way, so only the caller can say which it is; it decides how new text is written back.
   */
  readonly escapedPromptSources?: readonly string[];
  /** The agent directory's USER.md. */
  readonly userProfile?: string;
}

const CODECS: readonly SourceCodec[] = ['direct', 'xml-text'];

type PlacedCandidate = SourceCandidate & { readonly promptStart: number };

function realFile(path: string): string | undefined {
  try {
    const real = realpathSync(path);
    return statSync(real).isFile() ? real : undefined;
  } catch {
    return undefined;
  }
}

function spanCandidate(prompt: string, span: EditableSpan): PlacedCandidate | undefined {
  const path = realFile(span.path);
  if (!path) return undefined;
  const source = readSource(path);
  if (span.sourceStart > span.sourceEnd || span.sourceEnd > source.length) return undefined;
  const renderedText = renderSourceText(source.slice(span.sourceStart, span.sourceEnd), span.codec);
  if (!renderedText || span.start + renderedText.length !== span.end) return undefined;
  if (prompt.slice(span.start, span.end) !== renderedText) return undefined;
  return {
    path,
    sourceStart: span.sourceStart,
    sourceEnd: span.sourceEnd,
    renderedText,
    codec: span.codec,
    label: span.path,
    promptStart: span.start,
  };
}

const BYTE_ORDER_MARK = '\uFEFF';

/**
 * The first rendering of the file that occurs exactly once in the prompt: the whole file, then the body after its
 * frontmatter, in each of `codecs`. A leading byte order mark is skipped, as Pi skips it when it reads a file.
 */
function matchedFileCandidate(
  prompt: string,
  label: string,
  path: string,
  codecs: readonly SourceCodec[],
): PlacedCandidate | undefined {
  const source = readSource(path);
  const contentStart = source.startsWith(BYTE_ORDER_MARK) ? BYTE_ORDER_MARK.length : 0;
  const sourceEnd = source.trimEnd().length;
  const bodyStart = contentStart + frontmatterBodyStart(source.slice(contentStart));
  const starts = bodyStart > contentStart && bodyStart < sourceEnd ? [contentStart, bodyStart] : [contentStart];
  for (const sourceStart of starts) {
    const text = source.slice(sourceStart, sourceEnd);
    if (!text) continue;
    for (const [index, codec] of codecs.entries()) {
      const renderedText = renderSourceText(text, codec);
      if (index > 0 && renderedText === text) continue;
      const promptStart = uniqueOffset(prompt, renderedText);
      if (promptStart !== undefined) return { path, sourceStart, sourceEnd, renderedText, codec, label, promptStart };
    }
  }
  return undefined;
}

/** Whether the candidate's prompt text has anything besides structural tags and whitespace. */
function hasContent(
  prompt: string,
  tags: ReadonlyArray<{ readonly start: number; readonly end: number }>,
  candidate: PlacedCandidate,
): boolean {
  const end = candidate.promptStart + candidate.renderedText.length;
  let cursor = candidate.promptStart;
  for (const tag of tags) {
    if (tag.start < cursor || tag.end > end) continue;
    if (prompt.slice(cursor, tag.start).trim()) return true;
    cursor = tag.end;
  }
  return prompt.slice(cursor, end).trim() !== '';
}

function overlaps(left: PlacedCandidate, right: PlacedCandidate): boolean {
  return (
    left.promptStart < right.promptStart + right.renderedText.length &&
    right.promptStart < left.promptStart + left.renderedText.length
  );
}

/**
 * Maps the prompt to the files it renders. The diagnostic's editable spans are exact and come first. Other files
 * are found by searching the prompt for their text. A region of only structural tags and whitespace, such as the
 * text between two placeholders of a template, stays locked: there is nothing in it to edit.
 */
export function buildEditorProjection(diagnostic: DiagnosticPrompt, catalog: PromptSourceCatalog): PromptProjection {
  const { prompt, sources } = diagnostic;
  const spans = diagnostic.editableSpans.flatMap((span) => spanCandidate(prompt, span) ?? []);
  const seen = new Set(spans.map((span) => span.path));

  const matched: PlacedCandidate[] = [];
  const labels = [
    ...catalog.promptSources,
    ...(sources.identity ? [sources.identity] : []),
    ...(sources.systemPrompt ? [sources.systemPrompt] : []),
    ...sources.appendSystemPrompts,
    ...sources.contextFiles,
    ...(catalog.userProfile ? [catalog.userProfile] : []),
  ];
  const escaped = new Set((catalog.escapedPromptSources ?? []).flatMap((label) => realFile(label) ?? []));
  for (const label of [...(catalog.escapedPromptSources ?? []), ...labels]) {
    const path = realFile(label);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const candidate = matchedFileCandidate(prompt, label, path, escaped.has(path) ? ['xml-text'] : CODECS);
    if (candidate && !spans.some((span) => overlaps(candidate, span))) matched.push(candidate);
  }

  const tags = xmlTagSpans(prompt);
  return buildProjection(
    prompt,
    [...spans, ...matched].filter((candidate) => hasContent(prompt, tags, candidate)),
  );
}
