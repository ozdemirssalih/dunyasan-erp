-- =====================================================
-- DÜNYASAN ERP - TÜM STOK VE TRANSFER VERİLERİNİ SIFIRLA
-- =====================================================
-- ⚠️  DİKKAT: Bu script tüm stok ve transfer verilerini SİLER!
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
    'warehouse_items (stok)' as tablo,
    COALESCE(SUM(current_stock), 0) as kayit_sayisi
FROM warehouse_items
UNION ALL
SELECT 'warehouse_transactions', COUNT(*)::decimal FROM warehouse_transactions
UNION ALL
SELECT 'production_inventory', COUNT(*)::decimal FROM production_inventory
UNION ALL
SELECT 'production_material_requests', COUNT(*)::decimal FROM production_material_requests
UNION ALL
SELECT 'production_material_assignments', COUNT(*)::decimal FROM production_material_assignments
UNION ALL
SELECT 'production_outputs', COUNT(*)::decimal FROM production_outputs
UNION ALL
SELECT 'production_to_warehouse_transfers', COUNT(*)::decimal FROM production_to_warehouse_transfers
UNION ALL
SELECT 'production_to_qc_transfers', COUNT(*)::decimal FROM production_to_qc_transfers
UNION ALL
SELECT 'quality_control_inventory', COUNT(*)::decimal FROM quality_control_inventory
UNION ALL
SELECT 'qc_to_warehouse_transfers', COUNT(*)::decimal FROM qc_to_warehouse_transfers
UNION ALL
SELECT 'purchase_requests', COUNT(*)::decimal FROM purchase_requests
ORDER BY tablo;

-- =====================================================
-- TEMİZLEME İŞLEMLERİ - DOĞRU SIRADA!
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Temizleme başlıyor (Foreign key sırasına göre)...';
    RAISE NOTICE '';

    -- 1. ÜRETİM ÇIKTILARI (en bağımlı tablo - önce bu silinmeli!)
    DELETE FROM production_outputs;
    RAISE NOTICE '✅ production_outputs temizlendi';

    -- 2. Fire kayıtları (eğer varsa)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'production_scrap_records') THEN
        EXECUTE 'DELETE FROM production_scrap_records';
        RAISE NOTICE '✅ production_scrap_records temizlendi';
    END IF;

    -- 3. Tezgah transferleri (eğer varsa)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'production_to_machine_transfers') THEN
        EXECUTE 'DELETE FROM production_to_machine_transfers';
        RAISE NOTICE '✅ production_to_machine_transfers temizlendi';
    END IF;

    -- 4. Tezgah envanteri (eğer varsa)
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'machine_inventory') THEN
        EXECUTE 'DELETE FROM machine_inventory';
        RAISE NOTICE '✅ machine_inventory temizlendi';
    END IF;

    -- 5. Kalite Kontrol Transferleri
    DELETE FROM qc_to_warehouse_transfers;
    RAISE NOTICE '✅ qc_to_warehouse_transfers temizlendi';

    -- 6. Üretimden Kalite Kontrole Transferler
    DELETE FROM production_to_qc_transfers;
    RAISE NOTICE '✅ production_to_qc_transfers temizlendi';

    -- 7. Kalite Kontrol Envanteri
    DELETE FROM quality_control_inventory;
    RAISE NOTICE '✅ quality_control_inventory temizlendi';

    -- 8. Üretimden Depoya Transferler
    DELETE FROM production_to_warehouse_transfers;
    RAISE NOTICE '✅ production_to_warehouse_transfers temizlendi';

    -- 9. Üretim Malzeme Talepleri
    DELETE FROM production_material_requests;
    RAISE NOTICE '✅ production_material_requests temizlendi';

    -- 10. Üretim Malzeme Atamaları
    DELETE FROM production_material_assignments;
    RAISE NOTICE '✅ production_material_assignments temizlendi';

    -- 11. Üretim Envanteri
    DELETE FROM production_inventory;
    RAISE NOTICE '✅ production_inventory temizlendi';

    -- 12. Satın Alma Talepleri
    DELETE FROM purchase_requests;
    RAISE NOTICE '✅ purchase_requests temizlendi';

    -- 13. Depo İşlemleri
    DELETE FROM warehouse_transactions;
    RAISE NOTICE '✅ warehouse_transactions temizlendi';

    -- 14. Depo Kalemleri - SADECE STOKLARI SIFIRLA (ürünleri silme)
    UPDATE warehouse_items SET current_stock = 0, updated_at = NOW();
    RAISE NOTICE '✅ warehouse_items stokları sıfırlandı';

    RAISE NOTICE '';
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM STOK VE TRANSFER VERİLERİ TEMİZLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Temizlenen Tablolar:';
    RAISE NOTICE '   ✓ warehouse_items (stoklar 0, ürünler korundu)';
    RAISE NOTICE '   ✓ warehouse_transactions';
    RAISE NOTICE '   ✓ production_inventory';
    RAISE NOTICE '   ✓ production_material_assignments';
    RAISE NOTICE '   ✓ production_outputs';
    RAISE NOTICE '   ✓ production_material_requests';
    RAISE NOTICE '   ✓ production_to_warehouse_transfers';
    RAISE NOTICE '   ✓ production_to_qc_transfers';
    RAISE NOTICE '   ✓ quality_control_inventory';
    RAISE NOTICE '   ✓ qc_to_warehouse_transfers';
    RAISE NOTICE '   ✓ purchase_requests';
    RAISE NOTICE '   ✓ machine_inventory (eğer varsa)';
    RAISE NOTICE '   ✓ production_to_machine_transfers (eğer varsa)';
    RAISE NOTICE '   ✓ production_scrap_records (eğer varsa)';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  NOT: Şu tablolar korundu:';
    RAISE NOTICE '   • warehouse_items (ürün tanımları)';
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
    'warehouse_items (stok)' as tablo,
    COALESCE(SUM(current_stock), 0) as toplam_stok
FROM warehouse_items
UNION ALL
SELECT 'warehouse_transactions', COUNT(*)::decimal FROM warehouse_transactions
UNION ALL
SELECT 'production_inventory', COUNT(*)::decimal FROM production_inventory
UNION ALL
SELECT 'production_material_assignments', COUNT(*)::decimal FROM production_material_assignments
UNION ALL
SELECT 'production_outputs', COUNT(*)::decimal FROM production_outputs
UNION ALL
SELECT 'production_material_requests', COUNT(*)::decimal FROM production_material_requests
UNION ALL
SELECT 'production_to_warehouse_transfers', COUNT(*)::decimal FROM production_to_warehouse_transfers
UNION ALL
SELECT 'production_to_qc_transfers', COUNT(*)::decimal FROM production_to_qc_transfers
UNION ALL
SELECT 'quality_control_inventory', COUNT(*)::decimal FROM quality_control_inventory
UNION ALL
SELECT 'qc_to_warehouse_transfers', COUNT(*)::decimal FROM qc_to_warehouse_transfers
UNION ALL
SELECT 'purchase_requests', COUNT(*)::decimal FROM purchase_requests
ORDER BY tablo;
