-- =====================================================
-- DÜNYASAN ERP - TÜM VERİLERİ SIFIRLA
-- =====================================================
-- ⚠️  DİKKAT: Bu script tüm stok ve transfer verilerini SİLER!
-- ⚠️  Sadece TEST için kullanın!
-- =====================================================

\timing on

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '⚠️  TÜM VERİLER SİLİNİYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- Silme işlemi öncesi veri sayılarını göster
SELECT 'ÖNCEK İ DURUM:' as durum;
SELECT
    'warehouse_items (toplam stok)' as tablo,
    COALESCE(SUM(current_stock), 0) as kayit_sayisi
FROM warehouse_items
UNION ALL
SELECT 'warehouse_transactions', COUNT(*)::decimal FROM warehouse_transactions
UNION ALL
SELECT 'production_inventory', COUNT(*)::decimal FROM production_inventory
UNION ALL
SELECT 'production_outputs', COUNT(*)::decimal FROM production_outputs
UNION ALL
SELECT 'machine_inventory', COUNT(*)::decimal FROM machine_inventory
UNION ALL
SELECT 'production_scrap_records', COUNT(*)::decimal FROM production_scrap_records
UNION ALL
SELECT 'quality_control_inventory', COUNT(*)::decimal FROM quality_control_inventory
ORDER BY tablo;

-- Foreign key sırasına göre silme
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  Silme işlemi başlıyor...';
    RAISE NOTICE '';

    -- 1. En bağımlı tablolar (önce bunlar silinmeli)
    DELETE FROM production_outputs;
    RAISE NOTICE '   ✓ production_outputs';

    DELETE FROM production_scrap_records;
    RAISE NOTICE '   ✓ production_scrap_records';

    DELETE FROM production_to_machine_transfers;
    RAISE NOTICE '   ✓ production_to_machine_transfers';

    DELETE FROM machine_inventory;
    RAISE NOTICE '   ✓ machine_inventory';

    -- 2. Transfer tabloları
    DELETE FROM qc_to_warehouse_transfers;
    RAISE NOTICE '   ✓ qc_to_warehouse_transfers';

    DELETE FROM production_to_qc_transfers;
    RAISE NOTICE '   ✓ production_to_qc_transfers';

    DELETE FROM production_to_warehouse_transfers;
    RAISE NOTICE '   ✓ production_to_warehouse_transfers';

    DELETE FROM production_material_requests;
    RAISE NOTICE '   ✓ production_material_requests';

    DELETE FROM production_material_assignments;
    RAISE NOTICE '   ✓ production_material_assignments';

    -- 3. Envanter tabloları
    DELETE FROM quality_control_inventory;
    RAISE NOTICE '   ✓ quality_control_inventory';

    DELETE FROM production_inventory;
    RAISE NOTICE '   ✓ production_inventory';

    -- 4. Satın alma
    DELETE FROM purchase_requests;
    RAISE NOTICE '   ✓ purchase_requests';

    -- 5. Depo işlemleri
    DELETE FROM warehouse_transactions;
    RAISE NOTICE '   ✓ warehouse_transactions';

    -- 6. Depo kalemleri - SADECE STOKLARI SIFIRLA
    UPDATE warehouse_items SET current_stock = 0, updated_at = NOW();
    RAISE NOTICE '   ✓ warehouse_items (stoklar sıfırlandı, ürünler korundu)';

    RAISE NOTICE '';
    RAISE NOTICE '✅ Tüm veriler temizlendi!';
END $$;

-- Sonuç durumu göster
SELECT 'SONRAKI DURUM:' as durum;
SELECT
    'warehouse_items (toplam stok)' as tablo,
    COALESCE(SUM(current_stock), 0) as toplam_stok
FROM warehouse_items
UNION ALL
SELECT 'warehouse_transactions', COUNT(*)::decimal FROM warehouse_transactions
UNION ALL
SELECT 'production_inventory', COUNT(*)::decimal FROM production_inventory
UNION ALL
SELECT 'production_outputs', COUNT(*)::decimal FROM production_outputs
UNION ALL
SELECT 'machine_inventory', COUNT(*)::decimal FROM machine_inventory
UNION ALL
SELECT 'production_scrap_records', COUNT(*)::decimal FROM production_scrap_records
UNION ALL
SELECT 'quality_control_inventory', COUNT(*)::decimal FROM quality_control_inventory
ORDER BY tablo;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ VERİLER TEMİZLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Temizlenen:';
    RAISE NOTICE '   • Tüm transfer kayıtları';
    RAISE NOTICE '   • Tüm envanter kayıtları';
    RAISE NOTICE '   • Tüm üretim kayıtları';
    RAISE NOTICE '   • Depo stokları (ürün tanımları korundu)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Korunan:';
    RAISE NOTICE '   • warehouse_items (ürün tanımları)';
    RAISE NOTICE '   • machines (tezgahlar)';
    RAISE NOTICE '   • profiles (kullanıcılar)';
    RAISE NOTICE '   • companies (şirketler)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Temiz sistemde test yapabilirsiniz!';
    RAISE NOTICE '========================================';
END $$;

\timing off
