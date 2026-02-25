-- Tüm üretim verilerini sıfırla
-- UYARI: Bu işlem geri alınamaz! Tüm üretim, stok ve transfer kayıtları silinecek.

-- 1. Üretim stoğunu temizle
DELETE FROM production_inventory;

-- 2. Üretim kayıtlarını sil
DELETE FROM production_outputs;

-- 3. Fire kayıtlarını sil
DELETE FROM production_scrap_records;

-- 4. Malzeme taleplerini sil
DELETE FROM production_material_requests;

-- 5. Depoya transfer kayıtlarını sil
DELETE FROM production_to_warehouse_transfers;

-- 6. Kalite kontrol transfer kayıtlarını sil
DELETE FROM production_qc_transfers;

-- 7. Günlük üretim kayıtlarını sil (varsa)
DELETE FROM machine_daily_production;

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Tüm üretim verileri başarıyla temizlendi!';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Silinen veriler:';
    RAISE NOTICE '   ✓ Üretim stoğu (production_inventory)';
    RAISE NOTICE '   ✓ Üretim kayıtları (production_outputs)';
    RAISE NOTICE '   ✓ Fire kayıtları (production_scrap_records)';
    RAISE NOTICE '   ✓ Malzeme talepleri (production_material_requests)';
    RAISE NOTICE '   ✓ Depoya transferler (production_to_warehouse_transfers)';
    RAISE NOTICE '   ✓ Kalite kontrol transferleri (production_qc_transfers)';
    RAISE NOTICE '   ✓ Günlük üretim kayıtları (machine_daily_production)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Not: Ana depo (warehouse) verileri etkilenmedi.';
END $$;
