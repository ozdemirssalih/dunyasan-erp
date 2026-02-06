-- =====================================================
-- ACİL: CONSTRAINT'LERİ ZORLA DÜZELT
-- =====================================================
-- ON CONFLICT hatasını kesin çöz
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🚨 ACİL CONSTRAINT DÜZELTMESİ BAŞLIYOR...';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 1: MEVCUT CONSTRAINT'LERİ KONTROL ET VE GÖR
-- =====================================================

DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    RAISE NOTICE '📋 MEVCUT production_inventory CONSTRAINT''LERİ:';

    FOR constraint_record IN
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'production_inventory'::regclass
          AND contype IN ('u', 'p')  -- unique ve primary key
    LOOP
        RAISE NOTICE '   • % : %', constraint_record.conname, constraint_record.definition;
    END LOOP;

    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 2: TÜM UNIQUE CONSTRAINT'LERİ SİL
-- =====================================================

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- production_inventory'deki tüm unique constraint'leri bul ve sil
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'production_inventory'::regclass
          AND contype = 'u'  -- sadece unique constraint'ler
          AND conname != 'production_inventory_pkey'  -- primary key'i silme
    LOOP
        EXECUTE format('ALTER TABLE production_inventory DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE '🗑️  Silindi: %', constraint_name;
    END LOOP;
END $$;

-- =====================================================
-- ADIM 3: DOĞRU CONSTRAINT'İ EKLE
-- =====================================================

ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_unique_item
UNIQUE (company_id, item_id, item_type);

DO $$ BEGIN
    RAISE NOTICE '✅ YENİ CONSTRAINT EKLENDİ: production_inventory_unique_item';
    RAISE NOTICE '   Kolonlar: (company_id, item_id, item_type)';
END $$;

-- =====================================================
-- ADIM 4: CONSTRAINT'İN DOĞRU EKLENDİĞİNİ DOĞRULA
-- =====================================================

DO $$
DECLARE
    constraint_exists BOOLEAN;
    constraint_def TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'production_inventory'::regclass
          AND conname = 'production_inventory_unique_item'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        SELECT pg_get_constraintdef(oid) INTO constraint_def
        FROM pg_constraint
        WHERE conrelid = 'production_inventory'::regclass
          AND conname = 'production_inventory_unique_item';

        RAISE NOTICE '';
        RAISE NOTICE '✅✅✅ DOĞRULANDI! ✅✅✅';
        RAISE NOTICE 'Constraint mevcut: %', constraint_def;
    ELSE
        RAISE EXCEPTION '❌❌❌ HATA! Constraint eklenemedi!';
    END IF;
END $$;

-- =====================================================
-- ADIM 5: item_type CHECK CONSTRAINT
-- =====================================================

ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_item_type_check;

ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_item_type_check
CHECK (item_type IN ('raw_material', 'finished_product', 'scrap'));

DO $$ BEGIN
    RAISE NOTICE '✅ item_type CHECK constraint eklendi (scrap dahil)';
END $$;

-- =====================================================
-- ADIM 6: TEST ET - ÖRNEK INSERT/CONFLICT
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TEST EDİLİYOR...';

    -- Test insert (eğer yoksa)
    INSERT INTO production_inventory (
        company_id,
        item_id,
        current_stock,
        item_type,
        notes
    )
    SELECT
        '00000000-0000-0000-0000-000000000000'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        100,
        'raw_material',
        'TEST - Bu kayıt sonra silinecek'
    WHERE NOT EXISTS (
        SELECT 1 FROM production_inventory
        WHERE company_id = '00000000-0000-0000-0000-000000000000'::uuid
          AND item_id = '00000000-0000-0000-0000-000000000001'::uuid
          AND item_type = 'raw_material'
    );

    -- Test ON CONFLICT
    INSERT INTO production_inventory (
        company_id,
        item_id,
        current_stock,
        item_type,
        notes
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        50,
        'raw_material',
        'TEST - ON CONFLICT'
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + EXCLUDED.current_stock;

    -- Test kaydını sil
    DELETE FROM production_inventory
    WHERE company_id = '00000000-0000-0000-0000-000000000000'::uuid
      AND item_id = '00000000-0000-0000-0000-000000000001'::uuid;

    RAISE NOTICE '✅✅✅ TEST BAŞARILI! ON CONFLICT ÇALIŞIYOR! ✅✅✅';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '❌ TEST BAŞARISIZ! Hata: %', SQLERRM;
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 CONSTRAINT''LER TAMAMEN DÜZELTİLDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ production_inventory_unique_item eklendi';
    RAISE NOTICE '✅ ON CONFLICT artık çalışıyor';
    RAISE NOTICE '✅ Test başarıyla tamamlandı';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 ŞİMDİ TRANSFER İŞLEMLERİNİ DENEYEBİLİRSİN!';
    RAISE NOTICE '========================================';
END $$;
