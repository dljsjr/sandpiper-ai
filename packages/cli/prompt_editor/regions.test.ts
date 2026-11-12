import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DiagnosticPrompt, EditableSpan } from './diagnostic.js';
import type { PromptProjection } from './projection.js';
import { buildEditorProjection } from './regions.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prompt-regions-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeSource(name: string, content: string): string {
  const path = join(root, name);
  writeFileSync(path, content, 'utf-8');
  return realpathSync(path);
}

function diagnostic(prompt: string, overrides: Partial<DiagnosticPrompt> = {}): DiagnosticPrompt {
  return {
    prompt,
    warnings: [],
    sources: { appendSystemPrompts: [], contextFiles: [] },
    editableSpans: [],
    ...overrides,
  };
}

function editableText(projection: PromptProjection): Array<[string, string, string]> {
  return projection.regions.map((region) => [
    region.path,
    region.codec,
    projection.prompt.slice(region.promptStart, region.promptEnd),
  ]);
}

describe('editable spans', () => {
  it('maps each span whose prompt text matches its source span exactly', () => {
    const source = writeSource('AGENTS.md', 'intro\n> quoted & kept\n');
    const prompt = 'before &gt; quoted &amp; kept after';
    const span: EditableSpan = {
      start: prompt.indexOf('&gt;'),
      end: prompt.indexOf(' after'),
      path: source,
      sourceStart: 6,
      sourceEnd: 21,
      codec: 'xml-text',
    };

    const projection = buildEditorProjection(diagnostic(prompt, { editableSpans: [span] }), { promptSources: [] });

    expect(editableText(projection)).toEqual([[source, 'xml-text', '&gt; quoted &amp; kept']]);
    expect(projection.regions[0]).toMatchObject({ sourceStart: 6, sourceEnd: 21, label: source });
  });

  it('makes text editable where a span pins it, even when the text repeats', () => {
    const source = writeSource('AGENTS.md', 'repeated\n');
    const prompt = 'repeated | repeated';
    const span: EditableSpan = { start: 11, end: 19, path: source, sourceStart: 0, sourceEnd: 8, codec: 'direct' };

    const projection = buildEditorProjection(diagnostic(prompt, { editableSpans: [span] }), { promptSources: [] });

    expect(projection.regions.map((region) => region.promptStart)).toEqual([11]);
  });

  it('drops a span whose prompt text does not match its source', () => {
    const source = writeSource('AGENTS.md', 'repeated\n');
    const prompt = 'repeated | repeated';
    const span: EditableSpan = { start: 0, end: 8, path: source, sourceStart: 0, sourceEnd: 7, codec: 'direct' };

    const projection = buildEditorProjection(
      diagnostic(prompt, { editableSpans: [span, { ...span, path: join(root, 'missing.md') }] }),
      { promptSources: [] },
    );

    expect(projection.regions).toEqual([]);
  });

  it('does not search for text from a file a span already covers', () => {
    const source = writeSource('AGENTS.md', 'alpha beta\n');
    const prompt = 'alpha beta | beta';
    const span: EditableSpan = { start: 13, end: 17, path: source, sourceStart: 6, sourceEnd: 10, codec: 'direct' };

    const projection = buildEditorProjection(
      diagnostic(prompt, { editableSpans: [span], sources: { appendSystemPrompts: [], contextFiles: [source] } }),
      { promptSources: [] },
    );

    expect(projection.regions.map((region) => region.promptStart)).toEqual([13]);
  });

  it('locks spans that hold only structural tags and whitespace', () => {
    const prompt = '<a>\n<b>\nkept text\n</b>\n\n</a>';
    const template = writeSource('template.md', `${prompt}\n`);
    const span = (start: number, end: number): EditableSpan => ({
      start,
      end,
      path: template,
      sourceStart: start,
      sourceEnd: end,
      codec: 'direct',
    });
    const bodyEnd = prompt.indexOf('</b>');

    const projection = buildEditorProjection(
      diagnostic(prompt, {
        editableSpans: [span(0, 4), span(4, bodyEnd), span(bodyEnd, bodyEnd + 6), span(bodyEnd + 6, prompt.length)],
      }),
      { promptSources: [] },
    );

    expect(editableText(projection)).toEqual([[template, 'direct', '<b>\nkept text\n']]);
  });

  it('keeps a span whose only tags are prose mentions', () => {
    const prompt = '<a>\nSee `<policy>`.\n</a>';
    const template = writeSource('template.md', '`<policy>`\n');
    const start = prompt.indexOf('`');
    const span: EditableSpan = {
      start,
      end: start + 10,
      path: template,
      sourceStart: 0,
      sourceEnd: 10,
      codec: 'direct',
    };

    const projection = buildEditorProjection(diagnostic(prompt, { editableSpans: [span] }), { promptSources: [] });

    expect(editableText(projection)).toEqual([[template, 'direct', '`<policy>`']]);
  });

  it('prefers a span over a matched file that overlaps it', () => {
    const outer = writeSource('outer.md', 'outer [inner text] outer\n');
    const inner = writeSource('inner.md', 'inner text\n');
    const prompt = 'outer [inner text] outer';
    const span: EditableSpan = { start: 7, end: 17, path: inner, sourceStart: 0, sourceEnd: 10, codec: 'direct' };

    const projection = buildEditorProjection(diagnostic(prompt, { editableSpans: [span] }), {
      promptSources: [outer],
    });

    expect(editableText(projection)).toEqual([[inner, 'direct', 'inner text']]);
  });
});

describe('matched source files', () => {
  it('maps a prompt source file where its text occurs exactly once', () => {
    const source = writeSource('voice.md', '<voice>steady</voice>\n');

    const projection = buildEditorProjection(diagnostic('<identity>\n<voice>steady</voice>\n</identity>'), {
      promptSources: [source],
    });

    expect(editableText(projection)).toEqual([[source, 'direct', '<voice>steady</voice>']]);
  });

  it('leaves a file locked when its text occurs more than once', () => {
    const source = writeSource('voice.md', 'steady\n');

    const projection = buildEditorProjection(diagnostic('steady and steady'), { promptSources: [source] });

    expect(projection.regions).toEqual([]);
  });

  it('maps an XML-escaped file as xml-text', () => {
    const source = writeSource('IDENTITY.md', '> identity & voice\n');

    const projection = buildEditorProjection(
      diagnostic('<identity><content>&gt; identity &amp; voice</content></identity>'),
      { promptSources: [source] },
    );

    expect(editableText(projection)).toEqual([[source, 'xml-text', '&gt; identity &amp; voice']]);
  });

  it('maps the body after frontmatter with an extended hyphen delimiter', () => {
    const body = '# SELF.md — Roux\n\nMost of the self & more.\n\n---\n\nFooter.';
    const self = writeSource('SELF.md', `---\n\nname: Roux\njob: Pilot\n----------------------\n\n${body}\n`);
    const escapedBody = body.replace('&', '&amp;');

    const projection = buildEditorProjection(diagnostic(`<self><content>${escapedBody}</content></self>`), {
      promptSources: [self],
    });

    expect(editableText(projection)).toEqual([[self, 'xml-text', escapedBody]]);
  });

  it('maps identity, user profile, context, and appended prompt files the diagnostic reports', () => {
    const identity = writeSource('identity.md', '# Identity file\n');
    const userProfile = writeSource('USER.md', '# User profile\n');
    const context = writeSource('AGENTS.md', '# Context\n');
    const append = writeSource('append.md', '<append>from file</append>\n');
    const systemPrompt = writeSource('SYSTEM.md', 'System prompt file\n');
    const prompt = [
      '<identity># Identity file</identity>',
      'System prompt file',
      '<user_profile><content># User profile</content></user_profile>',
      '<context_file path="AGENTS.md"># Context</context_file>',
      '<append>from file</append>',
      '<append>raw and locked</append>',
    ].join('\n');

    const projection = buildEditorProjection(
      diagnostic(prompt, {
        sources: { identity, systemPrompt, appendSystemPrompts: [append], contextFiles: [context] },
      }),
      { promptSources: [], userProfile },
    );

    expect(new Set(projection.regions.map((region) => region.path))).toEqual(
      new Set([identity, systemPrompt, userProfile, context, append]),
    );
    const locked = projection.segments
      .filter((segment) => !segment.editable)
      .map((segment) => segment.text)
      .join('');
    expect(locked).toContain('<append>raw and locked</append>');
  });

  it('locks a matched file that holds only structural tags', () => {
    const source = writeSource('wrapper.md', '<wrapper>\n</wrapper>\n');

    const projection = buildEditorProjection(diagnostic('<root>\n<wrapper>\n</wrapper>\n</root>'), {
      promptSources: [source],
    });

    expect(projection.regions).toEqual([]);
  });

  it('maps a file named twice once, and skips missing and empty files', () => {
    const context = writeSource('AGENTS.md', '# Context\n');
    const empty = writeSource('empty.md', '\n\n');

    const projection = buildEditorProjection(
      diagnostic('<ctx># Context</ctx>', { sources: { appendSystemPrompts: [], contextFiles: [context] } }),
      { promptSources: [context, empty, join(root, 'missing.md')] },
    );

    expect(editableText(projection)).toEqual([[context, 'direct', '# Context']]);
  });
});
