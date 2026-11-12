const OPENING_DELIMITER = '---\n';
const CLOSING_DELIMITER = /^-{3,}[ \t]*$/;

function linesWithEnds(text: string): string[] {
  return text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g) ?? [];
}

function isMetadata(lines: string): boolean {
  return linesWithEnds(lines).every((rawLine) => {
    const line = rawLine.trim();
    return line === '' || line.startsWith('#') || line.includes(':');
  });
}

/**
 * Offset of the body after `key: value` frontmatter, or 0 when the file has none. The frontmatter opens
 * with `---` and closes with a line of three or more hyphens; blank lines after it are not body.
 */
export function frontmatterBodyStart(text: string): number {
  if (!text.startsWith(OPENING_DELIMITER)) return 0;

  let cursor = OPENING_DELIMITER.length;
  for (const line of linesWithEnds(text.slice(cursor))) {
    if (CLOSING_DELIMITER.test(line.replace(/[\r\n]+$/, ''))) {
      if (!isMetadata(text.slice(OPENING_DELIMITER.length, cursor))) return 0;
      let bodyStart = cursor + line.length;
      while (bodyStart < text.length && (text[bodyStart] === '\r' || text[bodyStart] === '\n')) bodyStart += 1;
      return bodyStart;
    }
    cursor += line.length;
  }
  return 0;
}
