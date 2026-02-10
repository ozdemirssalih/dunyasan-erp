-- TUM STOK TABLOLARINA NEGATIF DEGER ENGELLEME CONSTRAINTLERI EKLE
-- Stoklar asla eksi (-) degere dusmemeli

-- ============================================================
-- 1. ONCE MEVCUT DURUM KONTROLU
-- ============================================================

SELECT 'MEVCUT STOK DURUMLARI (Negatif var mi?):' as info;

-- Production Inventory
SELECT
    'production_inventory' as tablo,
    COUNT(*) as toplam_kayit,
    COUNT(CASE WHEN current_stock < 0 THEN 1 END) as negatif_kayit,
    MIN(current_stock) as en_dusuk_deger
FROM production_inventory;

-- Machine Inventory
SELECT
    'machine_inventory' as tablo,
    COUNT(*) as toplam_kayit,
    COUNT(CASE WHEN current_stock < 0 THEN 1 END) as negatif_kayit,
    MIN(current_stock) as en_dusuk_deger
FROM machine_inventory;

-- Quality Control Inventory
SELECT
    'quality_control_inventory' as tablo,
    COUNT(*) as toplam_kayit,
    COUNT(CASE WHEN current_stock < 0 THEN 1 END) as negatif_kayit,
    MIN(current_stock) as en_dusuk_deger
FROM quality_control_inventory;

-- ============================================================
-- 2. NEGATIF DEGERLER VARSA DUZELT (0 a cek)
-- ============================================================

-- Production Inventory negatif degerleri 0 a cek
UPDATE production_inventory
SET current_stock = 0
WHERE current_stock < 0;

-- Machine Inventory negatif degerleri 0 a cek
UPDATE machine_inventory
SET current_stock = 0
WHERE current_stock < 0;

-- Quality Control Inventory negatif degerleri 0 a cek
UPDATE quality_control_inventory
SET current_stock = 0
WHERE current_stock < 0;

-- ============================================================
-- 3. CHECK CONSTRAINTLERI EKLE
-- ============================================================

-- Production Inventory - stok negatif olamaz
ALTER TABLE production_inventory
DROP CONSTRAINT IF EXISTS production_inventory_stock_non_negative;

ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_stock_non_negative
CHECK (current_stock >= 0);

-- Machine Inventory - stok negatif olamaz
ALTER TABLE machine_inventory
DROP CONSTRAINT IF EXISTS machine_inventory_stock_non_negative;

ALTER TABLE machine_inventory
ADD CONSTRAINT machine_inventory_stock_non_negative
CHECK (current_stock >= 0);

-- Quality Control Inventory - stok negatif olamaz
ALTER TABLE quality_control_inventory
DROP CONSTRAINT IF EXISTS quality_control_inventory_stock_non_negative;

ALTER TABLE quality_control_inventory
ADD CONSTRAINT quality_control_inventory_stock_non_negative
CHECK (current_stock >= 0);

-- Warehouse Items - stok negatif olamaz
ALTER TABLE warehouse_items
DROP CONSTRAINT IF EXISTS warehouse_items_stock_non_negative;

ALTER TABLE warehouse_items
ADD CONSTRAINT warehouse_items_stock_non_negative
CHECK (current_stock >= 0);

-- ============================================================
-- 4. CONSTRAINTLERIN EKLENME KONTROLU
-- ============================================================

SELECT 'EKLENEN CONSTRAINTLER:' as info;

SELECT
    conname as constraint_adi,
    conrelid::regclass as tablo,
    pg_get_constraintdef(oid) as tanim
FROM pg_constraint
WHERE conname LIKE '%stock_non_negative%'
ORDER BY conrelid::regclass::text;

-- ============================================================
-- 5. BASARI MESAJI
-- ============================================================

SELECT 'TUM STOK TABLOLARINA CHECK CONSTRAINT EKLENDI!' as mesaj;
SELECT 'Artik stoklar asla negatif degere dusemez.' as bilgi;
SELECT 'Negatif stok islemi yapilmaya calisildiginda database hata verecek.' as aciklama;
