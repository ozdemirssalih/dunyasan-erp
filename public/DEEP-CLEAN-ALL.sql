-- =====================================================
-- DERİN TEMİZLİK - TÜM GEÇMİŞ + STOKLAR
-- =====================================================
-- Tüm üretim/kalite/tezgah verilerini tamamen siler
-- SADECE ana depo ürünleri ve tanımları kalır
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🧹 DERİN TEMİZLİK BAŞLIYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 1: TÜM VERİLERİ SİL (Foreign Key Sırasına Göre)
-- =====================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    RAISE NOTICE '🗑️  Tüm veriler siliniyor...';
    RAISE NOTICE '';

    -- 1. Production outputs (en bağımlı)
    DELETE FROM production_outputs;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_outputs: % kayıt', deleted_count;

    -- 2. Scrap records
    DELETE FROM production_scrap_records;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_scrap_records: % kayıt', deleted_count;

    -- 3. Production to machine transfers
    DELETE FROM production_to_machine_transfers;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_to_machine_transfers: % kayıt', deleted_count;

    -- 4. Machine inventory - KAYITLARI SİL
    DELETE FROM machine_inventory;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ machine_inventory: % kayıt', deleted_count;

    -- 5. QC to warehouse transfers
    DELETE FROM qc_to_warehouse_transfers;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ qc_to_warehouse_transfers: % kayıt', deleted_count;

    -- 6. Production to QC transfers
    DELETE FROM production_to_qc_transfers;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_to_qc_transfers: % kayıt', deleted_count;

    -- 7. Production to warehouse transfers
    DELETE FROM production_to_warehouse_transfers;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_to_warehouse_transfers: % kayıt', deleted_count;

    -- 8. Production material requests
    DELETE FROM production_material_requests;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_material_requests: % kayıt', deleted_count;

    -- 9. Production material assignments
    DELETE FROM production_material_assignments;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_material_assignments: % kayıt', deleted_count;

    -- 10. Quality control inventory - KAYITLARI SİL
    DELETE FROM quality_control_inventory;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ quality_control_inventory: % kayıt', deleted_count;

    -- 11. Production inventory - KAYITLARI SİL
    DELETE FROM production_inventory;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ production_inventory: % kayıt', deleted_count;

    -- 12. Purchase requests
    DELETE FROM purchase_requests;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ purchase_requests: % kayıt', deleted_count;

    -- 13. Warehouse transactions
    DELETE FROM warehouse_transactions;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '   ✓ warehouse_transactions: % kayıt', deleted_count;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Tüm veriler silindi!';
END $$;

-- =====================================================
-- ADIM 2: DEPO STOKLARINI SIFIRLA (ürünleri koruyarak)
-- =====================================================
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Depo stokları sıfırlanıyor...';

    UPDATE warehouse_items SET current_stock = 0, updated_at = NOW();
    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RAISE NOTICE '   ✓ % ürünün stoğu sıfırlandı', updated_count;
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 3: DOĞRULAMA
-- =====================================================
DO $$
DECLARE
    total_records INTEGER := 0;
    stock_sum DECIMAL := 0;
BEGIN
    RAISE NOTICE '📊 Temizlik sonrası kontrol...';
    RAISE NOTICE '';

    -- Tüm tabloların kayıt sayısını topla
    SELECT
        (SELECT COUNT(*) FROM production_outputs) +
        (SELECT COUNT(*) FROM production_scrap_records) +
        (SELECT COUNT(*) FROM production_to_machine_transfers) +
        (SELECT COUNT(*) FROM machine_inventory) +
        (SELECT COUNT(*) FROM qc_to_warehouse_transfers) +
        (SELECT COUNT(*) FROM production_to_qc_transfers) +
        (SELECT COUNT(*) FROM production_to_warehouse_transfers) +
        (SELECT COUNT(*) FROM production_material_requests) +
        (SELECT COUNT(*) FROM production_material_assignments) +
        (SELECT COUNT(*) FROM quality_control_inventory) +
        (SELECT COUNT(*) FROM production_inventory) +
        (SELECT COUNT(*) FROM purchase_requests) +
        (SELECT COUNT(*) FROM warehouse_transactions)
    INTO total_records;

    -- Toplam stok
    SELECT COALESCE(SUM(current_stock), 0) INTO stock_sum FROM warehouse_items;

    IF total_records > 0 THEN
        RAISE WARNING '⚠️  UYARI: Hala % kayıt var, tam temizlenemedi!', total_records;
    ELSE
        RAISE NOTICE '✅ Tüm tablolar temiz (0 kayıt)';
    END IF;

    IF stock_sum > 0 THEN
        RAISE NOTICE '⚠️  Depo stokları: % (sıfırlanmadı, manuel eklenmişse normal)', stock_sum;
    ELSE
        RAISE NOTICE '✅ Depo stokları: 0';
    END IF;

    RAISE NOTICE '';
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================

-- Tablo durumlarını göster
SELECT 'TABLO DURUMLARI:' as bilgi;

SELECT
    'production_outputs' as tablo,
    COUNT(*) as kayit_sayisi
FROM production_outputs
UNION ALL
SELECT 'production_inventory', COUNT(*) FROM production_inventory
UNION ALL
SELECT 'quality_control_inventory', COUNT(*) FROM quality_control_inventory
UNION ALL
SELECT 'machine_inventory', COUNT(*) FROM machine_inventory
UNION ALL
SELECT 'production_to_qc_transfers', COUNT(*) FROM production_to_qc_transfers
UNION ALL
SELECT 'qc_to_warehouse_transfers', COUNT(*) FROM qc_to_warehouse_transfers
UNION ALL
SELECT 'production_material_requests', COUNT(*) FROM production_material_requests
UNION ALL
SELECT 'warehouse_transactions', COUNT(*) FROM warehouse_transactions
ORDER BY tablo;

-- Depo durumu
SELECT 'DEPO DURUMU:' as bilgi;

SELECT
    COUNT(*) as toplam_urun,
    COUNT(CASE WHEN current_stock > 0 THEN 1 END) as stoklu_urun,
    SUM(current_stock) as toplam_stok
FROM warehouse_items;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ DERİN TEMİZLİK TAMAMLANDI!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🗑️  Silinen:';
    RAISE NOTICE '   • Tüm üretim kayıtları';
    RAISE NOTICE '   • Tüm transfer geçmişleri';
    RAISE NOTICE '   • Tüm kalite kontrol kayıtları';
    RAISE NOTICE '   • Tüm tezgah kayıtları';
    RAISE NOTICE '   • Tüm envanter kayıtları';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Korunan:';
    RAISE NOTICE '   • Ürün tanımları (warehouse_items)';
    RAISE NOTICE '   • Tezgahlar (machines)';
    RAISE NOTICE '   • Kullanıcılar (profiles)';
    RAISE NOTICE '   • Şirketler (companies)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Sistem temiz, sıfırdan başlayabilirsin!';
    RAISE NOTICE '========================================';
END $$;
