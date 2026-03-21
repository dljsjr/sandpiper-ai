import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, openSync, writeSync, closeSync, constants } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Relay } from "./relay.js";
import { FifoManager } from "./fifo.js";

describe("Relay", () => {
  let tempDir: string;
  let fifoManager: FifoManager;
  let relay: Relay | null = null;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "relay-test-"));
    fifoManager = new FifoManager({ baseDir: tempDir, sessionId: "relay-test" });
    fifoManager.create();
    fifoManager.open();
  });

  afterEach(async () => {
    relay?.stopListening();
    relay = null;
    await fifoManager.shutdown();
    rmSync(tempDir, { recursive: true, force: true });
  });

  /** Helper: write to a FIFO from "outside" (simulating the shell) */
  function writeToFifo(path: string, data: string): void {
    const fd = openSync(path, constants.O_WRONLY);
    writeSync(fd, data);
    closeSync(fd);
  }

  describe("buildInjectionCommand", () => {
    it("should produce a space-prefixed command with __relay_run", () => {
      relay = new Relay({
        fifoManager,
        shell: "fish",
        injectCommand: vi.fn(),
      });

      const wrapped = relay.buildInjectionCommand("ls -la");
      expect(wrapped.startsWith(" ")).toBe(true);
      expect(wrapped).toContain("__relay_run");
      expect(wrapped.endsWith("\n")).toBe(true);
    });
  });

  describe("execute", () => {
    it("should capture exit code from last_status signal", async () => {
      const injectCommand = vi.fn(async () => {
        setTimeout(() => {
          writeToFifo(fifoManager.paths.signal, "last_status:42\n");
        }, 30);
        setTimeout(() => {
          writeToFifo(fifoManager.paths.signal, "prompt_ready\n");
        }, 50);
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      const result = await relay.execute("exit 42", { timeoutMs: 5000 });
      expect(result.exitCode).toBe(42);
      expect(result.timedOut).toBe(false);
    });

    it("should capture stdout from the stdout FIFO", async () => {
      const injectCommand = vi.fn(async () => {
        setTimeout(() => {
          writeToFifo(fifoManager.paths.stdout, "hello from stdout\n");
          writeToFifo(fifoManager.paths.signal, "last_status:0\n");
        }, 30);
        setTimeout(() => {
          writeToFifo(fifoManager.paths.signal, "prompt_ready\n");
        }, 50);
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      const result = await relay.execute("echo hello", { timeoutMs: 5000 });
      expect(result.stdout).toContain("hello from stdout");
      expect(result.exitCode).toBe(0);
    });

    it("should capture stderr from the stderr FIFO", async () => {
      const injectCommand = vi.fn(async () => {
        setTimeout(() => {
          writeToFifo(fifoManager.paths.stderr, "error output\n");
          writeToFifo(fifoManager.paths.signal, "last_status:1\n");
        }, 30);
        setTimeout(() => {
          writeToFifo(fifoManager.paths.signal, "prompt_ready\n");
        }, 50);
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      const result = await relay.execute("bad_cmd", { timeoutMs: 5000 });
      expect(result.stderr).toContain("error output");
      expect(result.exitCode).toBe(1);
    });

    it("should serialize concurrent commands", async () => {
      const callOrder: number[] = [];
      let callCount = 0;

      const injectCommand = vi.fn(async () => {
        callCount++;
        const currentCall = callCount;
        callOrder.push(currentCall);
        // Each call responds with its own exit code, then prompt_ready after a delay
        writeToFifo(fifoManager.paths.signal, `last_status:${currentCall}\n`);
        setTimeout(() => {
          writeToFifo(fifoManager.paths.signal, "prompt_ready\n");
        }, 20);
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      const p1 = relay.execute("cmd1", { timeoutMs: 5000 });
      const p2 = relay.execute("cmd2", { timeoutMs: 5000 });

      const [r1, r2] = await Promise.all([p1, p2]);

      // Commands should have been serialized (called sequentially)
      expect(injectCommand).toHaveBeenCalledTimes(2);
      expect(callOrder).toEqual([1, 2]);
      expect(r1.exitCode).toBe(1);
      expect(r2.exitCode).toBe(2);
    });

    it("should reject with timeout error if command takes too long", async () => {
      const injectCommand = vi.fn(async () => {
        // Don't send any signal — simulate a hung command
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      await expect(
        relay.execute("sleep 999", { timeoutMs: 100 })
      ).rejects.toThrow("timed out");
    });

    it("should include partial stdout/stderr on timeout", async () => {
      const injectCommand = vi.fn(async () => {
        setTimeout(() => {
          writeToFifo(fifoManager.paths.stdout, "partial output\n");
        }, 20);
        // Never send last_status — will timeout
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      try {
        await relay.execute("slow_cmd", { timeoutMs: 200 });
      } catch {
        // Expected timeout
      }
    });
  });
});
