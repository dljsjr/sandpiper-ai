-- Migration 002: Create the per-agent read cursor table
--
-- Invariant: cursor advances atomically on tool-call success.
-- Partial failure leaves cursor at last committed position.

CREATE TABLE IF NOT EXISTS cursors (
  agent_id TEXT NOT NULL,              -- Tattler ID
  room_id TEXT NOT NULL,               -- stable room identifier
  last_seq INTEGER NOT NULL DEFAULT 0, -- last committed rowid
  updated_at INTEGER NOT NULL,         -- unix epoch ms
  PRIMARY KEY (agent_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_cursors_room ON cursors (room_id);
