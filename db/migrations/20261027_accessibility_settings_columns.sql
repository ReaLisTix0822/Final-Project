-- ==============================================================================
-- MIGRATION 2026-10-27: Accessibility_Settings keeps every option of the A11y menu
-- The table had font_size, contrast_mode, voice_enabled, reduce_motion only.
-- These columns hold the rest (one column per option, not JSON, so each has a type
-- and a default and matches the data dictionary in the report).
--   font_size      'normal' (100%) | 'large' (125%) | 'x-large' (150%)
--   contrast_mode  'default' | 'high' | 'grayscale'
--   voice_enabled  the user turned voice commands on (the microphone still needs a click)
--   reduce_motion  "หยุดภาพเคลื่อนไหว"
-- Safe to run more than once. Does not delete or change any existing data.
--
-- Run (XAMPP):
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/20261027_accessibility_settings_columns.sql
-- ==============================================================================
SET NAMES utf8mb4;

ALTER TABLE accessibility_settings
    ADD COLUMN IF NOT EXISTS dyslexia_font BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'easy-to-read font (Atkinson Hyperlegible + Noto Sans Thai Looped)' AFTER reduce_motion,
    ADD COLUMN IF NOT EXISTS highlight_links BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'thick underline on links, frame on card links' AFTER dyslexia_font,
    ADD COLUMN IF NOT EXISTS text_spacing BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'WCAG 1.4.12 letter, word and line spacing' AFTER highlight_links,
    ADD COLUMN IF NOT EXISTS big_cursor BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'large mouse pointer' AFTER text_spacing,
    ADD COLUMN IF NOT EXISTS easy_mode BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'easy-to-understand mode with a page guide' AFTER big_cursor,
    ADD COLUMN IF NOT EXISTS focus_reading BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'read aloud the element that keyboard focus is on' AFTER easy_mode,
    ADD COLUMN IF NOT EXISTS speech_rate DECIMAL(3,2) NOT NULL DEFAULT 1.00 COMMENT 'speech rate: 0.75 slow, 1.00 normal, 1.50 fast' AFTER focus_reading;

-- Demo accounts without a row get the default values (rows that exist are left as they are)
INSERT INTO accessibility_settings (user_id, font_size, contrast_mode, voice_enabled, reduce_motion,
    dyslexia_font, highlight_links, text_spacing, big_cursor, easy_mode, focus_reading, speech_rate)
SELECT u.id, x.font_size, x.contrast_mode, x.voice_enabled, x.reduce_motion,
    x.dyslexia_font, x.highlight_links, x.text_spacing, x.big_cursor, x.easy_mode, x.focus_reading, x.speech_rate
FROM (
    SELECT 'admin@inclusive-market.org' AS email, 'normal' AS font_size, 'default' AS contrast_mode, 0 AS voice_enabled, 0 AS reduce_motion,
           0 AS dyslexia_font, 0 AS highlight_links, 0 AS text_spacing, 0 AS big_cursor, 0 AS easy_mode, 0 AS focus_reading, 1.00 AS speech_rate
    UNION ALL SELECT 'wilai.deafcraft@gmail.com', 'normal', 'default', 0, 0, 0, 1, 0, 0, 0, 0, 1.00
    UNION ALL SELECT 'ekkachai.woodart@gmail.com', 'large', 'default', 1, 0, 0, 0, 0, 1, 0, 0, 1.00
) x
JOIN users u ON u.email = x.email
WHERE NOT EXISTS (SELECT 1 FROM accessibility_settings a WHERE a.user_id = u.id);
