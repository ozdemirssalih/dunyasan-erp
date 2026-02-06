-- =====================================================
-- ÜRETİM, KALİTE KONTROL VE TEZGAH STOKLARINI SIFIRLA
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔄 STOKLAR SIFIRLANIYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- Üretim deposu stoklarını sıfırla
    UPDATE production_inventory SET current_stock = 0, updated_at = NOW();
    RAISE NOTICE '✅ production_inventory stokları sıfırlandı';

    -- Kalite kontrol stoklarını sıfırla
    UPDATE quality_control_inventory SET current_stock = 0, updated_at = NOW();
    RAISE NOTICE '✅ quality_control_inventory stokları sıfırlandı';

    -- Tezgah stoklarını sıfırla
    UPDATE machine_inventory SET current_stock = 0, updated_at = NOW();
    RAISE NOTICE '✅ machine_inventory stokları sıfırlandı';

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM STOKLAR SIFIRLANDI!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Sıfırlanan depolar:';
    RAISE NOTICE '   • Üretim deposu';
    RAISE NOTICE '   • Kalite kontrol deposu';
    RAISE NOTICE '   • Tezgah stokları';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık sadece ana depo stoğu var!';
    RAISE NOTICE '========================================';
END $$;

-- Sonuçları göster
SELECT 'ÜRETİM STOK DURUMU:' as bilgi;
SELECT COUNT(*) as kayit_sayisi, SUM(current_stock) as toplam_stok FROM production_inventory;

SELECT 'KALİTE KONTROL STOK DURUMU:' as bilgi;
SELECT COUNT(*) as kayit_sayisi, SUM(current_stock) as toplam_stok FROM quality_control_inventory;

SELECT 'TEZGAH STOK DURUMU:' as bilgi;
SELECT COUNT(*) as kayit_sayisi, SUM(current_stock) as toplam_stok FROM machine_inventory;

SELECT 'ANA DEPO STOK DURUMU:' as bilgi;
SELECT COUNT(*) as urun_sayisi, SUM(current_stock) as toplam_stok FROM warehouse_items WHERE current_stock > 0;
