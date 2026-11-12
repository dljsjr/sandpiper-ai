import { describe, expect, it } from 'vitest';
import { frontmatterBodyStart } from './frontmatter.js';

describe('frontmatterBodyStart', () => {
  it('starts the body after an extended hyphen delimiter and the blank lines after it', () => {
    const body = '# SELF.md — Roux\n\nMost of the self.\n\n---\n\nFooter.\n';
    const source = `---\n\nname: Roux\njob: Pilot\n----------------------\n\n${body}`;

    expect(source.slice(frontmatterBodyStart(source))).toBe(body);
  });

  it('does not treat a later thematic break as the end of frontmatter', () => {
    const source = '---\n# SELF.md\n\nBody text.\n\n---\n\nFooter.\n';

    expect(frontmatterBodyStart(source)).toBe(0);
  });

  it('finds no body in a file without frontmatter or without a closing delimiter', () => {
    expect(frontmatterBodyStart('# Title\n\n---\n')).toBe(0);
    expect(frontmatterBodyStart('---\nname: Roux\n')).toBe(0);
  });
});
