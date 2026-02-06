-- =====================================================
-- DÜNYASAN ERP - TÜM STOK VE ÜRETİM VERİLERİNİ SIFIRLAMA
-- =====================================================
-- ⚠️  DİKKAT: Bu script tüm stok ve üretim verilerini SİLER!
-- ⚠️  Sadece TEST için kullanın!
-- ⚠️  Production ortamında ÇALIŞTIRMAYIN!
-- =====================================================

-- Mevcut veri sayılarını göster (silmeden önce)
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '📊 MEVCUT VERİ SAYILARI (Silmeden Önce):';
    RAISE NOTICE '========================================';
END $$;

SELECT
    'warehouse_items' as tablo,
    COUNT(*) as kayit_sayisi
FROM warehouse_items
UNION ALL
SELECT 'warehouse_transactions', COUNT(*) FROM warehouse_transactions
UNION ALL
SELECT 'production_inventory', COUNT(*) FROM production_inventory
UNION ALL
SELECT 'production_material_assignments', COUNT(*) FROM production_material_assignments
UNION ALL
SELECT 'production_outputs', COUNT(*) FROM production_outputs
UNION ALL
SELECT 'production_material_requests', COUNT(*) FROM production_material_requests
UNION ALL
SELECT 'production_to_warehouse_transfers', COUNT(*) FROM production_to_warehouse_transfers
UNION ALL
SELECT 'production_to_qc_transfers', COUNT(*) FROM production_to_qc_transfers
UNION ALL
SELECT 'quality_control_inventory', COUNT(*) FROM quality_control_inventory
UNION ALL
SELECT 'qc_to_warehouse_transfers', COUNT(*) FROM qc_to_warehouse_transfers
UNION ALL
SELECT 'purchase_requests', COUNT(*) FROM purchase_requests
ORDER BY tablo;

-- =====================================================
-- TEMİZLEME İŞLEMLERİ
-- =====================================================

-- 1. Kalite Kontrol Transferleri
DELETE FROM qc_to_warehouse_transfers;
RAISE NOTICE '✅ qc_to_warehouse_transfers temizlendi';

-- 2. Üretimden Kalite Kontrole Transferler
DELETE FROM production_to_qc_transfers;
RAISE NOTICE '✅ production_to_qc_transfers temizlendi';

-- 3. Kalite Kontrol Envanteri
DELETE FROM quality_control_inventory;
RAISE NOTICE '✅ quality_control_inventory temizlendi';

-- 4. Üretimden Depoya Transferler
DELETE FROM production_to_warehouse_transfers;
RAISE NOTICE '✅ production_to_warehouse_transfers temizlendi';

-- 5. Üretim Malzeme Talepleri
DELETE FROM production_material_requests;
RAISE NOTICE '✅ production_material_requests temizlendi';

-- 6. Üretim Çıktıları
DELETE FROM production_outputs;
RAISE NOTICE '✅ production_outputs temizlendi';

-- 7. Üretim Malzeme Atamaları
DELETE FROM production_material_assignments;
RAISE NOTICE '✅ production_material_assignments temizlendi';

-- 8. Üretim Envanteri
DELETE FROM production_inventory;
RAISE NOTICE '✅ production_inventory temizlendi';

-- 9. Satın Alma Talepleri
DELETE FROM purchase_requests;
RAISE NOTICE '✅ purchase_requests temizlendi';

-- 10. Depo İşlemleri
DELETE FROM warehouse_transactions;
RAISE NOTICE '✅ warehouse_transactions temizlendi';

-- 11. Depo Kalemleri
DELETE FROM warehouse_items;
RAISE NOTICE '✅ warehouse_items temizlendi';

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM VERİLER TEMİZLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Temizlenen Tablolar:';
    RAISE NOTICE '   ✓ warehouse_items (Stok Kalemleri)';
    RAISE NOTICE '   ✓ warehouse_transactions (Depo Hareketleri)';
    RAISE NOTICE '   ✓ production_inventory (Üretim Stoğu)';
    RAISE NOTICE '   ✓ production_material_assignments (Hammadde Atamaları)';
    RAISE NOTICE '   ✓ production_outputs (Üretim Çıktıları)';
    RAISE NOTICE '   ✓ production_material_requests (Malzeme Talepleri)';
    RAISE NOTICE '   ✓ production_to_warehouse_transfers (Üretime>Depoya)';
    RAISE NOTICE '   ✓ production_to_qc_transfers (Üretim>KK)';
    RAISE NOTICE '   ✓ quality_control_inventory (KK Stoğu)';
    RAISE NOTICE '   ✓ qc_to_warehouse_transfers (KK>Depoya)';
    RAISE NOTICE '   ✓ purchase_requests (Satın Alma Talepleri)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  NOT: Şu tablolar korundu:';
    RAISE NOTICE '   • machines (Tezgahlar)';
    RAISE NOTICE '   • projects & project_parts (Projeler)';
    RAISE NOTICE '   • profiles (Kullanıcılar)';
    RAISE NOTICE '   • companies (Şirketler)';
    RAISE NOTICE '   • warehouse_categories (Kategoriler)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık temiz bir sistemde test yapabilirsiniz!';
    RAISE NOTICE '========================================';
END $$;

-- Son durumu kontrol et
SELECT
    'warehouse_items' as tablo,
    COUNT(*) as kayit_sayisi
FROM warehouse_items
UNION ALL
SELECT 'warehouse_transactions', COUNT(*) FROM warehouse_transactions
UNION ALL
SELECT 'production_inventory', COUNT(*) FROM production_inventory
UNION ALL
SELECT 'production_material_assignments', COUNT(*) FROM production_material_assignments
UNION ALL
SELECT 'production_outputs', COUNT(*) FROM production_outputs
UNION ALL
SELECT 'production_material_requests', COUNT(*) FROM production_material_requests
UNION ALL
SELECT 'production_to_warehouse_transfers', COUNT(*) FROM production_to_warehouse_transfers
UNION ALL
SELECT 'production_to_qc_transfers', COUNT(*) FROM production_to_qc_transfers
UNION ALL
SELECT 'quality_control_inventory', COUNT(*) FROM quality_control_inventory
UNION ALL
SELECT 'qc_to_warehouse_transfers', COUNT(*) FROM qc_to_warehouse_transfers
UNION ALL
SELECT 'purchase_requests', COUNT(*) FROM purchase_requests
ORDER BY tablo;
