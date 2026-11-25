-- Migration 003: Require Lean 4 formal proof for verified reviews
-- The Worker runs these ALTER statements automatically on startup.

ALTER TABLE reviews ADD COLUMN lean_proof TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN lean_check_output TEXT NOT NULL DEFAULT '';
