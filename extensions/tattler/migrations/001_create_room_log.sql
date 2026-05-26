-- Migration 001: Create the durable room log (messages) table
--
-- Invariant: append-only, no UPDATE/DELETE.
-- The rowid is the monotonic seq cursor key.

CREATE TABLE IF NOT EXISTS messages (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, -- monotonic cursor key
  id TEXT NOT NULL UNIQUE,               -- UUIDv7 post id
  room_id TEXT NOT NULL,                 -- stable room identifier
  agent_id TEXT NOT NULL,                -- Tattler ID (stable for MVP)
  handle TEXT NOT NULL,                  -- display name at post time
  body TEXT NOT NULL,                    -- message content
  timestamp INTEGER NOT NULL,            -- unix epoch ms
  audience_snapshot TEXT                 -- JSON array of participant ids at append time
);

-- Index for cursor-bounded reads: WHERE seq > :cursor
CREATE INDEX IF NOT EXISTS idx_messages_room_seq ON messages (room_id, seq);

-- Index for room listing
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages (room_id);
