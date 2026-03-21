import { createReadStream, type ReadStream } from "node:fs";
import type { FifoManager } from "./fifo.js";
import { SignalParser, type SignalEvent } from "./signal.js";
import { escapeForFish, escapeForBash } from "./escape.js";

/** Result of a relay command execution. */
export interface RelayResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
  readonly timedOut: boolean;
}

/** Options for a single command execution. */
export interface ExecuteOptions {
  readonly timeoutMs: number;
}

/** Configuration for the Relay. */
export interface RelayOptions {
  /** The FIFO manager providing persistent FIFOs. */
  readonly fifoManager: FifoManager;
  /** The shell type running in the target pane. */
  readonly shell: "fish" | "bash" | "zsh";
  /** Function to inject a command string into the multiplexer pane. */
  readonly injectCommand: (command: string) => void | Promise<void>;
}

/**
 * Core relay orchestration — ties together FIFOs, signal channel,
 * command escaping, and multiplexer injection into the end-to-end
 * command execution flow.
 *
 * This module is framework-independent — no pi/sandpiper imports.
 */
export class Relay {
  private readonly fifoManager: FifoManager;
  private readonly shell: RelayOptions["shell"];
  private readonly injectCommand: RelayOptions["injectCommand"];
  private readonly signalParser = new SignalParser();

  private stdoutStream: ReadStream | null = null;
  private stderrStream: ReadStream | null = null;
  private signalStream: ReadStream | null = null;

  private stdoutBuffer = "";
  private stderrBuffer = "";

  // Execution lock: only one command at a time
  private executionQueue: Promise<RelayResult> = Promise.resolve({
    stdout: "",
    stderr: "",
    exitCode: 0,
    timedOut: false,
  });

  constructor(options: RelayOptions) {
    this.fifoManager = options.fifoManager;
    this.shell = options.shell;
    this.injectCommand = options.injectCommand;
  }

  /**
   * Build the command string to inject into the multiplexer pane.
   * Escapes the command and wraps it in a `__relay_run` call with space prefix.
   */
  buildInjectionCommand(command: string): string {
    const escaped =
      this.shell === "fish" ? escapeForFish(command) : escapeForBash(command);
    // Space prefix for history exclusion, \n to execute
    return ` __relay_run ${escaped}\n`;
  }

  /**
   * Start listening on all three FIFOs.
   * Must be called after fifoManager.create() and fifoManager.open().
   */
  startListening(): void {
    const paths = this.fifoManager.paths;

    this.stdoutStream = createReadStream(paths.stdout, { flags: "r", encoding: "utf-8" });
    this.stderrStream = createReadStream(paths.stderr, { flags: "r", encoding: "utf-8" });
    this.signalStream = createReadStream(paths.signal, { flags: "r", encoding: "utf-8" });

    this.stdoutStream.on("data", (chunk: string) => {
      this.stdoutBuffer += chunk;
    });

    this.stderrStream.on("data", (chunk: string) => {
      this.stderrBuffer += chunk;
    });

    this.signalStream.on("data", (chunk: string) => {
      this.signalParser.feed(chunk);
    });
  }

  /**
   * Stop listening on all FIFOs.
   */
  stopListening(): void {
    this.stdoutStream?.destroy();
    this.stderrStream?.destroy();
    this.signalStream?.destroy();
    this.stdoutStream = null;
    this.stderrStream = null;
    this.signalStream = null;
  }

  /**
   * Validate the full pipeline by injecting a no-op command and verifying
   * that last_status and prompt_ready signals are received.
   *
   * @throws If the pipeline is broken (shell integration not sourced, FIFO mismatch, etc.)
   */
  async validate(timeoutMs = 5000): Promise<void> {
    const result = await this.execute("true", { timeoutMs });
    if (result.exitCode !== 0) {
      throw new Error(
        `Startup validation failed: expected exit code 0, got ${result.exitCode}. ` +
        `Ensure the shell integration script is sourced in the target pane.`
      );
    }
  }

  /**
   * Execute a command in the relay pane.
   *
   * Commands are serialized — concurrent calls are queued and executed
   * one at a time (FR-12).
   */
  execute(command: string, options: ExecuteOptions): Promise<RelayResult> {
    this.executionQueue = this.executionQueue.then(
      () => this.executeInternal(command, options),
      () => this.executeInternal(command, options)
    );
    return this.executionQueue;
  }

  private async executeInternal(
    command: string,
    options: ExecuteOptions
  ): Promise<RelayResult> {
    // Clear buffers for this command
    this.stdoutBuffer = "";
    this.stderrBuffer = "";

    // Build and inject the wrapped command
    const injectionCmd = this.buildInjectionCommand(command);
    await this.injectCommand(injectionCmd);

    // Wait for last_status signal (command completed)
    let exitCode: number;
    const statusEvent = await this.signalParser.waitFor("last_status", options.timeoutMs);
    if (statusEvent.type !== "last_status") {
      throw new Error("Unexpected signal event type");
    }
    exitCode = statusEvent.exitCode;

    // Wait for prompt_ready signal (pane is ready for next command)
    try {
      await this.signalParser.waitFor("prompt_ready", 5000);
    } catch {
      // prompt_ready timeout is non-fatal — we have the exit code already
    }

    // Small delay to let any remaining FIFO data flush
    await new Promise((r) => setTimeout(r, 20));

    return {
      stdout: this.stdoutBuffer,
      stderr: this.stderrBuffer,
      exitCode,
      timedOut: false,
    };
  }
}
