/**
 * Tattler durable room log — TAT-71 implementation.
 *
 * Append-only SQLite log with per-agent read cursors.
 * Uses node:sqlite for synchronous, same-host embedded access.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations', import.meta.url));
const DB_FILE_NAME = 'tattler-rooms.db';

let db: DatabaseSync | undefined;
let dbPath: string | undefined;

/**
 * Open (or create) the room-log database, running pending migrations.
 * Singleton per resolved db path; throws on mismatched dataDir.
 */
export function openRoomLog(dataDir: string): DatabaseSync {
  const resolvedPath = resolve(dataDir, DB_FILE_NAME);

  if (db) {
    if (dbPath !== resolvedPath) {
      throw new Error(`Room log already open at ${dbPath}; refusing to open ${resolvedPath}`);
    }
    return db;
  }

  dbPath = resolvedPath;
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');

  runMigrations(db);

  return db;
}

/**
 * Close the room-log database.
 */
export function closeRoomLog(): void {
  if (db) {
    db.close();
    db = undefined;
    dbPath = undefined;
  }
}

/**
 * Run pending migrations from the migrations directory.
 * Migrations are numbered SQL files, applied in order, tracked in _migrations.
 */
function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const appliedVersions = new Set(
    (database.prepare('SELECT version FROM _migrations').all() as { version: number }[]).map((row) => row.version),
  );

  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const seenVersions = new Set<number>();

  for (const file of migrationFiles) {
    const prefix = file.split('_')[0] ?? '';
    const version = parseInt(prefix, 10);
    if (Number.isNaN(version)) {
      throw new Error(`Invalid migration filename: ${file}`);
    }

    if (seenVersions.has(version)) {
      throw new Error(`Duplicate migration version ${version}: ${file}`);
    }
    seenVersions.add(version);

    if (appliedVersions.has(version)) {
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
    database.exec('BEGIN');
    try {
      database.exec(sql);
      database
        .prepare('INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(version, file, Date.now());
      database.exec('COMMIT');
    } catch (error) {
      if (database.isTransaction) database.exec('ROLLBACK');
      throw error;
    }
  }
}

// ============================================================================
// Message record shape
// ============================================================================

export interface RoomMessageRecord {
  readonly id: string; // UUIDv7
  readonly room_id: string;
  readonly agent_id: string; // Tattler ID
  readonly handle: string;
  readonly body: string;
  readonly timestamp: number;
  readonly audience_snapshot: string | null; // JSON
  readonly seq: number; // rowid
}

// ============================================================================
// Write path
// ============================================================================

/**
 * Append a message to the room log.
 * Returns the inserted rowid (seq).
 */
export function appendMessage(database: DatabaseSync, message: Omit<RoomMessageRecord, 'seq'>): number {
  const result = database
    .prepare(
      `INSERT INTO messages (id, room_id, agent_id, handle, body, timestamp, audience_snapshot)
       VALUES (:id, :room_id, :agent_id, :handle, :body, :timestamp, :audience_snapshot)`,
    )
    .run({
      id: message.id,
      room_id: message.room_id,
      agent_id: message.agent_id,
      handle: message.handle,
      body: message.body,
      timestamp: message.timestamp,
      audience_snapshot: message.audience_snapshot,
    });

  return Number(result.lastInsertRowid);
}

// ============================================================================
// Read path — sync snapshot for TUI / broker
// ============================================================================

/**
 * Return all messages in a room, ordered by seq.
 */
export function snapshotRoomMessages(database: DatabaseSync, roomId: string): RoomMessageRecord[] {
  return database
    .prepare(
      `SELECT seq, id, room_id, agent_id, handle, body, timestamp, audience_snapshot
       FROM messages
       WHERE room_id = :room_id
       ORDER BY seq ASC`,
    )
    .all({ room_id: roomId }) as unknown as RoomMessageRecord[];
}

/**
 * Return messages in a room with seq > cursor, ordered by seq.
 */
export function readMessagesSinceCursor(database: DatabaseSync, roomId: string, cursor: number): RoomMessageRecord[] {
  return database
    .prepare(
      `SELECT seq, id, room_id, agent_id, handle, body, timestamp, audience_snapshot
       FROM messages
       WHERE room_id = :room_id AND seq > :cursor
       ORDER BY seq ASC`,
    )
    .all({ room_id: roomId, cursor }) as unknown as RoomMessageRecord[];
}

// ============================================================================
// Cursor operations
// ============================================================================

/**
 * Get the current cursor for an agent in a room.
 * Returns 0 if no cursor exists (start at beginning).
 */
export function getCursor(database: DatabaseSync, agentId: string, roomId: string): number {
  const row = database
    .prepare('SELECT last_seq FROM cursors WHERE agent_id = :agent_id AND room_id = :room_id')
    .get({ agent_id: agentId, room_id: roomId }) as { last_seq: number } | undefined;

  return row?.last_seq ?? 0;
}

/**
 * Advance the cursor for an agent in a room.
 */
export function advanceCursor(database: DatabaseSync, agentId: string, roomId: string, newSeq: number): void {
  database
    .prepare(
      `INSERT INTO cursors (agent_id, room_id, last_seq, updated_at)
       VALUES (:agent_id, :room_id, :last_seq, :updated_at)
       ON CONFLICT(agent_id, room_id) DO UPDATE SET
         last_seq = excluded.last_seq,
         updated_at = excluded.updated_at`,
    )
    .run({
      agent_id: agentId,
      room_id: roomId,
      last_seq: newSeq,
      updated_at: Date.now(),
    });
}
