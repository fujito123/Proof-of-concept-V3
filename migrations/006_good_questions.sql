-- Migration 006: Good Question — unified syntheses & follow-up hypotheses
-- The Worker creates this table automatically on startup.

CREATE TABLE IF NOT EXISTS good_questions (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  synthesis_summary TEXT NOT NULL,
  title TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  question TEXT NOT NULL,
  criterion TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'General',
  verification_mode TEXT NOT NULL DEFAULT 'criterion_review',
  why_interesting TEXT NOT NULL DEFAULT '',
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  novelty_score REAL NOT NULL DEFAULT 1.0,
  engine TEXT NOT NULL DEFAULT 'deterministic',
  launched_mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
  endorsements INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
