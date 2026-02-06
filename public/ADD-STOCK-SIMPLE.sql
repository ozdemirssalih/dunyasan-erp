-- =====================================================
-- BASIT STOK EKLEME
-- =====================================================
-- Mevcut ürünlere stok ekler
-- =====================================================

DO $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📦 STOKLARA DEĞER EKLENİYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- İlk company ve user'ı al
    SELECT id INTO v_company_id FROM companies ORDER BY created_at LIMIT 1;
    SELECT id INTO v_user_id FROM profiles ORDER BY created_at LIMIT 1;

    IF v_company_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'Company veya User bulunamadı!';
    END IF;

    -- Mevcut ürünlere stok ekle (ilk 10 ürün)
    UPDATE warehouse_items
    SET current_stock = CASE
            WHEN current_stock = 0 THEN 1000
            ELSE current_stock + 1000
        END,
        updated_at = NOW()
    WHERE id IN (
        SELECT id FROM warehouse_items
        ORDER BY created_at
        LIMIT 10
    );

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RAISE NOTICE '✅ % ürünün stoğu güncellendi (her birine 1000 birim eklendi)', v_updated_count;

    -- Transaction kayıtları oluştur
    INSERT INTO warehouse_transactions (
        company_id,
        item_id,
        type,
        quantity,
        notes,
        reference_number,
        created_by,
        created_at
    )
    SELECT
        company_id,
        id,
        'entry',
        1000,
        'Test stok girişi',
        'TEST-' || id,
        v_user_id,
        NOW()
    FROM warehouse_items
    ORDER BY created_at
    LIMIT 10;

    RAISE NOTICE '✅ Transaction kayıtları oluşturuldu';
    RAISE NOTICE '';
END $$;

-- Sonuçları göster
SELECT
    'STOKLU ÜRÜNLER:' as bilgi;

SELECT
    code,
    name,
    current_stock,
    unit
FROM warehouse_items
WHERE current_stock > 0
ORDER BY current_stock DESC
LIMIT 10;

SELECT
    'TOPLAM:' as bilgi;

SELECT
    COUNT(*) as toplam_urun,
    COUNT(CASE WHEN current_stock > 0 THEN 1 END) as stoklu_urun,
    SUM(current_stock) as toplam_stok
FROM warehouse_items;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ STOKLAR GÜNCELLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Depo sayfasını yenile ve kontrol et!';
    RAISE NOTICE '========================================';
END $$;
