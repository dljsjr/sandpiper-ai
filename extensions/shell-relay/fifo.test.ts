import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  existsSync,
  statSync,
  rmSync,
  createReadStream,
  openSync,
  writeSync,
  closeSync,
  constants,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FifoManager } from "./fifo.js";

describe("FifoManager", () => {
  let tempDir: string;
  let manager: FifoManager;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shell-relay-test-"));
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("creation", () => {
    it("should create three FIFOs with deterministic paths based on session ID", () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "test-session-123" });
      manager.create();

      const sessionDir = join(tempDir, "test-session-123");
      expect(existsSync(join(sessionDir, "stdout"))).toBe(true);
      expect(existsSync(join(sessionDir, "stderr"))).toBe(true);
      expect(existsSync(join(sessionDir, "signal"))).toBe(true);
    });

    it("should create the session directory with mode 0700", () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "test-session-123" });
      manager.create();

      const sessionDir = join(tempDir, "test-session-123");
      const stats = statSync(sessionDir);
      // 0700 = 448 decimal, but we mask with 0o777 to ignore file type bits
      expect(stats.mode & 0o777).toBe(0o700);
    });

    it("should create FIFOs with mode 0600", () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "test-session-123" });
      manager.create();

      const sessionDir = join(tempDir, "test-session-123");
      for (const name of ["stdout", "stderr", "signal"]) {
        const stats = statSync(join(sessionDir, name));
        // FIFOs are created with mkfifo which sets mode; check permission bits
        expect(stats.mode & 0o777).toBe(0o600);
        // Verify it's actually a FIFO
        expect(stats.isFIFO()).toBe(true);
      }
    });

    it("should expose deterministic FIFO paths", () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "my-session" });
      manager.create();

      expect(manager.paths.stdout).toBe(join(tempDir, "my-session", "stdout"));
      expect(manager.paths.stderr).toBe(join(tempDir, "my-session", "stderr"));
      expect(manager.paths.signal).toBe(join(tempDir, "my-session", "signal"));
    });

    it("should throw if FIFOs already exist from a previous session", () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "test-session" });
      manager.create();

      const manager2 = new FifoManager({ baseDir: tempDir, sessionId: "test-session" });
      expect(() => manager2.create()).toThrow();
    });
  });

  describe("cleanup", () => {
    it("should remove all FIFOs and session directory on shutdown", async () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "cleanup-test" });
      manager.create();

      const sessionDir = join(tempDir, "cleanup-test");
      expect(existsSync(sessionDir)).toBe(true);

      await manager.shutdown();
      expect(existsSync(sessionDir)).toBe(false);
    });

    it("should not throw if shutdown is called twice", async () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "double-shutdown" });
      manager.create();

      await manager.shutdown();
      await expect(manager.shutdown()).resolves.not.toThrow();
    });
  });

  describe("O_RDWR sentinel pattern", () => {
    it("should open FIFOs without blocking", () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "rdwr-test" });
      manager.create();

      // O_RDWR should not block even though there's no external writer
      const fds = manager.open();
      expect(fds.stdout).toBeGreaterThan(0);
      expect(fds.stderr).toBeGreaterThan(0);
      expect(fds.signal).toBeGreaterThan(0);
    });

    it("should read data written by an external writer", async () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "read-test" });
      manager.create();
      manager.open();

      const collected: string[] = [];
      const stream = createReadStream(manager.paths.signal, {
        flags: "r",
        encoding: "utf-8",
      });

      const readPromise = new Promise<void>((resolve) => {
        stream.on("data", (chunk: string) => {
          collected.push(chunk);
          if (collected.join("").includes("prompt_ready\n")) {
            stream.destroy();
            resolve();
          }
        });
      });

      // Simulate an external writer (like the shell prompt hook)
      const writerFd = openSync(manager.paths.signal, constants.O_WRONLY);
      writeSync(writerFd, "prompt_ready\n");
      closeSync(writerFd);

      await readPromise;
      expect(collected.join("")).toContain("prompt_ready");
    });

    it("should survive multiple writer open/write/close cycles without EOF", async () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "multi-write-test" });
      manager.create();
      manager.open();

      const collected: string[] = [];
      const stream = createReadStream(manager.paths.signal, {
        flags: "r",
        encoding: "utf-8",
      });

      const readPromise = new Promise<void>((resolve) => {
        stream.on("data", (chunk: string) => {
          collected.push(chunk);
          if (collected.join("").includes("msg3")) {
            stream.destroy();
            resolve();
          }
        });
      });

      // Three separate writer open/write/close cycles
      for (const msg of ["msg1\n", "msg2\n", "msg3\n"]) {
        const fd = openSync(manager.paths.signal, constants.O_WRONLY);
        writeSync(fd, msg);
        closeSync(fd);
        // Small delay between writes to ensure close is processed
        await new Promise((r) => setTimeout(r, 20));
      }

      await readPromise;
      const all = collected.join("");
      expect(all).toContain("msg1");
      expect(all).toContain("msg2");
      expect(all).toContain("msg3");
    });

    it("should not receive EOF when external writer closes", async () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "no-eof-test" });
      manager.create();
      manager.open();

      let gotEnd = false;
      const stream = createReadStream(manager.paths.signal, {
        flags: "r",
        encoding: "utf-8",
      });
      stream.on("end", () => {
        gotEnd = true;
      });

      // Writer opens, writes, closes
      const fd = openSync(manager.paths.signal, constants.O_WRONLY);
      writeSync(fd, "hello\n");
      closeSync(fd);

      // Wait a bit — if EOF were going to fire, it would happen quickly
      await new Promise((r) => setTimeout(r, 100));
      stream.destroy();

      expect(gotEnd).toBe(false);
    });

    it("should throw if open is called before create", () => {
      manager = new FifoManager({ baseDir: tempDir, sessionId: "no-create" });
      expect(() => manager.open()).toThrow("FIFOs must be created before opening");
    });
  });

  describe("stale detection", () => {
    it("should detect and clean up stale session directories", () => {
      // Create a "stale" session directory manually
      const staleManager = new FifoManager({ baseDir: tempDir, sessionId: "stale-session" });
      staleManager.create();
      // Don't shut down — simulate a crash

      // A new manager should be able to clean up stale sessions
      const staleSessionIds = FifoManager.detectStale(tempDir);
      expect(staleSessionIds).toContain("stale-session");
    });

    it("should clean up a specific stale session", () => {
      const staleManager = new FifoManager({ baseDir: tempDir, sessionId: "stale-to-clean" });
      staleManager.create();

      FifoManager.cleanupStale(tempDir, "stale-to-clean");
      expect(existsSync(join(tempDir, "stale-to-clean"))).toBe(false);
    });
  });
});
