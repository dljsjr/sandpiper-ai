import { readFileSync, realpathSync } from 'node:fs';

/**
 * A run of rendered text copied verbatim from a file: `text.slice(start, end)` equals
 * `source.slice(sourceStart, sourceEnd)`. Offsets are UTF-16 code units (JavaScript string
 * indices). The diagnostic contract reserves codec 'xml-text' for XML-escaped text; Sandpiper
 * inserts every sourced text verbatim today.
 */
export interface EditableSpan {
  readonly start: number;
  readonly end: number;
  readonly path: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly codec: 'direct';
}

export interface RenderedText {
  readonly text: string;
  readonly spans: readonly EditableSpan[];
}

/** A computed string, which maps to no file, or text that carries its own spans. */
export type TemplateValue = string | RenderedText;

type TemplateChunk =
  | { readonly kind: 'literal'; readonly text: string; readonly sourceStart: number }
  | { readonly kind: 'placeholder'; readonly name: string };

export interface PromptTemplate {
  readonly path: string;
  readonly chunks: readonly TemplateChunk[];
}

const PLACEHOLDER = /\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g;

/**
 * A template is the file's text without its final newline. `{{name}}` is a placeholder; all other
 * text, including any other braces, is literal.
 */
export function parsePromptTemplate(path: string, source: string): PromptTemplate {
  const body = source.endsWith('\n') ? source.slice(0, -1) : source;
  const chunks: TemplateChunk[] = [];
  let offset = 0;
  for (const match of body.matchAll(PLACEHOLDER)) {
    if (match.index > offset) {
      chunks.push({ kind: 'literal', text: body.slice(offset, match.index), sourceStart: offset });
    }
    chunks.push({ kind: 'placeholder', name: match[1] ?? '' });
    offset = match.index + match[0].length;
  }
  if (offset < body.length) {
    chunks.push({ kind: 'literal', text: body.slice(offset), sourceStart: offset });
  }
  return { path, chunks };
}

export function readPromptTemplate(path: string): PromptTemplate {
  const realPath = realpathSync(path);
  return parsePromptTemplate(realPath, readFileSync(realPath, 'utf-8'));
}

/** Text inserted verbatim from `path`, starting at `sourceStart` in that file. */
export function sourcedText(text: string, path: string, sourceStart = 0): RenderedText {
  if (text === '') return { text, spans: [] };
  return {
    text,
    spans: [{ start: 0, end: text.length, path, sourceStart, sourceEnd: sourceStart + text.length, codec: 'direct' }],
  };
}

export function joinRendered(parts: readonly TemplateValue[], separator = ''): RenderedText {
  let text = '';
  const spans: EditableSpan[] = [];
  parts.forEach((part, index) => {
    if (index > 0) text += separator;
    if (typeof part === 'string') {
      text += part;
      return;
    }
    for (const span of part.spans) {
      spans.push({ ...span, start: span.start + text.length, end: span.end + text.length });
    }
    text += part.text;
  });
  return { text, spans };
}

export function renderPromptTemplate(
  template: PromptTemplate,
  values: Readonly<Record<string, TemplateValue>>,
): RenderedText {
  return joinRendered(
    template.chunks.map((chunk) => {
      if (chunk.kind === 'literal') return sourcedText(chunk.text, template.path, chunk.sourceStart);
      const value = values[chunk.name];
      if (value === undefined) {
        throw new Error(`${template.path}: unknown placeholder {{${chunk.name}}}`);
      }
      return value;
    }),
  );
}

const BYTE_ORDER_MARK = '\uFEFF';

/**
 * Keep the spans whose text in `text` matches the current contents of their source file, with
 * the path resolved to its real path. Drops spans whose file cannot be read.
 */
export function verifyEditableSpans(text: string, spans: readonly EditableSpan[]): EditableSpan[] {
  const sources = new Map<string, { readonly path: string; readonly text: string } | undefined>();
  const readSource = (path: string) => {
    if (!sources.has(path)) {
      try {
        const realPath = realpathSync(path);
        sources.set(path, { path: realPath, text: readFileSync(realPath, 'utf-8') });
      } catch {
        sources.set(path, undefined);
      }
    }
    return sources.get(path);
  };

  const matches = (span: EditableSpan, source: { readonly text: string }) =>
    span.start >= 0 &&
    span.end <= text.length &&
    span.sourceStart >= 0 &&
    span.sourceEnd <= source.text.length &&
    span.end - span.start === span.sourceEnd - span.sourceStart &&
    text.slice(span.start, span.end) === source.text.slice(span.sourceStart, span.sourceEnd);

  return spans.flatMap((span) => {
    const source = readSource(span.path);
    if (source === undefined) return [];
    if (matches(span, source)) return [{ ...span, path: source.path }];
    // Pi drops a file's leading byte order mark when it reads it, so offsets taken from the content it
    // returned are one short of the file's.
    if (!source.text.startsWith(BYTE_ORDER_MARK)) return [];
    const shifted = { ...span, sourceStart: span.sourceStart + 1, sourceEnd: span.sourceEnd + 1 };
    return matches(shifted, source) ? [{ ...shifted, path: source.path }] : [];
  });
}
