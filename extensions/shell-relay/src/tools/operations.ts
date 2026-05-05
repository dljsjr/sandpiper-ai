import type { RelayRuntime, RelaySetupContext } from '../types.js';
import { type ToolExecuteResult, withRelaySetup } from './with-relay-setup.js';

export interface ShellRelayToolInput {
  readonly command: string;
  readonly timeout?: number;
  readonly session?: string;
}

export interface InspectPaneToolInput {
  readonly session?: string;
}

export function shellRelaySetupFailureMessage(message: string): string {
  return (
    `Shell Relay setup failed: ${message}\n\n` +
    'If this command does not require session state (auth tokens, shell functions, etc.), ' +
    'use the bash tool instead.'
  );
}

export function inspectPaneSetupFailureMessage(message: string): string {
  return `Shell Relay setup failed: ${message}\n\nCannot inspect pane — the relay is not connected.`;
}

export async function executeShellRelayTool(
  runtime: RelayRuntime,
  ctx: RelaySetupContext,
  input: ShellRelayToolInput,
): Promise<ToolExecuteResult> {
  return withRelaySetup(runtime, ctx, input.session, shellRelaySetupFailureMessage, async () => {
    const timeoutMs = (input.timeout ?? 30) * 1000;
    try {
      const result = await runtime.executeQueued(input.command, timeoutMs);
      const renderedOutput = result.output.length > 0 ? result.output : '(no output)';
      return {
        content: [{ type: 'text', text: `${renderedOutput}\n\nExit code: ${result.exitCode}` }],
        details: {
          output: result.output,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text:
              `Shell Relay error: ${msg}\n\n` +
              'The relay pane may be unavailable or the shell integration may not be sourced. ' +
              'If this command does not require session state, use the bash tool instead.',
          },
        ],
        details: { error: msg },
        isError: true,
      };
    }
  });
}

export async function executeInspectPaneTool(
  runtime: RelayRuntime,
  ctx: RelaySetupContext,
  input: InspectPaneToolInput,
): Promise<ToolExecuteResult> {
  return withRelaySetup(runtime, ctx, input.session, inspectPaneSetupFailureMessage, async () => {
    try {
      const content = runtime.inspectPane();
      return {
        content: [{ type: 'text', text: content || '(empty pane)' }],
        details: { lines: content.split('\n').length },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Inspect failed: ${msg}\n\nThe Zellij pane may have been closed or the session may be unavailable.`,
          },
        ],
        details: { error: msg },
        isError: true,
      };
    }
  });
}
