-- ============================================
-- TÜM MUHASEBE VERİLERİNİ TEMİZLE
-- ============================================
-- Tarih: 2026-03-24
-- Amaç: Tüm eski cari, kasa ve çek kayıtlarını sil
-- ⚠️ DİKKAT: Bu işlem GERİ ALINAMAZ!
-- ============================================

-- 1. KASA İŞLEMLERİNİ TEMİZLE
DELETE FROM cash_transactions;

-- 2. CARİ HESAP İŞLEMLERİNİ TEMİZLE
DELETE FROM current_account_transactions;

-- 3. ÇEKLERİ TEMİZLE
DELETE FROM checks;

-- 4. KONTROL ET
DO $$
DECLARE
    cash_count INT;
    current_count INT;
    check_count INT;
BEGIN
    SELECT COUNT(*) INTO cash_count FROM cash_transactions;
    SELECT COUNT(*) INTO current_count FROM current_account_transactions;
    SELECT COUNT(*) INTO check_count FROM checks;

    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM MUHASEBE VERİLERİ TEMİZLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Kalan Kayıt Sayıları:';
    RAISE NOTICE '  - Kasa İşlemleri: % kayıt', cash_count;
    RAISE NOTICE '  - Cari İşlemler: % kayıt', current_count;
    RAISE NOTICE '  - Çekler: % kayıt', check_count;
    RAISE NOTICE '';

    IF cash_count = 0 AND current_count = 0 AND check_count = 0 THEN
        RAISE NOTICE '🎉 Tüm veriler başarıyla silindi!';
        RAISE NOTICE '📌 Artık yeni migration''ı çalıştırabilirsiniz.';
    ELSE
        RAISE WARNING '⚠️ Bazı kayıtlar silinemedi!';
    END IF;

    RAISE NOTICE '========================================';
END $$;
