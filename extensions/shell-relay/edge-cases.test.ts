import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  openSync,
  writeSync,
  closeSync,
  writeFileSync,
  constants,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync, spawn } from "node:child_process";
import { FifoManager } from "./fifo.js";
import { Relay } from "./relay.js";
import { SignalParser } from "./signal.js";

describe("Edge Cases", () => {
  describe("FifoManager edge cases", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "edge-fifo-test-"));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("should handle rapid sequential create/shutdown cycles", async () => {
      for (let i = 0; i < 5; i++) {
        const manager = new FifoManager({ baseDir: tempDir, sessionId: `cycle-${i}` });
        manager.create();
        manager.open();
        await manager.shutdown();
      }
      // No crashes, no stale files
      const stale = FifoManager.detectStale(tempDir);
      expect(stale).toEqual([]);
    });

    it("should handle creating FIFOs in a deeply nested base directory", () => {
      const deepDir = join(tempDir, "a", "b", "c", "d");
      const manager = new FifoManager({ baseDir: deepDir, sessionId: "deep" });
      manager.create();
      expect(manager.isCreated).toBe(true);
      // cleanup
      manager.shutdown();
    });
  });

  describe("SignalParser edge cases", () => {
    it("should handle very large exit codes", () => {
      const parser = new SignalParser();
      const events: Array<{ type: string; exitCode?: number }> = [];
      parser.on("signal", (e: { type: string; exitCode?: number }) => events.push(e));

      parser.feed("last_status:255\n");
      expect(events[0]).toEqual({ type: "last_status", exitCode: 255 });
    });

    it("should handle exit code 0 specifically", () => {
      const parser = new SignalParser();
      const events: Array<{ type: string; exitCode?: number }> = [];
      parser.on("signal", (e: { type: string; exitCode?: number }) => events.push(e));

      parser.feed("last_status:0\n");
      expect(events[0]).toEqual({ type: "last_status", exitCode: 0 });
    });

    it("should handle rapid sequential messages", () => {
      const parser = new SignalParser();
      const events: Array<{ type: string }> = [];
      parser.on("signal", (e: { type: string }) => events.push(e));

      // 100 rapid messages
      for (let i = 0; i < 100; i++) {
        parser.feed(`last_status:${i}\n`);
      }
      expect(events).toHaveLength(100);
    });

    it("should handle very long lines gracefully", () => {
      const parser = new SignalParser();
      const events: Array<{ type: string }> = [];
      parser.on("signal", (e: { type: string }) => events.push(e));

      // A very long garbage line followed by a valid message
      const longLine = "x".repeat(10_000);
      parser.feed(`${longLine}\nprompt_ready\n`);
      // Only prompt_ready should be emitted (long line is ignored)
      expect(events).toEqual([{ type: "prompt_ready" }]);
    });
  });

  describe("Relay edge cases", () => {
    let tempDir: string;
    let fifoManager: FifoManager;
    let relay: Relay | null = null;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "edge-relay-test-"));
      fifoManager = new FifoManager({ baseDir: tempDir, sessionId: "edge-test" });
      fifoManager.create();
      fifoManager.open();
    });

    afterEach(async () => {
      relay?.stopListening();
      relay = null;
      await fifoManager.shutdown();
      rmSync(tempDir, { recursive: true, force: true });
    });

    function writeToFifo(path: string, data: string): void {
      const fd = openSync(path, constants.O_WRONLY);
      writeSync(fd, data);
      closeSync(fd);
    }

    it("should handle command that produces no output", async () => {
      const injectCommand = vi.fn(async () => {
        setTimeout(() => {
          // No stdout or stderr written
          writeToFifo(fifoManager.paths.signal, "last_status:0\n");
        }, 30);
        setTimeout(() => {
          writeToFifo(fifoManager.paths.signal, "prompt_ready\n");
        }, 50);
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      const result = await relay.execute("true", { timeoutMs: 5000 });
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      expect(result.exitCode).toBe(0);
    });

    it("should handle command that produces only stderr", async () => {
      const injectCommand = vi.fn(async () => {
        setTimeout(() => {
          writeToFifo(fifoManager.paths.stderr, "error only\n");
          writeToFifo(fifoManager.paths.signal, "last_status:1\n");
        }, 30);
        setTimeout(() => {
          writeToFifo(fifoManager.paths.signal, "prompt_ready\n");
        }, 50);
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      const result = await relay.execute("bad_cmd", { timeoutMs: 5000 });
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("error only");
      expect(result.exitCode).toBe(1);
    });

    it("should handle large output", async () => {
      // Write large output using a child process to avoid blocking the event loop
      const largeSize = 50_000;

      const injectCommand = vi.fn(async () => {
        // Use a child process for the large write — prevents event loop deadlock
        const child = spawn("bash", [
          "-c",
          `printf '%0${largeSize}d' 0 > "${fifoManager.paths.stdout}"; ` +
          `echo "last_status:0" > "${fifoManager.paths.signal}"; ` +
          `sleep 0.05; echo "prompt_ready" > "${fifoManager.paths.signal}"`,
        ]);
        child.unref();
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      const result = await relay.execute("big_output", { timeoutMs: 10_000 });
      expect(result.stdout.length).toBeGreaterThanOrEqual(largeSize);
      expect(result.exitCode).toBe(0);
    });

    it("should handle rapid sequential commands without FIFO corruption", async () => {
      let cmdIndex = 0;
      const injectCommand = vi.fn(async () => {
        cmdIndex++;
        const idx = cmdIndex;
        setTimeout(() => {
          writeToFifo(fifoManager.paths.stdout, `output-${idx}\n`);
          writeToFifo(fifoManager.paths.signal, `last_status:0\n`);
        }, 20);
        setTimeout(() => {
          writeToFifo(fifoManager.paths.signal, "prompt_ready\n");
        }, 40);
      });

      relay = new Relay({ fifoManager, shell: "fish", injectCommand });
      relay.startListening();

      // Execute 5 commands sequentially (serialized by the relay)
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await relay.execute(`cmd-${i}`, { timeoutMs: 5000 }));
      }

      expect(results).toHaveLength(5);
      for (const r of results) {
        expect(r.exitCode).toBe(0);
        expect(r.stdout).toContain("output-");
      }
    });
  });
});
