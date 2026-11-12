import { realpathSync, statSync } from 'node:fs';
import type { DiagnosticPrompt, EditableSpan } from './diagnostic.js';
import { frontmatterBodyStart } from './frontmatter.js';
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

/**
 * The first rendering of the file that occurs exactly once in the prompt: the whole file, then the body after its
 * frontmatter, each verbatim and then XML-escaped.
 */
function matchedFileCandidate(prompt: string, label: string, path: string): PlacedCandidate | undefined {
  const source = readSource(path);
  const sourceEnd = source.trimEnd().length;
  const bodyStart = frontmatterBodyStart(source);
  const starts = bodyStart > 0 && bodyStart < sourceEnd ? [0, bodyStart] : [0];
  for (const sourceStart of starts) {
    const text = source.slice(sourceStart, sourceEnd);
    if (!text) continue;
    for (const codec of CODECS) {
      const renderedText = renderSourceText(text, codec);
      if (codec !== 'direct' && renderedText === text) continue;
      const promptStart = uniqueOffset(prompt, renderedText);
      if (promptStart !== undefined) return { path, sourceStart, sourceEnd, renderedText, codec, label, promptStart };
    }
  }
  return undefined;
}

function overlaps(left: PlacedCandidate, right: PlacedCandidate): boolean {
  return (
    left.promptStart < right.promptStart + right.renderedText.length &&
    right.promptStart < left.promptStart + left.renderedText.length
  );
}

/**
 * Maps the prompt to the files it renders. The diagnostic's editable spans are exact and come first. Other files
 * are found by searching the prompt for their text.
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
  for (const label of labels) {
    const path = realFile(label);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const candidate = matchedFileCandidate(prompt, label, path);
    if (candidate && !spans.some((span) => overlaps(candidate, span))) matched.push(candidate);
  }

  return buildProjection(prompt, [...spans, ...matched]);
}
