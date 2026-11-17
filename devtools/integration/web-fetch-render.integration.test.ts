// WEB-10: renderers that an extension registers on the event bus reach web_fetch in a real
// session. web_fetch registers at load and again on the first run, once renderers are known.
// web_fetch is deferred (AGENT-330): the first request lists it for tool_search, and the model
// loads it before calling it. This proves the model gets the final tool when it loads it, and
// that nothing about the prompt or the tool declarations changes afterwards.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RENDERER_FIXTURE_IDS, rendererFixtureMarker } from './fixtures/renderer-fixture.js';
import { encodeMockScript, MOCK_RECORD_ENV_VAR, MOCK_SCRIPT_ENV_VAR } from './mock-provider.js';
import { startRpcSession } from './rpc-driver.js';

const TIMEOUT_MS = 60_000;
const RENDERER_FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'renderer-fixture.ts');
// Nothing listens here, so llms.txt discovery fails at once and the test needs no network.
const PAGE_URL = 'http://127.0.0.1:1/app';

/** Pi sends the prompt and the tool declarations in system messages: one at the start, then one per change. */
interface SystemMessage {
  readonly role: 'system';
  readonly sections?: Readonly<Record<string, string>>;
  readonly toolsAdded?: readonly {
    readonly name: string;
    readonly parameters: { readonly properties: { readonly renderer?: { readonly enum?: readonly string[] } } };
  }[];
}

interface RecordedRequest {
  readonly messages: readonly (SystemMessage | { readonly role: 'user' | 'assistant' | 'toolResult' })[];
}

function systemMessages(request: RecordedRequest | undefined): readonly SystemMessage[] {
  return (request?.messages ?? []).filter((message): message is SystemMessage => message.role === 'system');
}

describe('web_fetch renderers in a real session (WEB-10)', () => {
  it(
    'offers rendering from the first request and keeps the prompt and tools stable across turns',
    async () => {
      const recordDir = mkdtempSync(join(tmpdir(), 'sp-render-record-'));
      const recordPath = join(recordDir, 'requests.jsonl');
      const session = startRpcSession({
        entry: 'sandpiper',
        extraExtensions: [RENDERER_FIXTURE],
        env: {
          [MOCK_RECORD_ENV_VAR]: recordPath,
          [MOCK_SCRIPT_ENV_VAR]: encodeMockScript([
            { type: 'toolCall', toolName: 'tool_search', arguments: { query: 'web_fetch' } },
            { type: 'toolCall', toolName: 'web_fetch', arguments: { url: PAGE_URL, renderer: 'fixture-b' } },
            { type: 'text', text: 'first turn done' },
            { type: 'text', text: 'second turn done' },
          ]),
        },
        commandTimeoutMs: TIMEOUT_MS,
      });

      try {
        expect((await session.sendCommand({ type: 'prompt', message: 'render the page' })).success).toBe(true);
        const toolEnd = await session.waitForEvent(
          (event) => event.type === 'tool_execution_end' && event.toolName === 'web_fetch',
          TIMEOUT_MS,
        );
        const result = toolEnd.result as { content: { type: string; text?: string }[] };
        expect(result.content[0]?.text).toContain(rendererFixtureMarker('fixture-b', PAGE_URL));
        await session.waitForEvent((event) => event.type === 'agent_settled', TIMEOUT_MS);

        const settledBefore = session.events.filter((event) => event.type === 'agent_settled').length;
        expect((await session.sendCommand({ type: 'prompt', message: 'and again' })).success).toBe(true);
        await session.waitForEvent(
          () => session.events.filter((event) => event.type === 'agent_settled').length > settledBefore,
          TIMEOUT_MS,
        );

        const requests = readFileSync(recordPath, 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line) as RecordedRequest);
        expect(requests).toHaveLength(4);

        const [initial] = systemMessages(requests[0]);
        expect(initial?.toolsAdded?.map((tool) => tool.name)).not.toContain('web_fetch');
        expect(initial?.sections?.tools).toContain('<deferred_tools>');
        expect(initial?.sections?.tools).toContain('  - web_fetch: ');

        const afterLoad = systemMessages(requests[1]);
        expect(afterLoad).toHaveLength(2);
        expect(afterLoad[0]).toEqual(initial);
        const webFetch = afterLoad[1]?.toolsAdded?.find((tool) => tool.name === 'web_fetch');
        // Several renderers: one choice that is off by default, and no separate switch.
        expect(webFetch?.parameters.properties).not.toHaveProperty('render');
        expect(webFetch?.parameters.properties.renderer?.enum?.[0]).toBe('none');
        expect(webFetch?.parameters.properties.renderer?.enum).toEqual(
          expect.arrayContaining([...RENDERER_FIXTURE_IDS]),
        );
        expect(afterLoad[1]?.sections?.tools).toContain('\n- web_fetch: ');
        expect(afterLoad[1]?.sections?.tools).not.toContain('  - web_fetch: ');

        // A change to the prompt or the tools after loading would add a system message.
        for (const request of requests.slice(2)) {
          expect(systemMessages(request)).toEqual(afterLoad);
        }
      } finally {
        await session.close();
        rmSync(recordDir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS * 2,
  );
});
