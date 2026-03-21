import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { FifoManager } from "./fifo.js";
import { ZellijClient } from "./zellij.js";
import { Relay } from "./relay.js";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir, userInfo } from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Resolve the base directory for FIFOs. */
function resolveBaseDir(): string {
  const xdgRuntime = process.env["XDG_RUNTIME_DIR"];
  if (xdgRuntime && existsSync(xdgRuntime)) {
    return join(xdgRuntime, "shell-relay");
  }
  return join(tmpdir(), `shell-relay-${userInfo().username}`);
}

/** Detect the shell type from environment. */
function detectShell(): "fish" | "bash" | "zsh" {
  const shell = process.env["SHELL"] ?? "";
  if (shell.includes("fish")) return "fish";
  if (shell.includes("zsh")) return "zsh";
  return "bash";
}

export default function (pi: ExtensionAPI) {
  let fifoManager: FifoManager | null = null;
  let zellij: ZellijClient | null = null;
  let relay: Relay | null = null;
  let sessionId: string | null = null;
  let isSetUp = false;

  /** Set up the relay: create FIFOs, connect to Zellij, start listening. */
  async function setupRelay(
    ctx: { ui: { notify: (msg: string, level?: "info" | "warning" | "error") => void } },
    zellijSessionName?: string,
  ): Promise<void> {
    if (isSetUp) return;

    // Resolve or create Zellij session
    const sessionName = zellijSessionName
      ?? process.env["SHELL_RELAY_SESSION"]
      ?? `relay-${randomUUID().slice(0, 8)}`;

    zellij = new ZellijClient({ sessionName });

    if (!zellij.isAvailable()) {
      throw new Error(
        "Zellij is not installed or not available. " +
        "Shell Relay requires Zellij. Install it from https://zellij.dev",
      );
    }

    // Create or connect to session
    if (!zellijSessionName && !process.env["SHELL_RELAY_SESSION"]) {
      zellij.createSession(sessionName);
      ctx.ui.notify(
        `Shell Relay: Created Zellij session "${sessionName}". ` +
        `Run "zellij attach ${sessionName}" in another terminal to view the shared terminal.`,
        "info",
      );
    }

    // Set up FIFOs
    sessionId = process.env["SHELL_RELAY_PANE_ID"] ?? randomUUID().slice(0, 12);
    const baseDir = resolveBaseDir();

    // Clean up stale FIFOs from previous sessions
    const stale = FifoManager.detectStale(baseDir);
    for (const staleId of stale) {
      FifoManager.cleanupStale(baseDir, staleId);
    }

    fifoManager = new FifoManager({ baseDir, sessionId });
    fifoManager.create();
    fifoManager.open();

    // Export FIFO paths into the Zellij pane
    const envExports = [
      `set -gx SHELL_RELAY_SIGNAL '${fifoManager.paths.signal}'`,
      `set -gx SHELL_RELAY_STDOUT '${fifoManager.paths.stdout}'`,
      `set -gx SHELL_RELAY_STDERR '${fifoManager.paths.stderr}'`,
    ].join("; ");

    zellij.writeChars(`${envExports}\n`);

    // Create and start the relay
    const shell = detectShell();
    relay = new Relay({
      fifoManager,
      shell,
      injectCommand: (cmd: string) => zellij!.writeChars(cmd),
    });
    relay.startListening();

    isSetUp = true;
    ctx.ui.notify(
      `Shell Relay: Connected (session=${sessionName}, shell=${shell}). ` +
      `FIFO paths exported to pane.`,
      "info",
    );

    // Startup validation: verify the full pipeline works
    try {
      await relay.validate(10_000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(
        `Shell Relay: Startup validation failed — ${msg}. ` +
        `Ensure the shell integration script is sourced in the target pane ` +
        `(source /path/to/relay.fish).`,
        "warning",
      );
      // Don't throw — allow usage even if validation fails (the pane might
      // just need the integration script sourced)
    }
  }

  // --- Tool Registration ---

  pi.registerTool({
    name: "shell_relay",
    label: "Shell Relay",
    description:
      "Execute a command in the user's shared terminal session (Zellij pane). " +
      "The command runs in the user's authenticated shell with full session state " +
      "(environment, functions, auth tokens). Both user and agent can see and " +
      "interact with the terminal in real time.",
    promptSnippet:
      "Execute commands in the user's shared terminal (inherits auth, env, functions)",
    promptGuidelines: [
      "Use shell_relay instead of bash when the command requires the user's session state (e.g., 1Password auth, shell functions, non-exported env vars).",
      "Use bash for general-purpose commands that don't need session state — it's faster and simpler.",
      "shell_relay executes in a visible Zellij pane — the user can see all commands and output in real time.",
      "The shared terminal is fully collaborative — the user may run commands between your invocations.",
    ],
    parameters: Type.Object({
      command: Type.String({
        description: "Command to execute in the user's shell session",
      }),
      timeout: Type.Optional(
        Type.Number({
          description: "Timeout in seconds (default: 30)",
        }),
      ),
      session: Type.Optional(
        Type.String({
          description:
            "Zellij session name to connect to. If not provided, uses SHELL_RELAY_SESSION env var or creates a new session.",
        }),
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        await setupRelay(ctx, params.session);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Shell Relay setup failed: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }

      const timeoutMs = (params.timeout ?? 30) * 1000;

      try {
        const result = await relay!.execute(params.command, { timeoutMs });

        const outputParts: string[] = [];
        if (result.stdout.length > 0) {
          outputParts.push(`STDOUT:\n${result.stdout}`);
        }
        if (result.stderr.length > 0) {
          outputParts.push(`STDERR:\n${result.stderr}`);
        }
        if (outputParts.length === 0) {
          outputParts.push("(no output)");
        }
        outputParts.push(`Exit code: ${result.exitCode}`);

        return {
          content: [{ type: "text" as const, text: outputParts.join("\n\n") }],
          details: {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            timedOut: result.timedOut,
          },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Shell Relay error: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "shell_relay_inspect",
    label: "Inspect Relay Pane",
    description:
      "View the current visual state of the shared terminal pane. " +
      "Use this to see what the user has done in the pane, inspect TUI output, " +
      "or check the state of an interactive program.",
    promptSnippet: "View the shared terminal's current visual state",
    parameters: Type.Object({
      session: Type.Optional(
        Type.String({
          description: "Zellij session name (uses current relay session if not provided)",
        }),
      ),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      try {
        await setupRelay(ctx, params.session);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Shell Relay setup failed: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }

      try {
        // Use a temp FIFO for dump-screen output
        const dumpPath = join(resolveBaseDir(), `dump-${randomUUID().slice(0, 8)}`);
        zellij!.dumpScreen(dumpPath);

        // Read the dump file
        const { readFileSync, unlinkSync } = await import("node:fs");
        let content: string;
        try {
          content = readFileSync(dumpPath, "utf-8");
        } finally {
          try {
            unlinkSync(dumpPath);
          } catch {
            // ignore cleanup errors
          }
        }

        return {
          content: [{ type: "text" as const, text: content || "(empty pane)" }],
          details: { lines: content.split("\n").length },
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Inspect failed: ${msg}` }],
          details: { error: msg },
          isError: true,
        };
      }
    },
  });

  // --- Lifecycle ---

  pi.on("session_shutdown", async () => {
    relay?.stopListening();
    if (fifoManager) {
      await fifoManager.shutdown();
    }
    isSetUp = false;
  });
}
