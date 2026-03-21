import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZellijClient } from "./zellij.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
}));

import { execSync } from "node:child_process";

const mockExecSync = vi.mocked(execSync);

describe("ZellijClient", () => {
  let client: ZellijClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ZellijClient({ sessionName: "test-session" });
  });

  describe("writeChars", () => {
    it("should invoke zellij action write-chars with the command", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      client.writeChars("echo hello\n");

      expect(mockExecSync).toHaveBeenCalledOnce();
      const call = mockExecSync.mock.calls[0]!;
      const cmd = call[0] as string;
      expect(cmd).toContain("zellij action write-chars");
      expect(cmd).toContain("echo hello");
    });

    it("should set ZELLIJ_SESSION_NAME in the environment", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      client.writeChars("ls\n");

      const call = mockExecSync.mock.calls[0]!;
      const opts = call[1] as Record<string, unknown>;
      const env = opts["env"] as Record<string, string>;
      expect(env["ZELLIJ_SESSION_NAME"]).toBe("test-session");
    });

    it("should throw ZellijError if execSync fails", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("Zellij not running");
      });

      expect(() => client.writeChars("ls\n")).toThrow("Zellij not running");
    });
  });

  describe("dumpScreen", () => {
    it("should invoke zellij action dump-screen with --full flag and file path", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      client.dumpScreen("/tmp/output.fifo");

      expect(mockExecSync).toHaveBeenCalledOnce();
      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain("zellij action dump-screen --full");
      expect(cmd).toContain("/tmp/output.fifo");
    });

    it("should set ZELLIJ_SESSION_NAME in the environment", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      client.dumpScreen("/tmp/out");

      const opts = mockExecSync.mock.calls[0]![1] as Record<string, unknown>;
      const env = opts["env"] as Record<string, string>;
      expect(env["ZELLIJ_SESSION_NAME"]).toBe("test-session");
    });
  });

  describe("createSession", () => {
    it("should invoke zellij attach with --create-background", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      client.createSession("my-relay");

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain("zellij attach --create-background");
      expect(cmd).toContain("my-relay");
    });
  });

  describe("newPane", () => {
    it("should invoke zellij action new-pane", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      client.newPane();

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain("zellij action new-pane");
    });

    it("should set ZELLIJ_SESSION_NAME in the environment", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      client.newPane();

      const opts = mockExecSync.mock.calls[0]![1] as Record<string, unknown>;
      const env = opts["env"] as Record<string, string>;
      expect(env["ZELLIJ_SESSION_NAME"]).toBe("test-session");
    });
  });

  describe("isAvailable", () => {
    it("should return true when zellij is installed", () => {
      mockExecSync.mockReturnValue(Buffer.from("/usr/bin/zellij\n"));

      expect(client.isAvailable()).toBe(true);
    });

    it("should return false when zellij is not installed", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("command not found");
      });

      expect(client.isAvailable()).toBe(false);
    });
  });

  describe("listSessions", () => {
    it("should parse zellij list-sessions output", () => {
      // When encoding is specified, execSync returns string
      mockExecSync.mockReturnValue(
        "my-session [Created 1h ago]\nother-session [Created 2h ago]\n" as never
      );

      const sessions = client.listSessions();
      expect(sessions).toContain("my-session");
      expect(sessions).toContain("other-session");
    });

    it("should return empty array when no sessions exist", () => {
      mockExecSync.mockReturnValue("" as never);

      const sessions = client.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe("sendKeys", () => {
    it("should invoke write-chars with control characters for Ctrl+C", () => {
      mockExecSync.mockReturnValue(Buffer.from(""));

      client.sendKeys("\x03"); // Ctrl+C

      const cmd = mockExecSync.mock.calls[0]![0] as string;
      expect(cmd).toContain("zellij action write-chars");
    });
  });
});
