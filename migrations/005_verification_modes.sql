-- Migration 005: Inclusive multi-domain verification modes (lean4, computational, criterion_review)
-- The Worker runs these statements automatically on startup.

ALTER TABLE missions ADD COLUMN verification_mode TEXT NOT NULL DEFAULT 'criterion_review';
ALTER TABLE reviews ADD COLUMN verification_evidence TEXT NOT NULL DEFAULT '';
UPDATE missions SET verification_mode = 'lean4' WHERE id IN ('mission-bh-balance', 'mission-curling-49', 'mission-hadwiger-nelson-5');
