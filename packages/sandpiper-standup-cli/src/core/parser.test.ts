import { describe, expect, it } from 'vitest';
import { parseStandup } from './parser.js';

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
    expect(result.sections[0]?.uuid).toBe('abc123');
    expect(result.sections[0]?.updated).toBe('2026-04-05T10:30:00Z');
    expect(result.sections[0]?.sessionFile).toBe(
      '~/.sandpiper/agent/sessions/--Users-doug-git-test--/2026-04-05T10-00-00-000Z_abc123.jsonl',
    );
    expect(result.sections[0]?.body).toContain('### Accomplished');
    expect(result.sections[1]?.uuid).toBe('def456');
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
    expect(result.sections[0]?.uuid).toBe('xyz789');
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
    expect(result.sections[0]?.uuid).toBe('unknown');
    expect(result.sections[0]?.updated).toBe('2026-04-05T10:00:00Z');
    expect(result.sections[0]?.sessionFile).toBe('');
    expect(result.sections[0]?.body).toContain('## Accomplished');
    expect(result.sections[0]?.body).toContain('Legacy format');
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
    expect(result.sections[0]?.uuid).toBe('abc123');
    expect(result.sections[1]?.uuid).toBe('def456');
  });
});
