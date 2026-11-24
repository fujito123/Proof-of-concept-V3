-- Migration 001: Full-mission candidate solutions, why_useful context, and disputed-step reviews
-- Run these statements in Cloudflare D1 Console if upgrading an existing database.

ALTER TABLE claims ADD COLUMN addresses_full_mission INTEGER NOT NULL DEFAULT 0;
ALTER TABLE help_requests ADD COLUMN why_useful TEXT NOT NULL DEFAULT '';
ALTER TABLE help_requests ADD COLUMN disputed_step TEXT NOT NULL DEFAULT '';
ALTER TABLE reviews ADD COLUMN completion_met INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reviews ADD COLUMN disputed_step TEXT NOT NULL DEFAULT '';
