/// <reference lib="dom" />
// Runs in the editor page, not in Node or Bun. page_assets.ts builds it into an IIFE that the page inlines.

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownKeymap, markdownLanguage } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, type KeyBinding, keymap, WidgetType } from '@codemirror/view';
import type { SyntaxNode, SyntaxNodeRef } from '@lezer/common';
import { tags } from '@lezer/highlight';

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

const markdownSupport = markdown({
  base: markdownLanguage,
  completeHTMLTags: false,
  pasteURLAsLink: false,
});

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

export function createPromptMarkdownState(doc: string, anchor = 0): EditorState {
  const cursor = Math.max(0, Math.min(anchor, doc.length));
  return EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [markdownSupport],
  });
}

function selectionTouches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((range) =>
    range.empty ? range.head >= from && range.head < to : range.from < to && range.to > from,
  );
}

function appendLines(
  state: EditorState,
  from: number,
  to: number,
  kind: MarkdownLineKind,
  lines: MarkdownLineStyle[],
): void {
  for (let position = from; position <= to; ) {
    const line = state.doc.lineAt(position);
    lines.push({ from: line.from, kind });
    if (line.to >= to || line.to === state.doc.length) break;
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

function tableData(state: EditorState, table: SyntaxNode): MarkdownTable | null {
  let header: SyntaxNode | null = null;
  let delimiter: SyntaxNode | null = null;
  const rows: SyntaxNode[] = [];
  for (let child = table.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TableHeader') header = child;
    else if (child.name === 'TableDelimiter') delimiter = child;
    else if (child.name === 'TableRow') rows.push(child);
  }
  if (!header || !delimiter) return null;

  const headers = directChildren(header, 'TableCell').map((cell) => state.doc.sliceString(cell.from, cell.to).trim());
  const delimiterSource = state.doc
    .sliceString(delimiter.from, delimiter.to)
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '');
  const alignments = delimiterSource.split('|').map(tableAlignment);
  if (headers.length === 0 || alignments.length !== headers.length) return null;

  return {
    from: table.from,
    to: table.to,
    headers,
    alignments,
    rows: rows.map((row) =>
      directChildren(row, 'TableCell').map((cell) => state.doc.sliceString(cell.from, cell.to).trim()),
    ),
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
  state: EditorState,
  focused: boolean,
  node: SyntaxNodeRef,
  accumulator: PresentationAccumulator,
): boolean {
  const headingKind = styleKinds[node.name];
  if (headingKind && isHeadingKind(headingKind)) {
    accumulator.lines.push({
      from: state.doc.lineAt(node.from).from,
      kind: headingKind,
    });
  } else if (node.name === 'Blockquote') {
    appendLines(state, node.from, node.to, 'blockquote', accumulator.lines);
  } else if (node.name === 'FencedCode') {
    appendLines(state, node.from, node.to, 'fenced-code', accumulator.lines);
  } else if (node.name === 'Table') {
    if (focused && selectionTouches(state, node.from, node.to)) {
      appendLines(state, node.from, node.to, 'table-source', accumulator.lines);
    } else {
      const table = tableData(state, node.node);
      if (table) accumulator.tables.push(table);
      return false;
    }
  }
  return true;
}

function appendHiddenMarker(
  state: EditorState,
  focused: boolean,
  node: SyntaxNodeRef,
  hiddenMarkers: MarkdownRange[],
): void {
  if (node.name === 'HeaderMark') {
    const line = state.doc.lineAt(node.from);
    if (!(focused && selectionTouches(state, line.from, line.to + 1))) {
      hiddenMarkers.push({ from: node.from, to: node.to });
    }
    return;
  }
  if (!inlineMarkerNames.has(node.name)) return;

  const parent = formattingParent(node);
  if (parent && !(focused && selectionTouches(state, parent.from, parent.to))) {
    hiddenMarkers.push({ from: node.from, to: node.to });
  }
}

export function buildMarkdownPresentation(state: EditorState, focused: boolean): MarkdownPresentation {
  const accumulator: PresentationAccumulator = {
    styles: [],
    hiddenMarkers: [],
    lines: [],
    tables: [],
  };

  syntaxTree(state).iterate({
    enter(node) {
      const kind = styleKinds[node.name];
      if (kind) {
        accumulator.styles.push({ from: node.from, to: node.to, kind });
      }
      if (!appendBlockPresentation(state, focused, node, accumulator)) return false;
      appendHiddenMarker(state, focused, node, accumulator.hiddenMarkers);
      return undefined;
    },
  });

  return {
    ...accumulator,
    hiddenMarkers: accumulator.hiddenMarkers.sort((left, right) => left.from - right.from),
  };
}

const focusChanged = StateEffect.define<boolean>();

class TableWidget extends WidgetType {
  readonly signature: string;

  constructor(
    readonly table: MarkdownTable,
    readonly sourcePosition: number,
  ) {
    super();
    this.signature = JSON.stringify(table);
  }

  override eq(other: TableWidget): boolean {
    return this.signature === other.signature;
  }

  override toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-live-table-widget';
    container.title = 'Click to edit Markdown table source';
    const table = document.createElement('table');
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    this.table.headers.forEach((text, index) => {
      const cell = document.createElement('th');
      appendInlineMarkdown(cell, text);
      applyAlignment(cell, this.table.alignments[index]);
      headerRow.appendChild(cell);
    });
    header.appendChild(headerRow);
    table.appendChild(header);

    const body = document.createElement('tbody');
    for (const row of this.table.rows) {
      const tableRow = document.createElement('tr');
      row.forEach((text, index) => {
        const cell = document.createElement('td');
        appendInlineMarkdown(cell, text);
        applyAlignment(cell, this.table.alignments[index]);
        tableRow.appendChild(cell);
      });
      body.appendChild(tableRow);
    }
    table.appendChild(body);
    container.appendChild(table);
    container.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        selection: { anchor: this.sourcePosition },
        scrollIntoView: true,
      });
      view.focus();
    });
    return container;
  }
}

function applyAlignment(cell: HTMLTableCellElement, alignment: 'left' | 'center' | 'right' | null | undefined): void {
  if (alignment) cell.style.textAlign = alignment;
}

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

function appendInlineMarkdown(parent: HTMLElement, text: string): void {
  let cursor = 0;
  while (cursor < text.length) {
    const match = nextInlineMatch(text, cursor);
    if (!match) {
      parent.appendChild(document.createTextNode(text.slice(cursor)));
      return;
    }
    if (match.index > cursor) {
      parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    }
    const tagName =
      match.kind === 'code'
        ? 'code'
        : match.kind === 'strong'
          ? 'strong'
          : match.kind === 'emphasis'
            ? 'em'
            : match.kind === 'strikethrough'
              ? 's'
              : 'span';
    const element = document.createElement(tagName);
    element.className = `cm-live-${match.kind}`;
    if (match.kind === 'link' && match.detail) element.title = match.detail;
    if (match.kind === 'code') {
      element.textContent = match.content;
    } else {
      appendInlineMarkdown(element, match.content);
    }
    parent.appendChild(element);
    cursor = match.index + match.source.length;
  }
}

const styleClass: Readonly<Record<MarkdownStyleKind, string>> = {
  'heading-1': 'cm-live-heading-1',
  'heading-2': 'cm-live-heading-2',
  'heading-3': 'cm-live-heading-3',
  'heading-4': 'cm-live-heading-4',
  'heading-5': 'cm-live-heading-5',
  'heading-6': 'cm-live-heading-6',
  strong: 'cm-live-strong',
  emphasis: 'cm-live-emphasis',
  strikethrough: 'cm-live-strikethrough',
  'inline-code': 'cm-live-inline-code',
  link: 'cm-live-link',
  blockquote: 'cm-live-blockquote-range',
  list: 'cm-live-list',
  'fenced-code': 'cm-live-fenced-code-range',
  table: 'cm-live-table-range',
};

const lineClass: Readonly<Record<MarkdownLineKind, string>> = {
  'heading-1': 'cm-live-heading-line cm-live-heading-line-1',
  'heading-2': 'cm-live-heading-line cm-live-heading-line-2',
  'heading-3': 'cm-live-heading-line cm-live-heading-line-3',
  'heading-4': 'cm-live-heading-line cm-live-heading-line-4',
  'heading-5': 'cm-live-heading-line cm-live-heading-line-5',
  'heading-6': 'cm-live-heading-line cm-live-heading-line-6',
  blockquote: 'cm-live-blockquote-line',
  'fenced-code': 'cm-live-fenced-code-line',
  'table-source': 'cm-live-table-source',
};

function presentationDecorations(state: EditorState, focused: boolean): DecorationSet {
  const presentation = buildMarkdownPresentation(state, focused);
  const ranges = [
    ...presentation.styles.map((style) =>
      Decoration.mark({ class: styleClass[style.kind] }).range(style.from, style.to),
    ),
    ...presentation.hiddenMarkers.map((marker) => Decoration.replace({}).range(marker.from, marker.to)),
    ...presentation.lines.map((line) => Decoration.line({ class: lineClass[line.kind] }).range(line.from)),
    ...presentation.tables.map((table) =>
      Decoration.replace({
        block: true,
        widget: new TableWidget(table, table.from),
      }).range(table.from, table.to),
    ),
  ];
  return Decoration.set(ranges, true);
}

interface LivePreviewState {
  readonly focused: boolean;
  readonly decorations: DecorationSet;
}

const livePreviewField = StateField.define<LivePreviewState>({
  create(state) {
    return { focused: false, decorations: presentationDecorations(state, false) };
  },
  update(value, transaction) {
    let focused = value.focused;
    for (const effect of transaction.effects) {
      if (effect.is(focusChanged)) focused = effect.value;
    }
    // Long documents are parsed in the background after the first slice. Those transactions
    // change only the syntax tree, and the presentation must follow it.
    if (
      transaction.docChanged ||
      transaction.selection !== undefined ||
      transaction.reconfigured ||
      focused !== value.focused ||
      syntaxTree(transaction.state) !== syntaxTree(transaction.startState)
    ) {
      return {
        focused,
        decorations: presentationDecorations(transaction.state, focused),
      };
    }
    return value;
  },
  provide(field) {
    return EditorView.decorations.from(field, (value) => value.decorations);
  },
});

export interface SearchSpec {
  readonly query: string;
  readonly caseSensitive: boolean;
  readonly current: number;
}

interface SearchState {
  readonly spec: SearchSpec | null;
  readonly matches: readonly MarkdownRange[];
  readonly decorations: DecorationSet;
}

const setSearch = StateEffect.define<SearchSpec | null>();
const noSearch: SearchState = { spec: null, matches: [], decorations: Decoration.none };

export function findMatches(doc: string, query: string, caseSensitive: boolean): MarkdownRange[] {
  if (!query) return [];
  const haystack = caseSensitive ? doc : doc.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: MarkdownRange[] = [];
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) {
    matches.push({ from: at, to: at + needle.length });
  }
  return matches;
}

function searchState(state: EditorState, spec: SearchSpec | null): SearchState {
  if (!spec?.query) return noSearch;
  const matches = findMatches(state.doc.toString(), spec.query, spec.caseSensitive);
  const decorations = Decoration.set(
    matches.map((match, index) =>
      Decoration.mark({
        class: index === spec.current ? 'cm-search-current' : 'cm-search-match',
      }).range(match.from, match.to),
    ),
  );
  return { spec, matches, decorations };
}

const searchField = StateField.define<SearchState>({
  create: () => noSearch,
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setSearch)) return searchState(transaction.state, effect.value);
    }
    return transaction.docChanged ? searchState(transaction.state, value.spec) : value;
  },
  provide(field) {
    return EditorView.decorations.from(field, (value) => value.decorations);
  },
});

const promptHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--accent)', fontWeight: '650' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, color: 'var(--code-text, var(--text))' },
  { tag: tags.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--muted)' },
  { tag: tags.quote, color: 'var(--muted)' },
  { tag: tags.meta, color: 'var(--muted)' },
]);

const promptEditorTheme = EditorView.theme({
  '&': {
    width: '100%',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    font: 'inherit',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    overflow: 'visible',
    fontFamily: 'inherit',
    lineHeight: 'inherit',
  },
  '.cm-content': {
    minHeight: '1.5em',
    padding: '0',
    caretColor: 'var(--accent)',
    tabSize: '2',
  },
  '.cm-line': { padding: '0' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
  },
  '.cm-live-heading-line': {
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '700',
    color: 'var(--text)',
  },
  '.cm-live-heading-line-1': { fontSize: '1.65em', lineHeight: '1.35' },
  '.cm-live-heading-line-2': { fontSize: '1.42em', lineHeight: '1.35' },
  '.cm-live-heading-line-3': { fontSize: '1.24em', lineHeight: '1.4' },
  '.cm-live-heading-line-4': { fontSize: '1.1em' },
  '.cm-live-heading-line-5, .cm-live-heading-line-6': { fontSize: '1em' },
  '.cm-live-strong': { fontWeight: '700' },
  '.cm-live-emphasis': { fontStyle: 'italic' },
  '.cm-live-strikethrough': { textDecoration: 'line-through' },
  '.cm-live-inline-code, .cm-live-code': {
    border: '1px solid var(--line)',
    borderRadius: '4px',
    backgroundColor: 'var(--locked)',
    padding: '0 0.22em',
  },
  '.cm-live-link': { color: 'var(--accent)', textDecoration: 'underline' },
  '.cm-live-blockquote-line': {
    borderLeft: '3px solid var(--line)',
    color: 'var(--muted)',
    paddingLeft: '0.7em',
  },
  '.cm-live-fenced-code-line': {
    backgroundColor: 'var(--locked)',
    paddingLeft: '0.65em',
    paddingRight: '0.65em',
  },
  '.cm-live-table-source': { backgroundColor: 'var(--locked)' },
  '.cm-live-table-widget': {
    display: 'block',
    overflowX: 'auto',
    margin: '0.45em 0',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    backgroundColor: 'var(--panel)',
    cursor: 'text',
  },
  '.cm-live-table-widget table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '0.95em',
  },
  '.cm-live-table-widget th, .cm-live-table-widget td': {
    borderRight: '1px solid var(--line)',
    borderBottom: '1px solid var(--line)',
    padding: '0.4em 0.6em',
    textAlign: 'left',
    verticalAlign: 'top',
  },
  '.cm-live-table-widget th': {
    backgroundColor: 'var(--locked)',
    fontWeight: '650',
  },
  '.cm-live-table-widget tr:last-child td': { borderBottom: '0' },
  '.cm-search-match': {
    borderRadius: '2px',
    backgroundColor: 'var(--search-match)',
  },
  '.cm-search-current': {
    borderRadius: '2px',
    backgroundColor: 'var(--search-current)',
    color: 'var(--search-current-text)',
    boxShadow: '0 0 0 1px var(--search-current)',
  },
  '.cm-live-table-widget th:last-child, .cm-live-table-widget td:last-child': {
    borderRight: '0',
  },
});

export interface PromptMarkdownEditorOptions {
  readonly doc: string;
  readonly onChange: (value: string) => void;
  readonly onSave: () => void;
}

export interface PromptMarkdownEditor {
  value(): string;
  setValue(value: string): void;
  focus(): void;
  destroy(): void;
  /** Highlight every match of `query` and return how many there are. An empty query clears it. */
  search(query: string, caseSensitive: boolean): number;
  /** Mark one match of the current search as current and scroll it to the middle of the view. */
  revealMatch(index: number): void;
}

export function mountPromptMarkdownEditor(
  parent: HTMLElement,
  options: PromptMarkdownEditorOptions,
): PromptMarkdownEditor {
  const saveBinding: KeyBinding = {
    key: 'Mod-s',
    preventDefault: true,
    run() {
      options.onSave();
      return true;
    },
  };
  const state = EditorState.create({
    doc: options.doc,
    extensions: [
      history(),
      markdownSupport,
      syntaxHighlighting(promptHighlightStyle),
      livePreviewField,
      searchField,
      EditorView.focusChangeEffect.of((_state, focusing) => focusChanged.of(focusing)),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-label': 'Markdown prompt source',
        autocapitalize: 'off',
        autocomplete: 'off',
        spellcheck: 'false',
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange(update.state.doc.toString());
      }),
      keymap.of([saveBinding, ...markdownKeymap, ...defaultKeymap, ...historyKeymap]),
      promptEditorTheme,
    ],
  });
  const view = new EditorView({ state, parent });
  return {
    value: () => view.state.doc.toString(),
    setValue(value) {
      const current = view.state.doc.toString();
      if (value === current) return;
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
    search(query, caseSensitive) {
      view.dispatch({
        effects: setSearch.of(query ? { query, caseSensitive, current: -1 } : null),
      });
      return view.state.field(searchField).matches.length;
    },
    revealMatch(index) {
      const { spec, matches } = view.state.field(searchField);
      const match = matches[index];
      if (!spec || !match) return;
      view.dispatch({
        effects: [setSearch.of({ ...spec, current: index }), EditorView.scrollIntoView(match.from, { y: 'center' })],
      });
    },
  };
}

declare global {
  interface Window {
    promptMarkdown?: {
      mount: typeof mountPromptMarkdownEditor;
    };
  }
}

if (typeof window !== 'undefined') {
  window.promptMarkdown = { mount: mountPromptMarkdownEditor };
}
