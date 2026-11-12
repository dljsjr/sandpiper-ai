import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { projectionPayload, xmlTags } from './markup.js';
import { buildProjection, fileCandidate, sourceCandidate } from './projection.js';

// Trimmed from `sandpiper-system-prompt --json` output on Pi 1.0.4, with personal content and paths replaced.
function pi10Prompt(identity: string): string {
  return readFileSync(new URL('./fixtures/pi_1_0_system_prompt.txt', import.meta.url), 'utf-8').replace(
    'IDENTITY_BODY',
    identity,
  );
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prompt-markup-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeSource(name: string, content: string): string {
  const path = join(root, name);
  writeFileSync(path, content, 'utf-8');
  return path;
}

function partPairs(
  parts: ReadonlyArray<{ readonly text: string; readonly editable: boolean }>,
): Array<[string, boolean]> {
  return parts.map((part) => [part.text, part.editable]);
}

describe('projection payload', () => {
  it('serializes locked and file-backed segments for the page', () => {
    const source = writeSource('source.md', 'editable\n');
    const projection = buildProjection('locked editable locked', [fileCandidate(source)]);

    const payload = projectionPayload(projection, ['warning'], 3);

    expect(payload.generation).toBe(3);
    expect(payload.regionCount).toBe(1);
    expect(payload.warnings).toEqual(['warning']);
    expect(payload.segments.map((segment) => segment.editable)).toEqual([false, true, false]);
    expect(payload.navigation.map((entry) => entry.kind)).toEqual(['locked', 'source', 'locked']);
    expect(payload.segments[1]?.path).toBe(realpathSync(source));
    expect(payload.segments[1]?.codec).toBe('direct');
    expect(payload.promptBytes).toBe(22);
    expect(payload.editableBytes).toBe(8);
  });

  it('keeps inline XML tag references editable and out of the outline', () => {
    const content = 'Guidance mentions the `<policy>` block, beside `<self>`.\n';
    const source = writeSource('AGENTS.md', content);
    const projection = buildProjection(content.trimEnd(), [fileCandidate(source)]);

    const payload = projectionPayload(projection, [], 1);

    const segment = payload.segments[0]!;
    expect(payload.sources[0]?.tags).toEqual([]);
    expect(xmlTags(content)).toEqual([]);
    expect(xmlTags(content.replace('<policy>', '<procedure>'))).toEqual([]);
    expect(segment.parts.every((part) => part.editable)).toBe(true);
    expect(segment.parts.map((part) => part.text).join('')).toBe(content.trimEnd());
  });

  it('does not make inline tag references in locked text outline sections', () => {
    const payload = projectionPayload(buildProjection('Generated prose mentions the `<policy>` block.', []), [], 1);

    expect(payload.lockedRegions[0]?.tags).toEqual([]);
    expect(payload.segments[0]?.parts.some((part) => part.tag)).toBe(false);
  });

  it('keeps the source editable and the Pi sections locked in a Pi 1.0 prompt', () => {
    const source = writeSource('IDENTITY.md', 'original\n');
    const prompt = pi10Prompt('original');

    const payload = projectionPayload(buildProjection(prompt, [fileCandidate(source)]), [], 1);

    const { segments } = payload;
    expect(segments.map((segment) => segment.text).join('')).toBe(prompt);
    expect(segments.filter((segment) => segment.editable).map((segment) => segment.text)).toEqual(['original']);
    const lockedText = segments
      .filter((segment) => !segment.editable)
      .map((segment) => segment.text)
      .join('');
    const lockedTags = payload.lockedRegions.flatMap((region) => region.tags.map((tag) => tag.label));
    for (const name of ['tools', 'rules', 'cwd']) {
      expect(lockedText).toContain(`<${name}>`);
      expect(lockedText).toContain(`</${name}>`);
      expect(lockedTags).toContain(`<${name}>`);
    }
    expect(lockedText).toContain('</system_prompt>');
  });

  it('gives each section Pi adds its own outline entry', () => {
    const source = writeSource('IDENTITY.md', 'original\n');

    const payload = projectionPayload(buildProjection(pi10Prompt('original'), [fileCandidate(source)]), [], 1);

    const piEntries = payload.navigation.filter((entry) => entry.kind === 'locked' && entry.generatedBy === 'pi');
    expect(piEntries.map((entry) => [entry.label, entry.kind === 'locked' ? entry.generatedBy : undefined])).toEqual([
      ['<tools>', 'pi'],
      ['<rules>', 'pi'],
      ['<cwd>', 'pi'],
    ]);
    expect(payload.navigation.slice(-3)).toEqual(piEntries);
    const segments = new Map(payload.segments.map((segment) => [segment.segmentId, segment]));
    for (const entry of piEntries) {
      if (entry.kind !== 'locked') throw new Error('expected a locked entry');
      expect(segments.get(entry.anchorId)?.text.startsWith(entry.label)).toBe(true);
    }
    const tail = payload.navigation.at(-4);
    if (tail?.kind !== 'locked') throw new Error('expected a locked entry');
    expect(segments.get(tail.anchorId)?.text.trimEnd().endsWith('</system_prompt>')).toBe(true);
  });

  it('marks extension sections after the system prompt as added by Pi', () => {
    const projection = buildProjection(
      '<system_prompt><identity>x</identity></system_prompt>\n\n<tools>\n- read\n</tools>\n\n<mcp_servers>\n- docs\n</mcp_servers>',
      [],
    );

    const payload = projectionPayload(projection, [], 1);

    expect(
      payload.navigation.map((entry) => [entry.label, entry.kind === 'locked' ? entry.generatedBy : undefined]),
    ).toEqual([
      ['<system_prompt>', undefined],
      ['<tools>', 'pi'],
      ['<mcp_servers>', 'pi'],
    ]);
  });

  it('marks no section as added by Pi without a system prompt root', () => {
    const payload = projectionPayload(buildProjection('<outer>a</outer>\n\n<tools>\n- read\n</tools>', []), [], 1);

    expect(payload.navigation.some((entry) => entry.kind === 'locked' && entry.generatedBy)).toBe(false);
  });

  it('locks XML tags and exposes opening tags for navigation', () => {
    const source = writeSource('source.md', '<section kind="example">editable</section>\n');
    const projection = buildProjection('<outer><section kind="example">editable</section></outer>', [
      fileCandidate(source),
    ]);

    const payload = projectionPayload(projection, [], 1);

    const editable = payload.segments.find((segment) => segment.editable)!;
    expect(partPairs(editable.parts)).toEqual([
      ['<section kind="example">', false],
      ['editable', true],
      ['</section>', false],
    ]);
    expect(payload.sources[0]?.tags.map((tag) => tag.label)).toEqual(['<section>']);
    expect(payload.lockedRegions[0]?.tags.map((tag) => tag.label)).toEqual(['<outer>']);
  });

  it('keeps angle brackets in text and attributes when it locks tags', () => {
    const content = '<node condition="1 > 0">x < y</node>\n';
    const source = writeSource('source.md', content);

    const payload = projectionPayload(buildProjection(content.trimEnd(), [fileCandidate(source)]), [], 1);

    const segment = payload.segments[0]!;
    expect(segment.parts.map((part) => part.text).join('')).toBe(content.trimEnd());
    expect(partPairs(segment.parts)).toEqual([
      ['<node condition="1 > 0">', false],
      ['x < y', true],
      ['</node>', false],
    ]);
  });

  it('ends tag names at a Unicode word boundary', () => {
    expect(xmlTags('<abé>\nx\n</abé>')).toEqual([]);
    expect(xmlTags('<a.b>\nx\n</a.b>')).toEqual(['<a.b>', '</a.b>']);
  });

  it('groups several editable ranges of one source under one outline entry', () => {
    const source = writeSource('template.md', 'left LOCK right\n');
    const projection = buildProjection('left LOCK right', [
      sourceCandidate(source, 0, 5, 'direct', 0),
      sourceCandidate(source, 9, 15, 'direct', 9),
    ]);

    const payload = projectionPayload(projection, [], 1);

    expect(payload.sources).toHaveLength(1);
    expect(payload.sources[0]?.regionIds).toEqual(projection.regions.map((region) => region.id));
    expect(payload.navigation.map((entry) => entry.kind)).toEqual(['source', 'locked']);
  });
});
