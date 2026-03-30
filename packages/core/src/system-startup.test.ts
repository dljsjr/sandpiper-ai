import { describe, expect, it } from 'vitest';
import {
  buildSandpiperSystemPrompt,
  formatColdStartGuidance,
  formatStandupContext,
  shouldTreatInitialLoadAsColdStart,
} from './system-startup.js';

describe('system-startup', () => {
  describe('shouldTreatInitialLoadAsColdStart', () => {
    it('treats missing session file as a cold start', () => {
      expect(shouldTreatInitialLoadAsColdStart(undefined, [{ type: 'custom' }])).toBe(true);
    });

    it('treats sessions with no message entries as a cold start', () => {
      expect(shouldTreatInitialLoadAsColdStart('/tmp/session.jsonl', [{ type: 'custom' }])).toBe(true);
    });

    it('does not treat resumed sessions with a file and message history as a cold start', () => {
      expect(shouldTreatInitialLoadAsColdStart('/tmp/session.jsonl', [{ type: 'custom' }, { type: 'message' }])).toBe(
        false,
      );
    });
  });

  describe('formatStandupContext', () => {
    it('wraps standup content with startup guidance', () => {
      const formatted = formatStandupContext('# Session Stand-Up\n\nHello');
      expect(formatted).toContain('# Previous Session Context');
      expect(formatted).toContain('Do NOT read the session');
      expect(formatted).toContain('Hello');
    });

    it('returns empty string for empty content', () => {
      expect(formatStandupContext('')).toBe('');
    });
  });

  describe('formatColdStartGuidance', () => {
    it('returns cold-start-only guidance text', () => {
      const guidance = formatColdStartGuidance();
      expect(guidance).toContain('# Cold-Start Guidance');
      expect(guidance).toContain('stand-up below');
      expect(guidance).toContain('AGENTS.md routing table');
    });
  });

  describe('buildSandpiperSystemPrompt', () => {
    it('appends identity and startup context sections in order', () => {
      const prompt = buildSandpiperSystemPrompt('BASE', {
        piCodingAgentPackage: '/tmp/pi',
        piCodingAgentVersion: '0.64.0',
        projectTriggers: '\n<available_projects>...</available_projects>',
        activeTaskContext: '\n# Active Task Context\n- AGENT-1',
        workingCopyContext: '\n# Working Copy Context\n- AGENTS.md',
        coldStartGuidance: formatColdStartGuidance(),
        standupContent: formatStandupContext('# Session Stand-Up\n\nHi'),
      });

      expect(prompt).toContain("IMPORTANT: You are running via an extension framework called 'sandpiper'");
      expect(prompt).toContain('<available_projects>...</available_projects>');
      expect(prompt).toContain('# Active Task Context');
      expect(prompt).toContain('# Working Copy Context');
      expect(prompt).toContain('# Cold-Start Guidance');
      expect(prompt).toContain('# Previous Session Context');
      expect(prompt.indexOf('# Active Task Context')).toBeLessThan(prompt.indexOf('# Working Copy Context'));
      expect(prompt.indexOf('# Working Copy Context')).toBeLessThan(prompt.indexOf('# Previous Session Context'));
    });
  });
});
