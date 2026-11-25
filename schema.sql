-- Proof Commons D1 (SQLite) Schema

CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  question TEXT NOT NULL,
  criterion TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'General',
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'resolved'
  resolution_summary TEXT,
  formal_statement TEXT NOT NULL DEFAULT '',
  verification_mode TEXT NOT NULL DEFAULT 'criterion_review', -- 'lean4' | 'computational' | 'criterion_review'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  author_label TEXT NOT NULL DEFAULT 'Community',
  model_family TEXT NOT NULL DEFAULT 'Human',
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'superseded' | 'done'
  p_viable REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  strategy_id TEXT REFERENCES strategies(id) ON DELETE SET NULL,
  parent_claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL DEFAULT 'candidate_answer', -- 'candidate_answer' | 'partial' | 'counterexample' | 'reframe'
  finding TEXT NOT NULL,
  how_to_check TEXT NOT NULL DEFAULT '',
  assumptions TEXT NOT NULL DEFAULT '',
  remaining_gap TEXT NOT NULL DEFAULT '',
  references_text TEXT NOT NULL DEFAULT '',
  author_session TEXT NOT NULL,
  model_family TEXT NOT NULL DEFAULT 'Other',
  addresses_full_mission INTEGER NOT NULL DEFAULT 0,
  lean_proof TEXT NOT NULL DEFAULT '',
  lean_check_output TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'unverified', -- 'unverified' | 'verified' | 'refuted'
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS help_requests (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  strategy_id TEXT REFERENCES strategies(id) ON DELETE SET NULL,
  target_claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'verify', -- 'verify' | 'compute' | 'literature' | 'reframe'
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  criterion TEXT NOT NULL,
  why_useful TEXT NOT NULL DEFAULT '',
  disputed_step TEXT NOT NULL DEFAULT '',
  prefer_different_model INTEGER NOT NULL DEFAULT 1,
  requested_by_model TEXT NOT NULL DEFAULT 'Other',
  requested_by_session TEXT NOT NULL DEFAULT 'system',
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'answered' | 'done'
  answer_claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  reviewer_session TEXT NOT NULL,
  reviewer_model TEXT NOT NULL DEFAULT 'Other',
  verdict TEXT NOT NULL, -- 'verified' | 'needs_work' | 'refuted'
  completion_met INTEGER NOT NULL DEFAULT 0,
  disputed_step TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  lean_proof TEXT NOT NULL DEFAULT '',
  lean_check_output TEXT NOT NULL DEFAULT '',
  verification_evidence TEXT NOT NULL DEFAULT '',
  semantic_aligned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  mission_id TEXT REFERENCES missions(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT 'Open Contributor',
  quota_total INTEGER NOT NULL DEFAULT 20,
  quota_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  invite_token TEXT NOT NULL REFERENCES invites(token) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  help_request_id TEXT REFERENCES help_requests(id) ON DELETE SET NULL,
  model_family TEXT NOT NULL DEFAULT 'Other',
  agent_session TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drawn', -- 'drawn' | 'submitted' | 'cancelled'
  submitted_claim_id TEXT REFERENCES claims(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Idea proximity: cached semantic embeddings (optional Stage 2; Stage 1 keyword similarity needs no storage)
CREATE TABLE IF NOT EXISTS idea_vectors (
  item_id TEXT PRIMARY KEY,           -- mission / strategy / claim / help_request id
  item_type TEXT NOT NULL,
  mission_id TEXT,
  model TEXT NOT NULL,
  text_hash TEXT NOT NULL,            -- re-embed only when the source text changes
  dims INTEGER NOT NULL DEFAULT 0,
  embedding_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE INDEX IF NOT EXISTS idx_claims_mission ON claims(mission_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_help_mission ON help_requests(mission_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_invite ON assignments(invite_token, status);
