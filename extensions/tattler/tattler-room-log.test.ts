import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  advanceCursor,
  appendMessage,
  closeRoomLog,
  getCursor,
  openRoomLog,
  readMessagesSinceCursor,
  snapshotRoomMessages,
} from './tattler-room-log';

describe('tattler room log', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'tattler-room-log-test-'));
  });

  afterEach(() => {
    closeRoomLog();
    rmSync(dataDir, { recursive: true, force: true });
  });

  test('opens database and runs migrations', () => {
    const db = openRoomLog(dataDir);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all() as string[];

    expect(tables).toContain('messages');
    expect(tables).toContain('cursors');
    expect(tables).toContain('_migrations');
  });

  test('appends and reads messages', () => {
    const db = openRoomLog(dataDir);

    const seq1 = appendMessage(db, {
      id: 'msg-001',
      room_id: 'room-a',
      agent_id: 'agent-1',
      handle: 'Alice',
      body: 'hello',
      timestamp: 1000,
      audience_snapshot: null,
    });

    const seq2 = appendMessage(db, {
      id: 'msg-002',
      room_id: 'room-a',
      agent_id: 'agent-2',
      handle: 'Bob',
      body: 'world',
      timestamp: 2000,
      audience_snapshot: '[]',
    });

    expect(seq1).toBeGreaterThan(0);
    expect(seq2).toBeGreaterThan(seq1);

    const snapshot = snapshotRoomMessages(db, 'room-a');
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0]?.body).toBe('hello');
    expect(snapshot[1]?.body).toBe('world');
  });

  test('cursor read returns messages after cursor', () => {
    const db = openRoomLog(dataDir);

    appendMessage(db, {
      id: 'msg-001',
      room_id: 'room-a',
      agent_id: 'agent-1',
      handle: 'Alice',
      body: 'first',
      timestamp: 1000,
      audience_snapshot: null,
    });

    const seq2 = appendMessage(db, {
      id: 'msg-002',
      room_id: 'room-a',
      agent_id: 'agent-1',
      handle: 'Alice',
      body: 'second',
      timestamp: 2000,
      audience_snapshot: null,
    });

    const unread = readMessagesSinceCursor(db, 'room-a', 0);
    expect(unread).toHaveLength(2);

    const afterFirst = readMessagesSinceCursor(db, 'room-a', 1);
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]?.body).toBe('second');

    const afterAll = readMessagesSinceCursor(db, 'room-a', seq2);
    expect(afterAll).toHaveLength(0);
  });

  test('cursor advance and read', () => {
    const db = openRoomLog(dataDir);

    expect(getCursor(db, 'agent-1', 'room-a')).toBe(0);

    const seq = appendMessage(db, {
      id: 'msg-001',
      room_id: 'room-a',
      agent_id: 'agent-1',
      handle: 'Alice',
      body: 'hello',
      timestamp: 1000,
      audience_snapshot: null,
    });

    advanceCursor(db, 'agent-1', 'room-a', seq);
    expect(getCursor(db, 'agent-1', 'room-a')).toBe(seq);

    const unread = readMessagesSinceCursor(db, 'room-a', getCursor(db, 'agent-1', 'room-a'));
    expect(unread).toHaveLength(0);
  });

  test('rooms are isolated', () => {
    const db = openRoomLog(dataDir);

    appendMessage(db, {
      id: 'msg-001',
      room_id: 'room-a',
      agent_id: 'agent-1',
      handle: 'Alice',
      body: 'in room a',
      timestamp: 1000,
      audience_snapshot: null,
    });

    appendMessage(db, {
      id: 'msg-002',
      room_id: 'room-b',
      agent_id: 'agent-1',
      handle: 'Alice',
      body: 'in room b',
      timestamp: 2000,
      audience_snapshot: null,
    });

    expect(snapshotRoomMessages(db, 'room-a')).toHaveLength(1);
    expect(snapshotRoomMessages(db, 'room-b')).toHaveLength(1);
  });
});
