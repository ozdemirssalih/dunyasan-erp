-- =====================================================
-- STOK KONTROL
-- =====================================================

-- 1. Depo stoklarını göster
SELECT
    'DEPO STOKLARI:' as bilgi;

SELECT
    id,
    code,
    name,
    current_stock,
    unit,
    category_id
FROM warehouse_items
ORDER BY code
LIMIT 20;

-- 2. warehouse_items RLS politikalarını kontrol et
SELECT
    'WAREHOUSE_ITEMS RLS POLİTİKALARI:' as bilgi;

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'warehouse_items';

-- 3. Toplam ürün ve stok sayısı
SELECT
    'TOPLAM ÜRÜN VE STOK:' as bilgi;

SELECT
    COUNT(*) as toplam_urun,
    SUM(current_stock) as toplam_stok
FROM warehouse_items;

-- 4. Stoklu ürünler
SELECT
    'STOKLU ÜRÜNLER (current_stock > 0):' as bilgi;

SELECT
    code,
    name,
    current_stock,
    unit
FROM warehouse_items
WHERE current_stock > 0
ORDER BY current_stock DESC;
