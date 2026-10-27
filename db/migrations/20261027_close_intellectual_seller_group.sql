-- ==============================================================================
-- MIGRATION 2026-10-27: no seller group "ผู้ที่มีความบกพร่องทางสติปัญญาและการเรียนรู้"
-- People with intellectual and learning disabilities cannot list and sell products by themselves,
-- so the group is no longer offered to sellers (registration, filters, matching, category cards).
-- Their work is sold through organizations instead: store 4 "โลกสดใสด้วยใจศิลป์ (Autism Heart Art)"
-- moves to the group "องค์กรสำหรับผู้ที่มีความพิการ".
-- People in this group still use the site as buyers ("โหมดเข้าใจง่าย" stays).
-- Nothing is deleted: the disability_types row stays (is_active = 0) so old records keep their meaning.
-- Safe to run more than once.
--
-- Run (XAMPP):
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/20261027_close_intellectual_seller_group.sql
-- ==============================================================================
SET NAMES utf8mb4;

-- 1. A group can be switched off without deleting it (lists show only active groups)
ALTER TABLE disability_types
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'shown to sellers and buyers (0 = closed, kept for old records)' AFTER label;

UPDATE disability_types SET is_active = 0 WHERE code = 'intellectual';

-- 2. The store of this group is now run as an organization
UPDATE stores s
JOIN disability_types org ON org.code = 'organization'
SET s.disability_type = 'organization', s.type_id = org.id
WHERE s.disability_type = 'intellectual';
