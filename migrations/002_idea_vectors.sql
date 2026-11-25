-- Migration 002: Idea proximity — cached semantic embeddings for related-idea detection.
-- The Worker runs this automatically on startup (ensureSchemaAndSeed); manual execution is optional.

CREATE TABLE IF NOT EXISTS idea_vectors (
  item_id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  mission_id TEXT,
  model TEXT NOT NULL,
  text_hash TEXT NOT NULL,
  dims INTEGER NOT NULL DEFAULT 0,
  embedding_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
