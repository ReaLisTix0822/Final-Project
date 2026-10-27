-- ==============================================================================
-- MIGRATION 2026-10-18: demo data fixes (bug list A1, A2, A3, A11, A12, A16)
-- Safe to run more than once. Nothing is deleted except the 3 rejected TEST stores
-- (their user accounts are kept and switched to buyer accounts).
--
-- Run (XAMPP):
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/2026-10-18-demo-data-fixes.sql
--   cp db/demo-documents/demo-verification-placeholder.pdf private-uploads/store-documents/
-- ==============================================================================

-- A2. Disability group for people with intellectual and learning disabilities (store 4 already uses this code)
INSERT IGNORE INTO disability_types (code, name, label)
VALUES ('intellectual', 'ทางสติปัญญาและการเรียนรู้', 'ผู้ที่มีความบกพร่องทางสติปัญญาและการเรียนรู้');
UPDATE disability_types SET name = 'องค์กรสำหรับผู้ที่มีความพิการ', label = 'องค์กรสำหรับผู้ที่มีความพิการ' WHERE code = 'organization';

-- A1. The 4 demo sellers agreed to show their disability group (PDPA s.26 consent, demo data)
UPDATE users SET disability_consent = TRUE, consent_at = COALESCE(consent_at, NOW())
WHERE email IN ('somchai.blindcraft@gmail.com', 'wilai.deafcraft@gmail.com', 'ekkachai.woodart@gmail.com', 'nattapong.artheart@gmail.com')
  AND disability_consent = FALSE;

-- A3. Sample models from modelviewer.dev / red-bag.glb are not the real products: remove them
UPDATE products SET model_3d_url = NULL
WHERE model_3d_url LIKE 'https://modelviewer.dev/%' OR model_3d_url = '/models/red-bag.glb';
UPDATE product_3d_models SET model_url = NULL, status = 'none'
WHERE model_url LIKE 'https://modelviewer.dev/%' OR model_url = '/models/red-bag.glb';

-- A11. One name for the demo buyer account (buyer.anurak@gmail.com is called "พงษ์ดนัย จักษุแจ้ง")
UPDATE users SET full_name = 'พงษ์ดนัย จักษุแจ้ง' WHERE email = 'buyer.anurak@gmail.com';
UPDATE reviews SET seller_reply = REPLACE(seller_reply, 'คุณอนุรักษ์', 'คุณพงษ์ดนัย') WHERE seller_reply LIKE '%คุณอนุรักษ์%';
UPDATE chat_messages SET message = REPLACE(message, 'คุณอนุรักษ์', 'คุณพงษ์ดนัย') WHERE message LIKE '%คุณอนุรักษ์%';
UPDATE orders SET shipping_name = 'พงษ์ดนัย จักษุแจ้ง' WHERE shipping_name = 'คุณอนุรักษ์ ส่งเสริมศิลป์';

-- A12. Khanom Klip Lamduan is food, not home decor
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'อาหาร ขนมไทย และเกษตรแปรรูป')
WHERE name LIKE 'ขนมกลีบลำดวน%';

-- A16a. Remove the 3 rejected test stores ("แซ็คกี้" x2, "องค์กรอะไรสักอย่าง"). They have no products,
-- orders, tips or followers. The owners' user accounts stay and become buyer accounts so they can still sign in.
UPDATE users SET role = 'buyer'
WHERE id IN (SELECT user_id FROM stores WHERE verification_status = 'rejected' AND store_name IN ('แซ็คกี้', 'องค์กรอะไรสักอย่าง'));
DELETE FROM stores
WHERE verification_status = 'rejected' AND store_name IN ('แซ็คกี้', 'องค์กรอะไรสักอย่าง')
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.store_id = stores.id)
  AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.store_id = stores.id);

-- A16b. DEMO DATA: approved demo stores get a placeholder verification document (not a real ID).
-- The file is db/demo-documents/demo-verification-placeholder.pdf copied into private-uploads/store-documents/.
INSERT INTO store_documents (store_id, doc_type, file_path, original_name, mime_type, file_size)
SELECT s.id, 'disability_card', 'demo-verification-placeholder.pdf', 'เอกสารตัวอย่าง (Demo).pdf', 'application/pdf', 766
FROM stores s
WHERE s.id IN (1, 2, 3, 4) AND s.verification_status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM store_documents d WHERE d.store_id = s.id);
