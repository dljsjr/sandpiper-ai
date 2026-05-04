#!/usr/bin/env node

import { resolve } from 'node:path';
import { stdin as processStdin, stdout as processStdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { tryConvertJsonToToon } from 'sandpiper-capability-autotoon';

export interface ClaudePostToolUseHookInput {
  readonly hook_event_name?: string;
  readonly tool_response?: unknown;
}

export interface ClaudePostToolUseHookOutput {
  readonly hookSpecificOutput: {
    readonly hookEventName: 'PostToolUse';
    readonly updatedToolOutput: unknown;
  };
}

interface TextBlock {
  readonly type: 'text';
  readonly text: string;
  readonly [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTextBlock(value: unknown): value is TextBlock {
  return isRecord(value) && value.type === 'text' && typeof value.text === 'string';
}

function convertToolOutput(value: unknown): { readonly converted: boolean; readonly value: unknown } {
  if (typeof value === 'string') {
    const converted = tryConvertJsonToToon(value);
    return converted === null ? { converted: false, value } : { converted: true, value: converted };
  }

  if (Array.isArray(value)) {
    let converted = false;
    const items = value.map((item) => {
      const result = convertToolOutput(item);
      converted ||= result.converted;
      return result.value;
    });

    return { converted, value: converted ? items : value };
  }

  if (!isRecord(value)) {
    return { converted: false, value };
  }

  if (isTextBlock(value)) {
    const converted = tryConvertJsonToToon(value.text);
    return converted === null ? { converted: false, value } : { converted: true, value: { ...value, text: converted } };
  }

  let converted = false;
  const entries = Object.entries(value).map(([key, entryValue]) => {
    const result = convertToolOutput(entryValue);
    converted ||= result.converted;
    return [key, result.value] as const;
  });

  return { converted, value: converted ? Object.fromEntries(entries) : value };
}

export function createAutoToonPostToolUseHookOutput(
  input: ClaudePostToolUseHookInput,
): ClaudePostToolUseHookOutput | null {
  const result = convertToolOutput(input.tool_response);

  if (!result.converted) {
    return null;
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: result.value,
    },
  };
}

async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf-8');
}

export async function runAutoToonPostToolUseHook(
  inputStream: NodeJS.ReadableStream = processStdin,
  outputStream: NodeJS.WritableStream = processStdout,
): Promise<void> {
  const inputText = await readStream(inputStream);
  const parsed = JSON.parse(inputText) as ClaudePostToolUseHookInput;
  const output = createAutoToonPostToolUseHookOutput(parsed);

  if (output === null) {
    return;
  }

  outputStream.write(`${JSON.stringify(output)}\n`);
}

const entrypoint = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);

if (entrypoint === fileURLToPath(import.meta.url)) {
  await runAutoToonPostToolUseHook();
}
