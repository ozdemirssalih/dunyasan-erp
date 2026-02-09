-- Tüm üretim verilerini temizle (test verileri için)
-- ÖNEMLİ: Bu işlem TÜM üretim kayıtlarını siler!
-- Gerçek üretim verileri varsa YEDEK ALIN!

-- 1. Fire kayıtlarını temizle
TRUNCATE TABLE production_scrap_records RESTART IDENTITY CASCADE;

-- 2. Üretim çıktılarını temizle
TRUNCATE TABLE production_outputs RESTART IDENTITY CASCADE;

-- 3. Tezgah atamalarını temizle
TRUNCATE TABLE production_to_machine_transfers RESTART IDENTITY CASCADE;

-- 4. Kalite kontrol transferlerini temizle
TRUNCATE TABLE production_to_qc_transfers RESTART IDENTITY CASCADE;

-- 5. Depoya transferleri temizle
TRUNCATE TABLE production_to_warehouse_transfers RESTART IDENTITY CASCADE;

-- 6. Üretim deposu stoklarını temizle
TRUNCATE TABLE production_inventory RESTART IDENTITY CASCADE;

-- Kontrol: Kaç kayıt kaldı?
SELECT
  'production_inventory' as table_name,
  COUNT(*) as records
FROM production_inventory
UNION ALL
SELECT
  'production_outputs' as table_name,
  COUNT(*) as records
FROM production_outputs
UNION ALL
SELECT
  'production_to_machine_transfers' as table_name,
  COUNT(*) as records
FROM production_to_machine_transfers
UNION ALL
SELECT
  'production_scrap_records' as table_name,
  COUNT(*) as records
FROM production_scrap_records;

-- Success message
SELECT '✅ Tüm üretim kayıtları temizlendi. Temiz başlayabilirsiniz.' as message;
