-- =============================================
-- ENVANTER SİSTEMİ - PARA BİRİMİ EKLEMESİ
-- =============================================
-- Inventory, Warehouse ve Toolroom tablolarına currency sütunu ekler
-- Varsayılan değer: TL
-- =============================================

-- 1. inventory tablosuna currency sütunu ekle
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TL';

COMMENT ON COLUMN inventory.currency IS 'Para birimi (TL, USD, EUR)';

-- Mevcut kayıtları TL olarak güncelle
UPDATE inventory
SET currency = 'TL'
WHERE currency IS NULL;

-- 2. warehouse_items tablosuna currency sütunu ekle
ALTER TABLE warehouse_items
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TL';

COMMENT ON COLUMN warehouse_items.currency IS 'Para birimi (TL, USD, EUR)';

-- Mevcut kayıtları TL olarak güncelle
UPDATE warehouse_items
SET currency = 'TL'
WHERE currency IS NULL;

-- 3. tools tablosuna currency sütunu ekle
ALTER TABLE tools
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'TL';

COMMENT ON COLUMN tools.currency IS 'Para birimi (TL, USD, EUR)';

-- Mevcut kayıtları TL olarak güncelle
UPDATE tools
SET currency = 'TL'
WHERE currency IS NULL;

-- Başarı mesajı
SELECT
  '✅ Currency sütunları başarıyla eklendi!' as message,
  (SELECT COUNT(*) FROM inventory WHERE currency IS NOT NULL) as inventory_updated,
  (SELECT COUNT(*) FROM warehouse_items WHERE currency IS NOT NULL) as warehouse_updated,
  (SELECT COUNT(*) FROM tools WHERE currency IS NOT NULL) as tools_updated;
