import { describe, expect, it } from 'vitest';
import { parseStandup, serializeStandup } from './parser.js';

describe('parseStandup', () => {
  it('should parse multi-section standup', () => {
    const content = `# Session Stand-Up

## Session abc123 (Updated: 2026-04-05T10:30:00Z)

Session file: ~/.sandpiper/agent/sessions/--Users-doug-git-test--/2026-04-05T10-00-00-000Z_abc123.jsonl

### Accomplished
- Fixed login bug

### In Progress
- Rate limiting

### Next Session
- Complete middleware

### Blockers
- None

### Context
- Working tree is clean

## Session def456 (Updated: 2026-04-05T10:25:00Z)

Session file: ~/.sandpiper/agent/sessions/--Users-doug-git-test--/2026-04-05T09-00-00-000Z_def456.jsonl

### Accomplished
- Code review

### In Progress
- None

### Next Session
- Follow up

### Blockers
- None

### Context
- None
`;

    const result = parseStandup(content);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]?.id).toBe('abc123');
    expect(result.sections[0]?.updated).toBe('2026-04-05T10:30:00Z');
    expect(result.sections[0]?.sessionFile).toBe(
      '~/.sandpiper/agent/sessions/--Users-doug-git-test--/2026-04-05T10-00-00-000Z_abc123.jsonl',
    );
    expect(result.sections[0]?.body).toContain('### Accomplished');
    expect(result.sections[1]?.id).toBe('def456');
  });

  it('should parse single-section standup', () => {
    const content = `# Session Stand-Up

## Session xyz789 (Updated: 2026-04-05T11:00:00Z)

Session file: /path/to/session.jsonl

### Accomplished
- Something

### In Progress
- Nothing

### Next Session
- More

### Blockers
- None

### Context
- Info
`;

    const result = parseStandup(content);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.id).toBe('xyz789');
  });

  it('should return empty sections for empty file', () => {
    const result = parseStandup('');
    expect(result.sections).toHaveLength(0);
  });

  it('should return empty sections for file with only header', () => {
    const content = '# Session Stand-Up\n';
    const result = parseStandup(content);
    expect(result.sections).toHaveLength(0);
  });

  it('should handle legacy format (no ## Session headers)', () => {
    // Real legacy format has no Session: or Session file: lines
    const content = `# Session Stand-Up

Updated: 2026-04-05T10:00:00Z

## Accomplished
- Old work

## In Progress
- Still going

## Next Session
- Continue

## Blockers
- None

## Context
- Legacy format
`;

    const result = parseStandup(content);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.id).toBe('unknown');
    expect(result.sections[0]?.updated).toBe('2026-04-05T10:00:00Z');
    expect(result.sections[0]?.sessionFile).toBe('');
    expect(result.sections[0]?.body).toContain('## Accomplished');
    expect(result.sections[0]?.body).toContain('Legacy format');
  });

  it('should parse an explicit PID line for portable, harness-agnostic liveness', () => {
    const content = `# Session Stand-Up

## Session claude-code-abc (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/session.jsonl
PID: 4242

### Accomplished
- Foreign harness work
`;

    const result = parseStandup(content);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.pid).toBe(4242);
    expect(result.sections[0]?.body).toContain('Foreign harness work');
  });

  it('should leave pid undefined for sections without a PID line', () => {
    const content = `# Session Stand-Up

## Session abc123 (Updated: 2026-04-05T10:30:00Z)

Session file: /path/to/session.jsonl

### Accomplished
- No pid recorded
`;

    const result = parseStandup(content);
    expect(result.sections[0]?.pid).toBeUndefined();
  });

  it('should handle malformed sections gracefully', () => {
    const content = `# Session Stand-Up

## Session abc123 (Updated: 2026-04-05T10:30:00Z)

Some content without proper structure

## Session def456 (Updated: 2026-04-05T10:25:00Z)

More content
`;

    const result = parseStandup(content);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]?.id).toBe('abc123');
    expect(result.sections[1]?.id).toBe('def456');
  });

  it('parses the new header format without the "Session" prefix (persistent identities like "Piper")', () => {
    const content = `# Session Stand-Up

## Piper (Updated: 2026-04-05T10:30:00Z)

Session file:

### Accomplished
- Work done under a persistent identity, not a session UUID
`;

    const result = parseStandup(content);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.id).toBe('Piper');
    expect(result.sections[0]?.body).toContain('persistent identity');
  });

  it('still parses the old "## Session <id>" header format for backward compatibility', () => {
    const content = `# Session Stand-Up

## Session abc123 (Updated: 2026-04-05T10:30:00Z)

Session file:

### Accomplished
- Old on-disk format, written before the header format changed
`;

    const result = parseStandup(content);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.id).toBe('abc123');
    expect(result.sections[0]?.body).toContain('Old on-disk format');
  });
});

describe('serializeStandup', () => {
  it('emits a PID line when the section has one', () => {
    const serialized = serializeStandup([
      { id: 'claude-code-abc', updated: '2026-04-05T10:30:00Z', sessionFile: '/path/to/session.jsonl', pid: 4242, body: 'body' },
    ]);
    expect(serialized).toContain('PID: 4242');
  });

  it('omits the PID line entirely when the section has no pid', () => {
    const serialized = serializeStandup([
      { id: 'abc123', updated: '2026-04-05T10:30:00Z', sessionFile: '/path/to/session.jsonl', body: 'body' },
    ]);
    expect(serialized).not.toContain('PID:');
  });

  it('round-trips a pid through serialize then parse', () => {
    const serialized = serializeStandup([
      { id: 'claude-code-abc', updated: '2026-04-05T10:30:00Z', sessionFile: '/path/to/session.jsonl', pid: 4242, body: 'body' },
    ]);
    const reparsed = parseStandup(serialized);
    expect(reparsed.sections[0]?.pid).toBe(4242);
  });

  it('writes headers without the "Session" prefix — reads naturally for a persistent identity like "Piper"', () => {
    const serialized = serializeStandup([
      { id: 'Piper', updated: '2026-04-05T10:30:00Z', sessionFile: '', body: 'body' },
    ]);
    expect(serialized).toContain('## Piper (Updated: 2026-04-05T10:30:00Z)');
    expect(serialized).not.toContain('## Session Piper');
  });

  it('round-trips an id through the new header format', () => {
    const serialized = serializeStandup([
      { id: 'Piper', updated: '2026-04-05T10:30:00Z', sessionFile: '', body: 'body text' },
    ]);
    const reparsed = parseStandup(serialized);
    expect(reparsed.sections[0]?.id).toBe('Piper');
    expect(reparsed.sections[0]?.body).toBe('body text');
  });
});
