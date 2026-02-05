-- DÜNYASAN ERP - Veri Kontrol
-- Hammadde ve stok verilerini kontrol et

-- 1. Depo stokları
SELECT
    'warehouse_items' as tablo,
    COUNT(*) as toplam,
    COUNT(CASE WHEN current_stock > 0 THEN 1 END) as stokta_olan
FROM warehouse_items;

-- 2. Üretim deposu hammaddeleri
SELECT
    'production_inventory (hammadde)' as tablo,
    COUNT(*) as toplam,
    COUNT(CASE WHEN current_stock > 0 THEN 1 END) as stokta_olan
FROM production_inventory
WHERE item_type = 'raw_material';

-- 3. Üretim deposu bitmiş ürünler
SELECT
    'production_inventory (bitmiş ürün)' as tablo,
    COUNT(*) as toplam,
    COUNT(CASE WHEN current_stock > 0 THEN 1 END) as stokta_olan
FROM production_inventory
WHERE item_type = 'finished_product';

-- 4. Depo stok detayları (ilk 10)
SELECT
    code,
    name,
    current_stock,
    unit,
    is_active
FROM warehouse_items
ORDER BY name
LIMIT 10;

-- 5. Üretim deposu detayları (ilk 10)
SELECT
    wi.code,
    wi.name,
    pi.current_stock,
    wi.unit,
    pi.item_type
FROM production_inventory pi
JOIN warehouse_items wi ON wi.id = pi.item_id
WHERE pi.current_stock > 0
ORDER BY pi.item_type, wi.name
LIMIT 10;
