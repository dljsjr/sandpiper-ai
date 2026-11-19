import { StringEnum } from '@earendil-works/pi-ai';
import { type ExtensionAPI, formatSize, OutputAccumulator } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  checkBackgroundProcess,
  startBackgroundProcess,
  stopBackgroundProcess,
} from '../../packages/core/src/background-process-capability.js';
import type {
  CreateProcessOutputBuffer,
  ManagedProcess,
  ProcessInfo,
  ProcessManager,
  ProcessOutput,
} from '../../packages/core/src/process-manager.js';
import {
  SystemNotificationDelivery,
  SystemNotificationSourceType,
  sendSystemNotification,
} from '../../packages/core/src/system-notification.js';

const BACKGROUND_PROCESS_COMPLETION_INSTRUCTIONS =
  'A background process started with start_background_process completed. Use check_background_process if you need its final output before continuing.';

const BACKGROUND_PROCESS_POLLING_GUIDELINE =
  'Do not immediately poll a background process in a sleep loop, and do not wait idle for it. ' +
  'You will automatically get a system notification the moment it exits, so there is nothing to gain by checking early — ' +
  'keep working on other things and let the notification tell you when to look. ' +
  'Call check_background_process proactively only if you need to inspect output while the process is still running.';

/** Buffers a stream the way Pi's bash tool does: a bounded tail, and the whole stream in a temp file once it outgrows that. */
export const createBackgroundProcessOutputBuffer: CreateProcessOutputBuffer = (processId, stream) =>
  new OutputAccumulator({
    tempFilePrefix: `sandpiper-bg-${processId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40)}-${stream}`,
  });

const STOP_WAIT_MS = 5_000;
const STOP_SIGNALS = ['SIGTERM', 'SIGINT', 'SIGKILL'] as const;

function describeExit(process: ProcessInfo): string {
  return process.exitSignal ? `signal: ${process.exitSignal}` : `exit code: ${process.exitCode}`;
}

function formatStreamOutput(label: string, output: ProcessOutput): string {
  const lines = `${output.totalLines} line${output.totalLines === 1 ? '' : 's'}`;
  const header = `\n${label} (${lines}, ${formatSize(output.totalBytes)}):\n${output.text || '(empty)'}`;
  if (!output.truncated) return header;
  const shownLines = output.text === '' ? 0 : output.text.split('\n').length;
  const fullOutput = output.fullOutputPath ? ` Full output: ${output.fullOutputPath}` : '';
  return `${header}\n\n[Showing lines ${output.totalLines - shownLines + 1}-${output.totalLines} of ${output.totalLines}.${fullOutput}]`;
}

export function registerBackgroundProcessTools(pi: ExtensionAPI, processManager: ProcessManager): void {
  // The agent already learns the outcome of a stop it asked for, so no exit notification follows.
  const stopRequested = new WeakSet<ManagedProcess>();

  pi.registerTool({
    name: 'start_background_process',
    label: 'Start Background Process',
    description:
      'Start a long-running background process. Returns immediately with a process ID. ' +
      'The process runs independently, and you will be notified automatically when it exits — no need to poll. ' +
      'Use check_background_process only to inspect status or output while it is still running, or to read final output after the completion notification arrives. ' +
      'This allows you to keep working with the user on other things. ' +
      'Use for any executable you would normally background with "&", such as "bun run dev", dev servers, file watchers, build watchers, or any long-running command that should run while you continue working. ',
    promptSnippet: 'Start a long-running background process (builds, dev servers, file watchers)',
    promptGuidelines: [
      'Prefer start_background_process over nohup, "&", or manually backgrounding jobs with bash.',
      BACKGROUND_PROCESS_POLLING_GUIDELINE,
    ],
    parameters: Type.Object({
      id: Type.String({
        description:
          'Unique identifier for this process. Use it with check_background_process and stop_background_process; the exit notification names it too.',
      }),
      command: Type.String({
        description:
          "Executable command to run. This is not a shell: do not include '&&', '|', '>', '&', or other shell syntax; use args for arguments, or use bash -c only when compound shell syntax is genuinely required.",
      }),
      args: Type.Optional(
        Type.Array(Type.String(), {
          description: 'Command arguments. Pass each argument separately instead of shell-joining them.',
        }),
      ),
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

      const managed = processManager.get(result.process.id);
      managed?.onExit((exitCode, exitSignal) => {
        if (stopRequested.has(managed)) return;
        sendSystemNotification(pi, {
          sourceType: SystemNotificationSourceType.Tool,
          sourceId: 'background_process',
          deliverAs: SystemNotificationDelivery.Steer,
          triggerTurn: true,
          instructions: BACKGROUND_PROCESS_COMPLETION_INSTRUCTIONS,
          data: {
            process: { id: result.process.id, exitCode, exitSignal },
          },
        });
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Background process "${params.id}" started (PID: ${result.process.pid}). You'll get an automatic notification when it exits — no need to poll; keep working in the meantime.`,
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
      'Set include_stdout/include_stderr to true to retrieve buffered output. Use tail_lines to limit output volume. ' +
      'Each stream shows at most its last 2000 lines or 50KB; a longer stream is saved in full to a temp file, whose path the result gives.',
    promptSnippet: 'Poll background process status and buffered output',
    promptGuidelines: [BACKGROUND_PROCESS_POLLING_GUIDELINE],
    parameters: Type.Object({
      id: Type.String({ description: 'Process ID to check' }),
      include_stdout: Type.Optional(Type.Boolean({ description: 'Include buffered stdout (default: false)' })),
      include_stderr: Type.Optional(Type.Boolean({ description: 'Include buffered stderr (default: false)' })),
      tail_lines: Type.Optional(Type.Number({ description: 'Only include last N lines of output' })),
      clear_buffer: Type.Optional(
        Type.Boolean({
          description:
            'Start fresh output buffers after reading, so the next check shows only newer output (default: false)',
        }),
      ),
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
        parts.push(formatStreamOutput('STDOUT', result.stdout));
      }

      if (result.stderr) {
        parts.push(formatStreamOutput('STDERR', result.stderr));
      }

      return {
        content: [{ type: 'text' as const, text: parts.join('\n') }],
        details: process,
      };
    },
  });

  pi.registerTool({
    name: 'stop_background_process',
    label: 'Stop Background Process',
    exposure: 'deferred',
    description:
      `Stop a background process started with start_background_process. Sends SIGTERM unless told otherwise and waits up to ${STOP_WAIT_MS / 1000} seconds for the process to exit. ` +
      'The result reports the exit, and no exit notification follows. ' +
      'If the process is still running after the wait, call again with signal SIGKILL.',
    promptSnippet: 'Stop a background process started with start_background_process',
    parameters: Type.Object({
      id: Type.String({ description: 'Process ID to stop' }),
      signal: Type.Optional(
        StringEnum(STOP_SIGNALS, {
          description: 'Signal to send (default: SIGTERM)',
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const signal = STOP_SIGNALS.find((name) => name === params.signal) ?? 'SIGTERM';
      const managed = processManager.get(params.id);
      if (managed?.running) stopRequested.add(managed);
      const result = await stopBackgroundProcess(processManager, { id: params.id, signal, timeoutMs: STOP_WAIT_MS });

      if (!result.found) {
        return {
          content: [{ type: 'text' as const, text: `No background process found with ID "${params.id}".` }],
          details: { id: params.id, pid: undefined, running: false, exitCode: null, exitSignal: null },
          isError: true,
        };
      }

      const text = !result.wasRunning
        ? `Background process "${params.id}" had already exited (${describeExit(result.process)}).`
        : result.exited
          ? `Background process "${params.id}" stopped (${describeExit(result.process)}).`
          : `Sent ${signal} to background process "${params.id}", but it is still running after ${STOP_WAIT_MS / 1000} seconds. Call stop_background_process again with signal SIGKILL to force it.`;
      return { content: [{ type: 'text' as const, text }], details: result.process };
    },
  });
}
