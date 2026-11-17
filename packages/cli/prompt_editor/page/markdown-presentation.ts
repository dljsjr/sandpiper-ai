// How the prompt editor presents Markdown source: which ranges it styles, which markers it hides, and which tables
// it renders. Pure over the text, its Lezer syntax tree, and the selection, so it runs without CodeMirror.

import type { SyntaxNode, SyntaxNodeRef, Tree } from '@lezer/common';

export type MarkdownStyleKind =
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'strong'
  | 'emphasis'
  | 'strikethrough'
  | 'inline-code'
  | 'link'
  | 'blockquote'
  | 'list'
  | 'fenced-code'
  | 'table';

export type MarkdownLineKind =
  | 'heading-1'
  | 'heading-2'
  | 'heading-3'
  | 'heading-4'
  | 'heading-5'
  | 'heading-6'
  | 'blockquote'
  | 'fenced-code'
  | 'table-source';

export interface MarkdownRange {
  readonly from: number;
  readonly to: number;
}

export interface MarkdownStyleRange extends MarkdownRange {
  readonly kind: MarkdownStyleKind;
}

export interface MarkdownLineStyle {
  readonly from: number;
  readonly kind: MarkdownLineKind;
}

export interface MarkdownTable extends MarkdownRange {
  readonly headers: readonly string[];
  readonly alignments: ReadonlyArray<'left' | 'center' | 'right' | null>;
  readonly rows: ReadonlyArray<readonly string[]>;
}

export interface MarkdownPresentation {
  readonly styles: readonly MarkdownStyleRange[];
  readonly hiddenMarkers: readonly MarkdownRange[];
  readonly lines: readonly MarkdownLineStyle[];
  readonly tables: readonly MarkdownTable[];
}

const styleKinds: Readonly<Record<string, MarkdownStyleKind>> = {
  ATXHeading1: 'heading-1',
  ATXHeading2: 'heading-2',
  ATXHeading3: 'heading-3',
  ATXHeading4: 'heading-4',
  ATXHeading5: 'heading-5',
  ATXHeading6: 'heading-6',
  StrongEmphasis: 'strong',
  Emphasis: 'emphasis',
  Strikethrough: 'strikethrough',
  InlineCode: 'inline-code',
  Link: 'link',
  Blockquote: 'blockquote',
  BulletList: 'list',
  OrderedList: 'list',
  FencedCode: 'fenced-code',
  Table: 'table',
};

/** The text being presented, with the selection of the editor that shows it. */
interface PresentationSource {
  /** Uses `\n` line breaks, as a CodeMirror document does. */
  readonly text: string;
  readonly selection: readonly MarkdownRange[];
  readonly focused: boolean;
}

/** Whether the user is editing inside `from`–`to`: the editor is focused and a cursor or selection is in it. */
function isActive(source: PresentationSource, from: number, to: number): boolean {
  return (
    source.focused &&
    source.selection.some((range) =>
      range.from === range.to ? range.from >= from && range.from < to : range.from < to && range.to > from,
    )
  );
}

/** The line that contains `position`, without its line break. */
function lineAt(text: string, position: number): MarkdownRange {
  const from = position === 0 ? 0 : text.lastIndexOf('\n', position - 1) + 1;
  const end = text.indexOf('\n', position);
  return { from, to: end < 0 ? text.length : end };
}

function appendLines(text: string, from: number, to: number, kind: MarkdownLineKind, lines: MarkdownLineStyle[]): void {
  for (let position = from; position <= to; ) {
    const line = lineAt(text, position);
    lines.push({ from: line.from, kind });
    if (line.to >= to || line.to === text.length) break;
    position = line.to + 1;
  }
}

function directChildren(node: SyntaxNode, name: string): SyntaxNode[] {
  const matches: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === name) matches.push(child);
  }
  return matches;
}

function tableAlignment(cell: string): 'left' | 'center' | 'right' | null {
  const marker = cell.trim();
  const left = marker.startsWith(':');
  const right = marker.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

function tableData(text: string, table: SyntaxNode): MarkdownTable | null {
  let header: SyntaxNode | null = null;
  let delimiter: SyntaxNode | null = null;
  const rows: SyntaxNode[] = [];
  for (let child = table.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableHeader') header = child;
    else if (child.name === 'TableDelimiter') delimiter = child;
    else if (child.name === 'TableRow') rows.push(child);
  }
  if (!header || !delimiter) return null;

  const headers = directChildren(header, 'TableCell').map((cell) => text.slice(cell.from, cell.to).trim());
  const delimiterSource = text.slice(delimiter.from, delimiter.to).trim().replace(/^\|/, '').replace(/\|$/, '');
  const alignments = delimiterSource.split('|').map(tableAlignment);
  if (headers.length === 0 || alignments.length !== headers.length) return null;

  return {
    from: table.from,
    to: table.to,
    headers,
    alignments,
    rows: rows.map((row) => directChildren(row, 'TableCell').map((cell) => text.slice(cell.from, cell.to).trim())),
  };
}

function formattingParent(node: SyntaxNodeRef): SyntaxNode | null {
  const parent = node.node.parent;
  if (!parent) return null;
  if (
    parent.name === 'StrongEmphasis' ||
    parent.name === 'Emphasis' ||
    parent.name === 'Strikethrough' ||
    parent.name === 'InlineCode' ||
    parent.name === 'Link'
  ) {
    return parent;
  }
  return null;
}

type MarkdownHeadingKind = Extract<MarkdownStyleKind, `heading-${number}`>;

interface PresentationAccumulator {
  readonly styles: MarkdownStyleRange[];
  readonly hiddenMarkers: MarkdownRange[];
  readonly lines: MarkdownLineStyle[];
  readonly tables: MarkdownTable[];
}

const inlineMarkerNames = new Set(['EmphasisMark', 'StrikethroughMark', 'CodeMark', 'LinkMark', 'URL']);

function isHeadingKind(kind: MarkdownStyleKind): kind is MarkdownHeadingKind {
  return kind.startsWith('heading-');
}

function appendBlockPresentation(
  source: PresentationSource,
  node: SyntaxNodeRef,
  accumulator: PresentationAccumulator,
): boolean {
  const headingKind = styleKinds[node.name];
  if (headingKind && isHeadingKind(headingKind)) {
    accumulator.lines.push({
      from: lineAt(source.text, node.from).from,
      kind: headingKind,
    });
  } else if (node.name === 'Blockquote') {
    appendLines(source.text, node.from, node.to, 'blockquote', accumulator.lines);
  } else if (node.name === 'FencedCode') {
    appendLines(source.text, node.from, node.to, 'fenced-code', accumulator.lines);
  } else if (node.name === 'Table') {
    if (isActive(source, node.from, node.to)) {
      appendLines(source.text, node.from, node.to, 'table-source', accumulator.lines);
    } else {
      const table = tableData(source.text, node.node);
      if (table) accumulator.tables.push(table);
      return false;
    }
  }
  return true;
}

function appendHiddenMarker(source: PresentationSource, node: SyntaxNodeRef, hiddenMarkers: MarkdownRange[]): void {
  if (node.name === 'HeaderMark') {
    const line = lineAt(source.text, node.from);
    if (!isActive(source, line.from, line.to + 1)) {
      hiddenMarkers.push({ from: node.from, to: node.to });
    }
    return;
  }
  if (!inlineMarkerNames.has(node.name)) return;

  const parent = formattingParent(node);
  if (parent && !isActive(source, parent.from, parent.to)) {
    hiddenMarkers.push({ from: node.from, to: node.to });
  }
}

/**
 * How to present `text`, given its Markdown syntax `tree` and the editor's `selection`. Markers stay visible and
 * tables stay source around the selection while the editor is `focused`; elsewhere markers hide and tables render.
 * A cursor is a selection range whose `from` equals its `to`. `text` uses `\n` line breaks.
 */
export function buildMarkdownPresentation(
  text: string,
  tree: Tree,
  selection: readonly MarkdownRange[],
  focused: boolean,
): MarkdownPresentation {
  const source: PresentationSource = { text, selection, focused };
  const accumulator: PresentationAccumulator = {
    styles: [],
    hiddenMarkers: [],
    lines: [],
    tables: [],
  };

  tree.iterate({
    enter(node) {
      const kind = styleKinds[node.name];
      if (kind) {
        accumulator.styles.push({ from: node.from, to: node.to, kind });
      }
      if (!appendBlockPresentation(source, node, accumulator)) return false;
      appendHiddenMarker(source, node, accumulator.hiddenMarkers);
      return undefined;
    },
  });

  return {
    ...accumulator,
    hiddenMarkers: accumulator.hiddenMarkers.sort((left, right) => left.from - right.from),
  };
}

/** Inline formatting in a rendered table cell. Code text is literal; the other kinds nest. */
export type InlineMarkdownNode =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'strong' | 'emphasis' | 'strikethrough'; readonly children: readonly InlineMarkdownNode[] }
  | { readonly kind: 'link'; readonly url: string; readonly children: readonly InlineMarkdownNode[] };

interface InlineMatch {
  readonly index: number;
  readonly source: string;
  readonly content: string;
  readonly kind: 'code' | 'strong' | 'emphasis' | 'strikethrough' | 'link';
  readonly detail?: string;
}

function nextInlineMatch(text: string, from: number): InlineMatch | null {
  const patterns: ReadonlyArray<{
    readonly kind: InlineMatch['kind'];
    readonly expression: RegExp;
  }> = [
    { kind: 'code', expression: /`([^`\n]+)`/g },
    { kind: 'strong', expression: /\*\*([^*\n]+)\*\*/g },
    { kind: 'strong', expression: /__([^_\n]+)__/g },
    { kind: 'strikethrough', expression: /~~([^~\n]+)~~/g },
    { kind: 'link', expression: /\[([^\]\n]+)\]\(([^)\n]+)\)/g },
    { kind: 'emphasis', expression: /\*([^*\n]+)\*/g },
    { kind: 'emphasis', expression: /_([^_\n]+)_/g },
  ];
  let nearest: InlineMatch | null = null;
  for (const { kind, expression } of patterns) {
    expression.lastIndex = from;
    const match = expression.exec(text);
    if (!match || (nearest && match.index >= nearest.index)) continue;
    nearest = {
      index: match.index,
      source: match[0] ?? '',
      content: match[1] ?? '',
      kind,
      ...(match[2] ? { detail: match[2] } : {}),
    };
  }
  return nearest;
}

function inlineNode(match: InlineMatch): InlineMarkdownNode {
  if (match.kind === 'code') return { kind: 'code', text: match.content };
  const children = parseInlineMarkdown(match.content);
  if (match.kind === 'link') return { kind: 'link', url: match.detail ?? '', children };
  return { kind: match.kind, children };
}

/** Splits the text of a table cell into its inline Markdown formatting. */
export function parseInlineMarkdown(text: string): InlineMarkdownNode[] {
  const nodes: InlineMarkdownNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const match = nextInlineMatch(text, cursor);
    if (!match) {
      nodes.push({ kind: 'text', text: text.slice(cursor) });
      break;
    }
    if (match.index > cursor) {
      nodes.push({ kind: 'text', text: text.slice(cursor, match.index) });
    }
    nodes.push(inlineNode(match));
    cursor = match.index + match.source.length;
  }
  return nodes;
}
