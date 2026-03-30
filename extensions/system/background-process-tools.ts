import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import type { ProcessManager } from 'sandpiper-ai-core';

export function registerBackgroundProcessTools(pi: ExtensionAPI, processManager: ProcessManager): void {
  pi.registerTool({
    name: 'start_background_process',
    label: 'Start Background Process',
    description:
      'Start a long-running background process. Returns immediately with a process ID. ' +
      'The process runs independently — use check_background_process to poll its status and output. ' +
      'Use for builds, file watchers, server processes, or any command that should run while you continue working.',
    parameters: Type.Object({
      id: Type.String({ description: 'Unique identifier for this process (used to check/kill it later)' }),
      command: Type.String({ description: 'Command to execute' }),
      args: Type.Optional(Type.Array(Type.String(), { description: 'Command arguments' })),
      cwd: Type.Optional(Type.String({ description: 'Working directory (defaults to session cwd)' })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      try {
        const proc = processManager.spawn({
          id: params.id,
          command: params.command,
          args: params.args,
          cwd: params.cwd ?? ctx.cwd,
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: `Background process "${params.id}" started (PID: ${proc.pid}).`,
            },
          ],
          details: { id: params.id, pid: proc.pid, status: 'running' },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to start background process: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: 'check_background_process',
    label: 'Check Background Process',
    description:
      'Check the status of a background process. By default returns only status and exit code (no output, low context cost). ' +
      'Set include_stdout/include_stderr to true to retrieve buffered output. Use tail_lines to limit output volume.',
    parameters: Type.Object({
      id: Type.String({ description: 'Process ID to check' }),
      include_stdout: Type.Optional(Type.Boolean({ description: 'Include buffered stdout (default: false)' })),
      include_stderr: Type.Optional(Type.Boolean({ description: 'Include buffered stderr (default: false)' })),
      tail_lines: Type.Optional(Type.Number({ description: 'Only include last N lines of output' })),
      clear_buffer: Type.Optional(Type.Boolean({ description: 'Clear output buffers after reading (default: false)' })),
    }),
    async execute(_toolCallId, params) {
      const proc = processManager.get(params.id);
      if (!proc) {
        return {
          content: [{ type: 'text' as const, text: `No background process found with ID "${params.id}".` }],
          details: { id: params.id, pid: undefined, running: false, exitCode: null, exitSignal: null },
          isError: true,
        };
      }

      const readOpts = { tail: params.tail_lines, clear: params.clear_buffer };
      const parts: string[] = [];

      parts.push(`Process "${params.id}": ${proc.running ? 'running' : 'exited'} (PID: ${proc.pid ?? 'n/a'})`);
      if (!proc.running) {
        parts.push(`Exit code: ${proc.exitCode}`);
      }

      if (params.include_stdout) {
        const stdout = proc.readStdout(readOpts);
        parts.push(`\nSTDOUT (${proc.stdoutLineCount} lines buffered):\n${stdout || '(empty)'}`);
      }

      if (params.include_stderr) {
        const stderr = proc.readStderr(readOpts);
        parts.push(`\nSTDERR (${proc.stderrLineCount} lines buffered):\n${stderr || '(empty)'}`);
      }

      return {
        content: [{ type: 'text' as const, text: parts.join('\n') }],
        details: proc.info,
      };
    },
  });
}
