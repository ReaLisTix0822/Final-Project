-- ==============================================================================
-- MIGRATION 2026-10-27: "คำอธิบายปุ่ม (Tooltips)" replaces "โหมดเข้าใจง่าย" in the accessibility menu
-- New column show_tooltips. The column easy_mode is kept (no data is deleted) but no longer used.
-- Safe to run more than once.
--
-- Run (XAMPP):
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/20261027_accessibility_tooltips.sql
-- ==============================================================================
SET NAMES utf8mb4;

ALTER TABLE accessibility_settings
    ADD COLUMN IF NOT EXISTS show_tooltips BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'tooltips on hover / keyboard focus' AFTER focus_reading,
    MODIFY COLUMN easy_mode BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'no longer used: easy mode was removed on 2026-10-27 (kept for old records)';
