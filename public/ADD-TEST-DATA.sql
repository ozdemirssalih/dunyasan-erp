-- =====================================================
-- TEST VERİSİ EKLE
-- =====================================================
-- Depoya stok ekler, sistemi test etmek için
-- =====================================================

DO $$
DECLARE
    v_company_id UUID;
    v_user_id UUID;
    v_category_id UUID;
    v_item1_id UUID;
    v_item2_id UUID;
    v_item3_id UUID;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📦 TEST VERİSİ EKLENİYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- İlk company ve user'ı al
    SELECT id INTO v_company_id FROM companies ORDER BY created_at LIMIT 1;
    SELECT id INTO v_user_id FROM profiles ORDER BY created_at LIMIT 1;

    IF v_company_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'Önce company ve user oluşturmalısın!';
    END IF;

    RAISE NOTICE 'Company ID: %', v_company_id;
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE '';

    -- Kategori var mı kontrol et
    SELECT id INTO v_category_id FROM warehouse_categories WHERE company_id = v_company_id LIMIT 1;

    IF v_category_id IS NULL THEN
        -- Kategori oluştur
        INSERT INTO warehouse_categories (company_id, name, description, created_by)
        VALUES (v_company_id, 'Hammaddeler', 'Test kategorisi', v_user_id)
        RETURNING id INTO v_category_id;

        RAISE NOTICE 'Kategori oluşturuldu: %', v_category_id;
    END IF;

    -- Ürün 1: Çelik Levha
    INSERT INTO warehouse_items (
        company_id,
        code,
        name,
        description,
        category_id,
        unit,
        current_stock,
        min_stock,
        max_stock,
        unit_price,
        currency,
        storage_location,
        created_by
    ) VALUES (
        v_company_id,
        'CLK-001',
        'Çelik Levha 5mm',
        'Yüksek kalite çelik levha',
        v_category_id,
        'kg',
        1000,
        100,
        2000,
        25.50,
        'TRY',
        'Depo A-1',
        v_user_id
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET current_stock = 1000,
        updated_at = NOW()
    RETURNING id INTO v_item1_id;

    RAISE NOTICE '✅ Ürün 1: Çelik Levha (1000 kg)';

    -- Ürün 2: Alüminyum Çubuk
    INSERT INTO warehouse_items (
        company_id,
        code,
        name,
        description,
        category_id,
        unit,
        current_stock,
        min_stock,
        max_stock,
        unit_price,
        currency,
        storage_location,
        created_by
    ) VALUES (
        v_company_id,
        'ALM-001',
        'Alüminyum Çubuk 20mm',
        '6061 alüminyum alaşım',
        v_category_id,
        'adet',
        500,
        50,
        1000,
        45.00,
        'TRY',
        'Depo A-2',
        v_user_id
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET current_stock = 500,
        updated_at = NOW()
    RETURNING id INTO v_item2_id;

    RAISE NOTICE '✅ Ürün 2: Alüminyum Çubuk (500 adet)';

    -- Ürün 3: Plastik Granül
    INSERT INTO warehouse_items (
        company_id,
        code,
        name,
        description,
        category_id,
        unit,
        current_stock,
        min_stock,
        max_stock,
        unit_price,
        currency,
        storage_location,
        created_by
    ) VALUES (
        v_company_id,
        'PLS-001',
        'Plastik Granül ABS',
        'ABS plastik hammadde',
        v_category_id,
        'kg',
        750,
        100,
        1500,
        18.75,
        'TRY',
        'Depo B-1',
        v_user_id
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET current_stock = 750,
        updated_at = NOW()
    RETURNING id INTO v_item3_id;

    RAISE NOTICE '✅ Ürün 3: Plastik Granül (750 kg)';

    -- Giriş transaction kayıtları oluştur
    INSERT INTO warehouse_transactions (
        company_id,
        item_id,
        type,
        quantity,
        notes,
        reference_number,
        created_by,
        created_at
    ) VALUES
        (v_company_id, v_item1_id, 'entry', 1000, 'İlk stok girişi', 'INIT-001', v_user_id, NOW()),
        (v_company_id, v_item2_id, 'entry', 500, 'İlk stok girişi', 'INIT-002', v_user_id, NOW()),
        (v_company_id, v_item3_id, 'entry', 750, 'İlk stok girişi', 'INIT-003', v_user_id, NOW());

    RAISE NOTICE '✅ Transaction kayıtları oluşturuldu';
    RAISE NOTICE '';
END $$;

-- Sonuçları göster
SELECT
    'TEST VERİSİ SONUÇLARI:' as bilgi;

SELECT
    code,
    name,
    current_stock,
    unit,
    storage_location
FROM warehouse_items
WHERE current_stock > 0
ORDER BY code;

SELECT
    COUNT(*) as toplam_urun,
    SUM(current_stock) as toplam_stok
FROM warehouse_items;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TEST VERİSİ EKLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 3 ürün eklendi:';
    RAISE NOTICE '   • Çelik Levha: 1000 kg';
    RAISE NOTICE '   • Alüminyum Çubuk: 500 adet';
    RAISE NOTICE '   • Plastik Granül: 750 kg';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık depo sayfasında stokları görebilirsin!';
    RAISE NOTICE '========================================';
END $$;
