import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { checkBackgroundProcess, type ProcessManager, startBackgroundProcess } from 'sandpiper-ai-core';

export function registerBackgroundProcessTools(pi: ExtensionAPI, processManager: ProcessManager): void {
  pi.registerTool({
    name: 'start_background_process',
    label: 'Start Background Process',
    description:
      'Start a long-running background process. Returns immediately with a process ID. ' +
      'The process runs independently — use check_background_process to poll its status and output. ' +
      'This allows you to keep working with the user on other things. ' +
      'Use for any executable you would normally background with "&", such as "bun run dev", dev servers, file watchers, build watchers, or any long-running command that should run while you continue working. ',
    promptSnippet: 'Start a long-running background process (builds, dev servers, file watchers)',
    promptGuidelines: [
      'STRICTLY PREFER start_background_process over nohup, "&", or manually backgrounding jobs with bash.',
      "start_background_process is NOT a shell — do NOT use '&&', '|', '>', or other shell syntax. Use bash -c '...' only if you genuinely need compound shell syntax.",
      'Do *NOT* use "cd && ..." with start_background_process. Use the cwd parameter.',
      'The `cwd` parameter MUST be an absolute, *resolved* path; e.g. no `~`, environment variables, or anything that requires a shell to expand',
      'When using start_background_process, do not immediately start polling it or its output files with "sleep ... && ...". This defeats the point. Continue working on other things with the user.',
    ],
    parameters: Type.Object({
      id: Type.String({ description: 'Unique identifier for this process (used to check/kill it later)' }),
      command: Type.String({ description: 'Executable command to run' }),
      args: Type.Optional(Type.Array(Type.String(), { description: 'Command arguments' })),
      cwd: Type.Optional(
        Type.String({
          description:
            'Absolute path to the working directory for the spawned process. You must use absolute, canonical paths (e.g. do not use `~` or `$HOME`). Use this instead of prefixing the command with "cd ...". Defaults to session cwd.',
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = startBackgroundProcess(processManager, {
        id: params.id,
        command: params.command,
        args: params.args,
        cwd: params.cwd ?? ctx.cwd,
      });

      if (!result.ok) {
        return {
          content: [{ type: 'text' as const, text: `Failed to start background process: ${result.error}` }],
          details: { error: result.error },
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Background process "${params.id}" started (PID: ${result.process.pid}).`,
          },
        ],
        details: { id: params.id, pid: result.process.pid, status: 'running' },
      };
    },
  });

  pi.registerTool({
    name: 'check_background_process',
    label: 'Check Background Process',
    description:
      'Check the status of a background process. By default returns only status and exit code (no output, low context cost). ' +
      'Set include_stdout/include_stderr to true to retrieve buffered output. Use tail_lines to limit output volume.',
    promptSnippet: 'Poll background process status and buffered output',
    promptGuidelines: [
      'Use check_background_process to monitor processes started with start_background_process.',
      'By default, only status and exit code are returned (low context cost). Set include_stdout/include_stderr to read buffered output. Use tail_lines to limit volume.',
      'Do not poll in a tight loop with sleeps. Check occasionally while doing other work.',
    ],
    parameters: Type.Object({
      id: Type.String({ description: 'Process ID to check' }),
      include_stdout: Type.Optional(Type.Boolean({ description: 'Include buffered stdout (default: false)' })),
      include_stderr: Type.Optional(Type.Boolean({ description: 'Include buffered stderr (default: false)' })),
      tail_lines: Type.Optional(Type.Number({ description: 'Only include last N lines of output' })),
      clear_buffer: Type.Optional(Type.Boolean({ description: 'Clear output buffers after reading (default: false)' })),
    }),
    async execute(_toolCallId, params) {
      const result = checkBackgroundProcess(processManager, {
        id: params.id,
        includeStdout: params.include_stdout,
        includeStderr: params.include_stderr,
        tailLines: params.tail_lines,
        clearBuffer: params.clear_buffer,
      });

      if (!result.found) {
        return {
          content: [{ type: 'text' as const, text: `No background process found with ID "${params.id}".` }],
          details: { id: params.id, pid: undefined, running: false, exitCode: null, exitSignal: null },
          isError: true,
        };
      }

      const parts: string[] = [];
      const process = result.process;

      parts.push(`Process "${params.id}": ${process.running ? 'running' : 'exited'} (PID: ${process.pid ?? 'n/a'})`);
      if (!process.running) {
        parts.push(`Exit code: ${process.exitCode}`);
      }

      if (result.stdout) {
        parts.push(`\nSTDOUT (${result.stdout.lineCount} lines buffered):\n${result.stdout.text || '(empty)'}`);
      }

      if (result.stderr) {
        parts.push(`\nSTDERR (${result.stderr.lineCount} lines buffered):\n${result.stderr.text || '(empty)'}`);
      }

      return {
        content: [{ type: 'text' as const, text: parts.join('\n') }],
        details: process,
      };
    },
  });
}
