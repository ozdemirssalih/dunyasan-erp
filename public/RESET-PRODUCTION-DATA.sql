-- Tüm üretim, kalite kontrol ve depo verilerini sıfırla
-- UYARI: Bu işlem geri alınamaz! Tüm veriler silinecek.

-- ==================== ÜRETİM ====================
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

-- 7. Günlük üretim kayıtlarını sil
DELETE FROM machine_daily_production;

-- ==================== KALİTE KONTROL ====================
-- 8. Kalite kontrol kayıtlarını sil
DELETE FROM quality_control_records;

-- 9. Kalite kontrol stoğunu sil
DELETE FROM quality_control_inventory;

-- ==================== DEPO ====================
-- 10. Depo stok hareketlerini sil
DELETE FROM warehouse_transactions;

-- 11. Depo stoğunu sıfırla (stokları 0'la)
UPDATE warehouse_inventory SET current_stock = 0, reserved_stock = 0;

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Tüm veriler başarıyla temizlendi!';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Silinen veriler:';
    RAISE NOTICE '';
    RAISE NOTICE '🏭 ÜRETİM:';
    RAISE NOTICE '   ✓ Üretim stoğu (production_inventory)';
    RAISE NOTICE '   ✓ Üretim kayıtları (production_outputs)';
    RAISE NOTICE '   ✓ Fire kayıtları (production_scrap_records)';
    RAISE NOTICE '   ✓ Malzeme talepleri (production_material_requests)';
    RAISE NOTICE '   ✓ Depoya transferler (production_to_warehouse_transfers)';
    RAISE NOTICE '   ✓ Kalite kontrol transferleri (production_qc_transfers)';
    RAISE NOTICE '   ✓ Günlük üretim kayıtları (machine_daily_production)';
    RAISE NOTICE '';
    RAISE NOTICE '🔬 KALİTE KONTROL:';
    RAISE NOTICE '   ✓ Kalite kontrol kayıtları (quality_control_records)';
    RAISE NOTICE '   ✓ Kalite kontrol stoğu (quality_control_inventory)';
    RAISE NOTICE '';
    RAISE NOTICE '📦 DEPO:';
    RAISE NOTICE '   ✓ Depo hareketleri (warehouse_transactions)';
    RAISE NOTICE '   ✓ Depo stokları sıfırlandı (warehouse_inventory)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Not: Ürün kartları (warehouse_items) korundu.';
END $$;
