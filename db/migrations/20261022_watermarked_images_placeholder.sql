-- ==============================================================================
-- MIGRATION 2026-10-22: hide product photos that carry another website's watermark
-- They are replaced by a temporary image until the shops upload their own photos.
-- The files are NOT deleted; to restore, set image_url back to the value in the comment.
--
--   product 1 กระเป๋าสะพายผักตบชวาถักลายลูกแก้ว   /uploads/products/prod-1791908152667-202984973.jpg  (watermark "maha_saan.cm")
--   product 2 ชุดจานรองแก้วและถาดจัดโต๊ะสานไม้ไผ่  /uploads/products/prod-1791908056270-584305208.jpg  (logo "มหาสาน")
--   product 5 ถาดไม้จามจุรีทรงรีแกะสลักมือ           /uploads/products/prod-1791623729986-12988338.jpg   (faint orange text watermark)
--
-- Safe to run more than once.
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/20261022_watermarked_images_placeholder.sql
-- ==============================================================================
SET NAMES utf8mb4;

UPDATE products SET image_url = '/images/placeholders/product-pending.svg'
WHERE (id = 1 AND image_url = '/uploads/products/prod-1791908152667-202984973.jpg')
   OR (id = 2 AND image_url = '/uploads/products/prod-1791908056270-584305208.jpg')
   OR (id = 5 AND image_url = '/uploads/products/prod-1791623729986-12988338.jpg');

UPDATE product_images
SET image_url = '/images/placeholders/product-pending.svg', alt_text = CONCAT('ภาพชั่วคราว: ', (SELECT p.name FROM products p WHERE p.id = product_images.product_id))
WHERE image_url IN ('/uploads/products/prod-1791908152667-202984973.jpg',
                    '/uploads/products/prod-1791908056270-584305208.jpg',
                    '/uploads/products/prod-1791623729986-12988338.jpg');
