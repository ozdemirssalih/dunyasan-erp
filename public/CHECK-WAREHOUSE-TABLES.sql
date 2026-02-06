-- =====================================================
-- WAREHOUSE TABLOLARINI KONTROL ET
-- =====================================================

-- warehouse_categories kolonları
SELECT 'WAREHOUSE_CATEGORIES COLUMNS:' as info;

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'warehouse_categories'
ORDER BY ordinal_position;

-- warehouse_items kolonları
SELECT 'WAREHOUSE_ITEMS COLUMNS:' as info;

SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'warehouse_items'
ORDER BY ordinal_position;

-- Mevcut kategoriler
SELECT 'MEVCUT CATEGORIES:' as info;

SELECT * FROM warehouse_categories;

-- Mevcut ürünler
SELECT 'MEVCUT ITEMS:' as info;

SELECT id, code, name, category_id, current_stock FROM warehouse_items LIMIT 10;
