-- ==============================================================================
-- MIGRATION 2026-10-15: PDPA section 26 (sensitive data: disability)
-- Adds explicit-consent and soft-delete columns to users, and lets a store exist
-- without a disability type (the field becomes optional).
-- Safe to run more than once. Does not delete or change any existing data.
--
-- Run (XAMPP):  /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/2026-10-15-pdpa-consent.sql
-- ==============================================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS disability_consent BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'explicit consent to keep disability data (PDPA s.26)',
    ADD COLUMN IF NOT EXISTS consent_at DATETIME NULL COMMENT 'last time consent was given or withdrawn',
    ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL COMMENT 'soft delete: account closed by its owner';

ALTER TABLE stores
    MODIFY disability_type VARCHAR(100) NULL;
