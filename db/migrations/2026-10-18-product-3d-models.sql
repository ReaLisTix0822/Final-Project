-- ==============================================================================
-- MIGRATION 2026-10-18: real 3D models for 3 products
-- Made from each product's own uploaded photo with TripoSR (open-source image-to-3D, MIT),
-- run locally, then stood upright, cleaned and compressed (glTF quantize + WebP texture).
--   product 8  ceramic mug     <- /uploads/products/prod-1791907839813-970605545.jpeg
--   product 5  acacia tray     <- /uploads/products/prod-1791623729986-12988338.jpg
--   product 2  bamboo coasters <- /uploads/products/prod-1791908056270-584305208.jpg (one coaster of the set)
--   product 1  water hyacinth bag <- /uploads/products/prod-1791908152667-202984973.jpg (added 2026-10-20: the boxy
--              bag on the left of the photo, cut out by hand, scaled to its real size 22 x 18 x 8 cm)
-- Only fills empty model fields; safe to run more than once.
--
-- Run (XAMPP):
--   /Applications/XAMPP/xamppfiles/bin/mysql -uroot inclusive_marketplace < db/migrations/2026-10-18-product-3d-models.sql
-- ==============================================================================

UPDATE products SET model_3d_url = '/models/product-8-ceramic-mug.glb'
WHERE id = 8 AND image_url = '/uploads/products/prod-1791907839813-970605545.jpeg' AND (model_3d_url IS NULL OR model_3d_url = '');
UPDATE products SET model_3d_url = '/models/product-5-acacia-tray.glb'
WHERE id = 5 AND image_url = '/uploads/products/prod-1791623729986-12988338.jpg' AND (model_3d_url IS NULL OR model_3d_url = '');
UPDATE products SET model_3d_url = '/models/product-2-bamboo-coaster.glb'
WHERE id = 2 AND image_url = '/uploads/products/prod-1791908056270-584305208.jpg' AND (model_3d_url IS NULL OR model_3d_url = '');

UPDATE products SET model_3d_url = '/models/product-1-water-hyacinth-bag.glb'
WHERE id = 1 AND image_url = '/uploads/products/prod-1791908152667-202984973.jpg' AND (model_3d_url IS NULL OR model_3d_url = '');

-- Keep product_3d_models in step (products 5 and 8 already have a row, product 2 does not)
INSERT INTO product_3d_models (product_id, model_url, status, source_image_count)
SELECT p.id, p.model_3d_url, 'completed', 1 FROM products p
WHERE p.id IN (1, 2, 5, 8) AND p.model_3d_url LIKE '/models/product-%'
ON DUPLICATE KEY UPDATE model_url = VALUES(model_url), status = 'completed';
