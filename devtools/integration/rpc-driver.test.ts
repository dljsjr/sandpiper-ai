// AGENT-253: direct unit coverage of rpc-driver.ts's line-buffering, the piece the wave-1
// integration tests only exercise incidentally (a real spawned process's stdout chunking is
// OS/timing-dependent -- it might happen to deliver multiple JSONL records in one `data`
// event, or split one record across two, but a passing integration test can't prove either
// case actually occurred that run). This file forces both cases directly against
// `extractCompleteLines`, the pure function `startRpcSession`'s `data` handler delegates to.

import { describe, expect, it } from 'vitest';
import { extractCompleteLines } from './rpc-driver.js';

describe('extractCompleteLines', () => {
  it('extracts a single complete line and leaves no remainder', () => {
    const result = extractCompleteLines('{"type":"agent_start"}\n');
    expect(result.lines).toEqual(['{"type":"agent_start"}']);
    expect(result.remainder).toBe('');
  });

  it('extracts multiple JSONL records delivered in a single chunk', () => {
    // The exact scenario a real process's stdout occasionally does deliver in one `data`
    // event (multiple fast-arriving events coalesced by the OS/pipe buffer) -- forced here
    // deterministically rather than hoped for.
    const chunk = '{"type":"agent_start"}\n{"type":"turn_start"}\n{"type":"message_start","message":{}}\n';
    const result = extractCompleteLines(chunk);
    expect(result.lines).toEqual([
      '{"type":"agent_start"}',
      '{"type":"turn_start"}',
      '{"type":"message_start","message":{}}',
    ]);
    expect(result.remainder).toBe('');
  });

  it('holds back an incomplete trailing line as the remainder', () => {
    const result = extractCompleteLines('{"type":"agent_start"}\n{"type":"turn_star');
    expect(result.lines).toEqual(['{"type":"agent_start"}']);
    expect(result.remainder).toBe('{"type":"turn_star');
  });

  it('reassembles a JSONL record split across two chunks, byte for byte', () => {
    // The other real scenario: a single event's JSON straddles two `data` events. Simulated
    // by feeding the first chunk, capturing the remainder (as startRpcSession's handler
    // does), then feeding remainder+secondChunk through the same function again.
    const fullLine =
      '{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"hello"}}';
    const splitPoint = 40;
    const firstChunk = fullLine.slice(0, splitPoint);
    const secondChunk = `${fullLine.slice(splitPoint)}\n`;

    const firstResult = extractCompleteLines(firstChunk);
    expect(firstResult.lines).toEqual([]);
    expect(firstResult.remainder).toBe(firstChunk);

    const secondResult = extractCompleteLines(firstResult.remainder + secondChunk);
    expect(secondResult.lines).toEqual([fullLine]);
    expect(secondResult.remainder).toBe('');
  });

  it('strips a trailing \\r for \\r\\n input, per the RPC framing note (LF is the record delimiter, CRLF tolerated)', () => {
    const result = extractCompleteLines('{"type":"agent_start"}\r\n');
    expect(result.lines).toEqual(['{"type":"agent_start"}']);
  });

  it('does not split on U+2028/U+2029 embedded inside a JSON string value -- the exact case docs/rpc.md warns readline gets wrong', () => {
    const withLineSeparator = '{"type":"message_start","message":{"content":[{"type":"text","text":"a\u2028b"}]}}\n';
    const result = extractCompleteLines(withLineSeparator);
    expect(result.lines).toHaveLength(1);
    expect(JSON.parse(result.lines[0] as string)).toMatchObject({
      message: { content: [{ text: 'a\u2028b' }] },
    });
  });
});
