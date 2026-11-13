import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PromptDiagnosticError, parseDiagnosticOutput, runPromptDiagnostic } from './diagnostic.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prompt-diagnostic-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeRunner(body: string): string {
  const runner = join(root, 'runner.mjs');
  writeFileSync(runner, body, 'utf-8');
  return runner;
}

describe('runPromptDiagnostic', () => {
  it('runs in the given directory and environment and reads sources and warnings', async () => {
    const workdir = join(root, 'identity');
    mkdirSync(workdir);
    const contextFile = join(workdir, 'AGENTS.md');
    const identitySource = join(workdir, 'identity.md');
    const runner = writeRunner(`
      console.error('runner warning');
      console.error('Warning: diagnostic warning');
      console.log(JSON.stringify({
        prompt: [process.cwd(), process.env.EDITOR_PROBE, process.argv.at(-1)].join('|'),
        warnings: ['diagnostic warning'],
        sources: {
          identity: ${JSON.stringify(identitySource)},
          contextFiles: [${JSON.stringify(contextFile)}],
          appendSystemPrompts: [],
        },
        json: true,
      }));
    `);

    const result = await runPromptDiagnostic({
      program: process.execPath,
      args: [runner, '--json', 'last-argument'],
      cwd: workdir,
      env: { ...process.env, EDITOR_PROBE: 'ready' },
    });

    expect(result.prompt).toBe(`${realpathSync(workdir)}|ready|last-argument`);
    expect(result.warnings).toEqual(['diagnostic warning', 'runner warning']);
    expect(result.sources).toEqual({ identity: identitySource, appendSystemPrompts: [], contextFiles: [contextFile] });
    expect(result.editableSpans).toEqual([]);
  });

  it('reports the exit status and stderr of a failed render', async () => {
    const runner = writeRunner(`console.error('invalid prompt flag'); process.exit(3);`);

    const render = runPromptDiagnostic({ program: process.execPath, args: [runner], cwd: root, env: process.env });

    await expect(render).rejects.toThrow(PromptDiagnosticError);
    await expect(render).rejects.toThrow('System prompt diagnostic failed (3): invalid prompt flag');
  });
});

describe('parseDiagnosticOutput', () => {
  it('reads editable spans, ignores a codec field, and drops malformed ones', () => {
    const span = { start: 1, end: 5, path: '/tmp/a.md', sourceStart: 0, sourceEnd: 4 };
    const stdout = JSON.stringify({
      prompt: 'xabcd',
      warnings: [],
      sources: { appendSystemPrompts: [], contextFiles: [] },
      editableSpans: [span, { ...span, codec: 'direct' }, { ...span, start: -1 }, { ...span, sourceEnd: '4' }],
    });

    expect(parseDiagnosticOutput(stdout, '').editableSpans).toEqual([span, span]);
  });

  it('rejects output without a prompt', () => {
    expect(() => parseDiagnosticOutput(JSON.stringify({ sources: {} }), '')).toThrow(
      'Invalid JSON from system prompt diagnostic: prompt',
    );
    expect(() => parseDiagnosticOutput('not json', '')).toThrow(PromptDiagnosticError);
  });
});
