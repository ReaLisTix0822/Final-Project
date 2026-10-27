-- ==============================================================================
-- DEMO DATA for the tables added on 2026-10-19 (run after 20261019_align_32_tables.sql)
-- support_goals, store_verifications, order_status_history, chat_rooms and bot_* are
-- already filled from existing data by the migration; this adds Accessibility_Settings,
-- which had no source data (the site kept these settings only in the browser).
-- Safe to run more than once.
--
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/20261019_align_32_tables_demo_data.sql
-- ==============================================================================
SET NAMES utf8mb4;

INSERT INTO accessibility_settings (user_id, font_size, contrast_mode, voice_enabled, reduce_motion)
SELECT u.id, x.font_size, x.contrast_mode, x.voice_enabled, x.reduce_motion
FROM (
    SELECT 'somchai.blindcraft@gmail.com' AS email, 'x-large' AS font_size, 'high' AS contrast_mode, 1 AS voice_enabled, 0 AS reduce_motion
    UNION ALL SELECT 'nattapong.artheart@gmail.com', 'large', 'default', 1, 1
    UNION ALL SELECT 'buyer.anurak@gmail.com', 'normal', 'default', 0, 0
) x
JOIN users u ON u.email = x.email
WHERE NOT EXISTS (SELECT 1 FROM accessibility_settings a WHERE a.user_id = u.id);

-- Matching_Preferences: the demo buyer's answers in the matching quiz (no row yet on this database)
INSERT INTO matching_preferences (user_id, type_id, category_id)
SELECT u.id, dt.id, NULL FROM users u JOIN disability_types dt ON dt.code IN ('visual', 'hearing')
WHERE u.email = 'buyer.anurak@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM matching_preferences m WHERE m.user_id = u.id);
INSERT INTO matching_preferences (user_id, type_id, category_id)
SELECT u.id, NULL, c.id FROM users u JOIN categories c ON c.name = 'งานจักสานและหัตถกรรมพื้นบ้าน'
WHERE u.email = 'buyer.anurak@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM matching_preferences m WHERE m.user_id = u.id AND m.category_id IS NOT NULL);
