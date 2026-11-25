-- Migration 004: Locked formal Lean statements, author-supplied Lean proofs, and semantic alignment sign-off
-- The Worker runs these ALTER statements automatically on startup.

ALTER TABLE missions ADD COLUMN formal_statement TEXT NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN lean_proof TEXT NOT NULL DEFAULT '';
ALTER TABLE claims ADD COLUMN lean_check_output TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN semantic_aligned INTEGER NOT NULL DEFAULT 0;
