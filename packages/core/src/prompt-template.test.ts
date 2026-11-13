import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  joinRendered,
  parsePromptTemplate,
  readPromptTemplate,
  renderPromptTemplate,
  sourcedText,
  verifyEditableSpans,
} from './prompt-template.js';

describe('prompt templates', () => {
  let root: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'sandpiper-prompt-template-')));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('renders literals and placeholders, dropping only the final newline of the file', () => {
    const template = parsePromptTemplate('/t.md', '<a>\n{{first}} and {{second}}  \n</a>\n\n');

    expect(renderPromptTemplate(template, { first: 'one', second: 'two' }).text).toBe('<a>\none and two  \n</a>\n');
  });

  it('keeps text that only looks like a placeholder', () => {
    const template = parsePromptTemplate('/t.md', '{{ spaced }} {single} {{1digit}} {{-x}}');

    expect(renderPromptTemplate(template, {}).text).toBe('{{ spaced }} {single} {{1digit}} {{-x}}');
  });

  it('fails loudly on a placeholder without a value', () => {
    const template = parsePromptTemplate('/t.md', 'Hello {{nmae}}');

    expect(() => renderPromptTemplate(template, { name: 'x' })).toThrow('/t.md: unknown placeholder {{nmae}}');
  });

  it('maps every literal chunk back to its file offsets', () => {
    const source = 'A {{x}} BB\n';
    const rendered = renderPromptTemplate(parsePromptTemplate('/t.md', source), { x: 'computed' });

    expect(rendered).toEqual({
      text: 'A computed BB',
      spans: [
        { start: 0, end: 2, path: '/t.md', sourceStart: 0, sourceEnd: 2 },
        { start: 10, end: 13, path: '/t.md', sourceStart: 7, sourceEnd: 10 },
      ],
    });
  });

  it('shifts the spans of nested values and joined parts', () => {
    const inner = sourcedText('user text', '/user.md');
    const outer = renderPromptTemplate(parsePromptTemplate('/outer.md', '[{{body}}]'), {
      body: joinRendered(['pre', inner], '\n'),
    });

    expect(outer.text).toBe('[pre\nuser text]');
    expect(outer.spans).toEqual([
      { start: 0, end: 1, path: '/outer.md', sourceStart: 0, sourceEnd: 1 },
      { start: 5, end: 14, path: '/user.md', sourceStart: 0, sourceEnd: 9 },
      { start: 14, end: 15, path: '/outer.md', sourceStart: 9, sourceEnd: 10 },
    ]);
  });

  it('emits no span for empty sourced text', () => {
    expect(sourcedText('', '/user.md')).toEqual({ text: '', spans: [] });
  });

  it('reads templates by real path', () => {
    mkdirSync(join(root, 'real'));
    writeFileSync(join(root, 'real', 't.md'), 'Hi {{name}}\n');
    symlinkSync(join(root, 'real'), join(root, 'link'));

    const template = readPromptTemplate(join(root, 'link', 't.md'));

    expect(template.path).toBe(join(root, 'real', 't.md'));
    expect(renderPromptTemplate(template, { name: 'there' }).text).toBe('Hi there');
  });

  describe('verifyEditableSpans', () => {
    it('keeps matching spans and resolves their real paths', () => {
      mkdirSync(join(root, 'real'));
      writeFileSync(join(root, 'real', 'user.md'), 'Hello world');
      symlinkSync(join(root, 'real'), join(root, 'link'));
      const rendered = joinRendered(['> ', sourcedText('world', join(root, 'link', 'user.md'), 6)]);

      expect(verifyEditableSpans(rendered.text, rendered.spans)).toEqual([
        { start: 2, end: 7, path: join(root, 'real', 'user.md'), sourceStart: 6, sourceEnd: 11 },
      ]);
    });

    it('shifts spans past a byte order mark that Pi dropped while reading the file', () => {
      writeFileSync(join(root, 'AGENTS.md'), '\uFEFF# Rules\n');
      const rendered = joinRendered(['<context>', sourcedText('# Rules', join(root, 'AGENTS.md')), '</context>']);

      expect(verifyEditableSpans(rendered.text, rendered.spans)).toEqual([
        { start: 9, end: 16, path: join(root, 'AGENTS.md'), sourceStart: 1, sourceEnd: 8 },
      ]);
    });

    it('drops spans whose file changed, is missing, or is out of range', () => {
      writeFileSync(join(root, 'user.md'), 'Hello world');
      const changed = sourcedText('Hello there', join(root, 'user.md'));
      const missing = sourcedText('gone', join(root, 'missing.md'));
      const outOfRange = sourcedText('Hello world!', join(root, 'user.md'));
      const rendered = joinRendered([changed, missing, outOfRange]);

      expect(verifyEditableSpans(rendered.text, rendered.spans)).toEqual([]);
      expect(verifyEditableSpans('short', sourcedText('Hello', join(root, 'user.md'), 0).spans)).toEqual([]);
    });
  });
});
