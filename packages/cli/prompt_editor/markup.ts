import type { PromptProjection, PromptSegment, SourceCodec } from './projection.js';

// The name must end at a word boundary. Python's `\b` is Unicode-aware, and JavaScript's is not.
const XML_TAG_START =
  /<(\/?)([A-Za-z_][A-Za-z0-9_.:-]*)(?:(?<=[A-Za-z0-9_])(?![\p{L}\p{N}_])|(?<=[.:-])(?=[\p{L}\p{N}_]))/uy;

interface ElementTag {
  readonly start: number;
  readonly end: number;
  readonly name: string;
  readonly closing: boolean;
  readonly selfClosing: boolean;
}

function matchTagStart(text: string, start: number): RegExpExecArray | null {
  XML_TAG_START.lastIndex = start;
  return XML_TAG_START.exec(text);
}

/** The end of the markup starting at `start`, and the element tag it is, if any. */
function tagAt(text: string, start: number): { readonly end: number; readonly tag?: ElementTag } | undefined {
  let specialEnd: string | undefined;
  if (text.startsWith('<!--', start)) specialEnd = '-->';
  else if (text.startsWith('<![CDATA[', start)) specialEnd = ']]>';
  else if (text.startsWith('<!', start) || text.startsWith('<?', start)) specialEnd = '>';
  else if (!matchTagStart(text, start)) return undefined;

  if (specialEnd !== undefined && specialEnd !== '>') {
    const end = text.indexOf(specialEnd, start + 1);
    return end >= 0 ? { end: end + specialEnd.length } : undefined;
  }

  let quote: string | undefined;
  for (let cursor = start + 1; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (quote !== undefined) {
      if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '>') {
      const end = cursor + 1;
      const match = matchTagStart(text, start);
      if (!match) return { end };
      return {
        end,
        tag: {
          start,
          end,
          name: match[2] ?? '',
          closing: match[1] === '/',
          selfClosing: text.slice(start, cursor).trimEnd().endsWith('/'),
        },
      };
    }
  }
  return undefined;
}

function elementTags(text: string): ElementTag[] {
  const tags: ElementTag[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const start = text.indexOf('<', cursor);
    if (start < 0) break;
    const result = tagAt(text, start);
    if (!result) {
      cursor = start + 1;
      continue;
    }
    cursor = result.end;
    if (result.tag) tags.push(result.tag);
  }
  return tags;
}

/**
 * Tags that structure the prompt: matched pairs and self-closing tags that open on a line holding only markup.
 * Tag names mentioned in prose stay prose.
 */
function structuralElementTags(text: string): ElementTag[] {
  const tags = elementTags(text);
  const structural = new Set<number>();
  const openTags: Array<{ readonly name: string; readonly index: number }> = [];
  let cursor = 0;
  let lineContainsOnlyStructure = true;

  tags.forEach((tag, index) => {
    const between = text.slice(cursor, tag.start);
    if (between.includes('\n')) {
      lineContainsOnlyStructure = between.slice(between.lastIndexOf('\n') + 1).trim() === '';
    } else if (between.trim() !== '') {
      lineContainsOnlyStructure = false;
    }

    if (tag.closing) {
      const open = openTags.at(-1);
      if (open && open.name === tag.name) {
        openTags.pop();
        structural.add(open.index);
        structural.add(index);
      }
    } else if (lineContainsOnlyStructure) {
      if (tag.selfClosing) structural.add(index);
      else openTags.push({ name: tag.name, index });
    }
    cursor = tag.end;
  });

  return tags.filter((_tag, index) => structural.has(index));
}

/** The structural tags of `text`, which an edit must keep. */
export function xmlTags(text: string): string[] {
  return structuralElementTags(text).map((tag) => text.slice(tag.start, tag.end));
}

interface PromptPart {
  readonly text: string;
  readonly editable: boolean;
  readonly tag?: true;
  readonly anchorId?: string;
}

interface OpeningTag {
  readonly anchorId: string;
  readonly label: string;
  readonly text: string;
}

function partsFromTags(
  text: string,
  tags: readonly ElementTag[],
  textIsEditable: boolean,
  segmentIndex: number,
): { readonly parts: PromptPart[]; readonly openingTags: OpeningTag[] } {
  const parts: PromptPart[] = [];
  const openingTags: OpeningTag[] = [];
  let cursor = 0;

  for (const tag of tags) {
    if (cursor < tag.start) parts.push({ text: text.slice(cursor, tag.start), editable: textIsEditable });
    const tagText = text.slice(tag.start, tag.end);
    if (tag.closing) {
      parts.push({ text: tagText, editable: false, tag: true });
    } else {
      const anchorId = `prompt-tag-${segmentIndex}-${openingTags.length}`;
      parts.push({ text: tagText, editable: false, tag: true, anchorId });
      openingTags.push({ anchorId, label: `<${tag.name}>`, text: tagText });
    }
    cursor = tag.end;
  }

  if (cursor < text.length || parts.length === 0) parts.push({ text: text.slice(cursor), editable: textIsEditable });
  return { parts, openingTags };
}

function tagsWithinSegment(tags: readonly ElementTag[], start: number, end: number): ElementTag[] {
  return tags
    .filter((tag) => start <= tag.start && tag.end <= end)
    .map((tag) => ({ ...tag, start: tag.start - start, end: tag.end - start }));
}

/** Offsets of the top-level sections Pi appends after `</system_prompt>`. */
function piSectionStarts(tags: readonly ElementTag[]): number[] {
  let depth = 0;
  let systemPromptClosed = false;
  const starts: number[] = [];
  for (const tag of tags) {
    if (tag.closing) {
      depth -= 1;
      if (depth === 0 && tag.name === 'system_prompt') systemPromptClosed = true;
      continue;
    }
    if (depth === 0 && systemPromptClosed) starts.push(tag.start);
    if (!tag.selfClosing) depth += 1;
  }
  return starts;
}

function splitAtPiSections(
  segments: readonly PromptSegment[],
  piStarts: readonly number[],
): Array<{ readonly segment: PromptSegment; readonly generatedByPi: boolean }> {
  const pieces: Array<{ readonly segment: PromptSegment; readonly generatedByPi: boolean }> = [];
  const firstPiStart = piStarts[0];
  let offset = 0;
  for (const segment of segments) {
    const end = offset + segment.text.length;
    const cuts = segment.editable ? [] : piStarts.filter((start) => offset < start && start < end);
    const bounds = [offset, ...cuts, end];
    for (let index = 0; index + 1 < bounds.length; index += 1) {
      const start = bounds[index] ?? offset;
      const stop = bounds[index + 1] ?? end;
      pieces.push({
        segment: { ...segment, text: segment.text.slice(start - offset, stop - offset) },
        generatedByPi: firstPiStart !== undefined && start >= firstPiStart,
      });
    }
    offset = end;
  }
  return pieces;
}

function lockedRegionLabel(text: string, tags: readonly OpeningTag[]): string {
  const first = tags[0];
  if (first) return first.label;
  const compact = text.split(/\s+/).filter(Boolean).join(' ');
  if (!compact) return 'Whitespace';
  const characters = Array.from(compact);
  return characters.slice(0, 42).join('') + (characters.length > 42 ? '…' : '');
}

interface PayloadSegment {
  readonly text: string;
  readonly editable: boolean;
  readonly segmentId: string;
  readonly parts: readonly PromptPart[];
  readonly regionId?: string;
  readonly path?: string;
  readonly label?: string;
  readonly codec?: SourceCodec;
}

interface SourceEntry {
  readonly kind: 'source';
  readonly path: string;
  readonly label: string;
  readonly regionIds: string[];
  readonly tags: OpeningTag[];
}

interface LockedEntry {
  readonly kind: 'locked';
  readonly anchorId: string;
  readonly label: string;
  readonly tags: readonly OpeningTag[];
  readonly generatedBy?: 'pi';
}

export interface ProjectionPayload {
  readonly generation: number;
  readonly segments: readonly PayloadSegment[];
  readonly sources: readonly SourceEntry[];
  readonly lockedRegions: readonly LockedEntry[];
  readonly navigation: ReadonlyArray<SourceEntry | LockedEntry>;
  readonly warnings: readonly string[];
  readonly regionCount: number;
  readonly promptBytes: number;
  readonly editableBytes: number;
}

/** The prompt as the editor page renders it: segments split into locked tags and text, plus the outline. */
export function projectionPayload(
  projection: PromptProjection,
  warnings: readonly string[],
  generation: number,
): ProjectionPayload {
  const segments: PayloadSegment[] = [];
  const sources = new Map<string, SourceEntry>();
  const lockedRegions: LockedEntry[] = [];
  const navigation: Array<SourceEntry | LockedEntry> = [];
  let editableBytes = 0;
  const promptTags = structuralElementTags(projection.prompt);
  let promptOffset = 0;
  const pieces = splitAtPiSections(projection.segments, piSectionStarts(promptTags));

  pieces.forEach(({ segment, generatedByPi }, segmentIndex) => {
    const segmentId = `prompt-segment-${segmentIndex}`;
    const segmentEnd = promptOffset + segment.text.length;
    const { parts, openingTags } = partsFromTags(
      segment.text,
      tagsWithinSegment(promptTags, promptOffset, segmentEnd),
      segment.editable,
      segmentIndex,
    );
    promptOffset = segmentEnd;
    const item = { text: segment.text, editable: segment.editable, segmentId, parts };

    if (segment.region) {
      const { region } = segment;
      segments.push({ ...item, regionId: region.id, path: region.path, label: region.label, codec: region.codec });
      let source = sources.get(region.path);
      if (!source) {
        source = { kind: 'source', path: region.path, label: region.label, regionIds: [], tags: [] };
        sources.set(region.path, source);
        navigation.push(source);
      }
      source.regionIds.push(region.id);
      source.tags.push(...openingTags);
      editableBytes += parts
        .filter((part) => part.editable)
        .reduce((total, part) => total + Buffer.byteLength(part.text, 'utf-8'), 0);
    } else {
      const lockedRegion: LockedEntry = {
        kind: 'locked',
        anchorId: segmentId,
        label: lockedRegionLabel(segment.text, openingTags),
        tags: openingTags,
        ...(generatedByPi ? { generatedBy: 'pi' as const } : {}),
      };
      lockedRegions.push(lockedRegion);
      navigation.push(lockedRegion);
      segments.push(item);
    }
  });

  return {
    generation,
    segments,
    sources: [...sources.values()],
    lockedRegions,
    navigation,
    warnings: [...warnings],
    regionCount: projection.regions.length,
    promptBytes: Buffer.byteLength(projection.prompt, 'utf-8'),
    editableBytes,
  };
}
