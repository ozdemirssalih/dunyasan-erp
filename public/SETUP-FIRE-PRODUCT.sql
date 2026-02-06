-- =====================================================
-- FIRE ÜRÜN SİSTEMİ
-- =====================================================
-- Fire'ı normal bir ürün gibi ele alıp depoya ekler
-- Fire çıktığında warehouse_items'a otomatik giriş yapılır
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔥 FIRE ÜRÜN SİSTEMİ KURULUYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 1: Fire kategorisi oluştur
-- =====================================================
DO $$
DECLARE
    fire_category_id UUID;
BEGIN
    -- Fire/Hurda kategorisi var mı kontrol et
    SELECT id INTO fire_category_id
    FROM warehouse_categories
    WHERE name = 'Fire/Hurda'
    LIMIT 1;

    -- Yoksa oluştur
    IF fire_category_id IS NULL THEN
        INSERT INTO warehouse_categories (name, description)
        VALUES ('Fire/Hurda', 'Üretim ve kalite kontrolden çıkan fire/hurda malzemeler')
        RETURNING id INTO fire_category_id;

        RAISE NOTICE '✅ 1/3 - Fire/Hurda kategorisi oluşturuldu';
    ELSE
        RAISE NOTICE '✅ 1/3 - Fire/Hurda kategorisi zaten var';
    END IF;
END $$;

-- =====================================================
-- ADIM 2: Fire ürünü oluştur
-- =====================================================
DO $$
DECLARE
    fire_category_id UUID;
    fire_item_id UUID;
    dunyasan_company_id UUID;
BEGIN
    -- Fire kategorisini bul
    SELECT id INTO fire_category_id
    FROM warehouse_categories
    WHERE name = 'Fire/Hurda'
    LIMIT 1;

    -- Dünyasan şirketini bul
    SELECT id INTO dunyasan_company_id
    FROM companies
    WHERE name ILIKE '%dünyasan%'
    LIMIT 1;

    -- Eğer bulunamazsa ilk şirketi al
    IF dunyasan_company_id IS NULL THEN
        SELECT id INTO dunyasan_company_id
        FROM companies
        LIMIT 1;
    END IF;

    -- Fire ürünü var mı kontrol et
    SELECT id INTO fire_item_id
    FROM warehouse_items
    WHERE code = 'FIRE-001'
    AND company_id = dunyasan_company_id
    LIMIT 1;

    -- Yoksa oluştur
    IF fire_item_id IS NULL THEN
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
            is_active
        ) VALUES (
            dunyasan_company_id,
            'FIRE-001',
            'Fire/Hurda Malzeme',
            'Üretim ve kalite kontrolden çıkan fire/hurda malzemeler',
            fire_category_id,
            'kg',
            0,
            0,
            999999,
            0,
            true
        );

        RAISE NOTICE '✅ 2/3 - Fire ürünü oluşturuldu (FIRE-001)';
    ELSE
        RAISE NOTICE '✅ 2/3 - Fire ürünü zaten var (FIRE-001)';
    END IF;
END $$;

-- =====================================================
-- ADIM 3: Fire trigger'ını güncelle
-- =====================================================
DROP TRIGGER IF EXISTS trg_record_scrap ON production_scrap_records;

CREATE OR REPLACE FUNCTION record_production_scrap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    fire_item_id UUID;
BEGIN
    -- Kaynak envanterden fire çıkar
    IF NEW.source_type = 'machine' THEN
        UPDATE machine_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id
        AND machine_id = NEW.machine_id
        AND item_id = NEW.item_id;

    ELSIF NEW.source_type = 'production' THEN
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id
        AND item_id = NEW.item_id
        AND item_type IN ('raw_material', 'finished_product');

    ELSIF NEW.source_type = 'warehouse' THEN
        UPDATE warehouse_items
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE id = NEW.item_id;
    END IF;

    -- Fire ürününü bul
    SELECT id INTO fire_item_id
    FROM warehouse_items
    WHERE code = 'FIRE-001'
    AND company_id = NEW.company_id
    LIMIT 1;

    -- Fire ürünü varsa depoya ekle
    IF fire_item_id IS NOT NULL THEN
        -- Warehouse transaction olarak giriş kaydı oluştur
        INSERT INTO warehouse_transactions (
            company_id,
            item_id,
            type,
            quantity,
            notes,
            reference_number,
            created_by
        ) VALUES (
            NEW.company_id,
            fire_item_id,
            'entry',
            NEW.quantity,
            'Fire kaydı - Sebep: ' || NEW.scrap_reason || ' - Kaynak: ' || NEW.source_type,
            'FIRE-' || NEW.id,
            NEW.recorded_by
        );

        RAISE NOTICE '🔥 Fire depoya eklendi: % kg', NEW.quantity;
    ELSE
        RAISE WARNING '⚠️  Fire ürünü bulunamadı! (FIRE-001)';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_scrap
    AFTER INSERT ON production_scrap_records
    FOR EACH ROW
    EXECUTE FUNCTION record_production_scrap();

DO $$
BEGIN
    RAISE NOTICE '✅ 3/3 - Fire trigger güncellendi';
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ FIRE ÜRÜN SİSTEMİ HAZIR!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔥 Çalışma Mantığı:';
    RAISE NOTICE '';
    RAISE NOTICE '1️⃣  Fire Kaydı Oluşturulur:';
    RAISE NOTICE '   • Kaynak envanterden fire miktarı çıkar';
    RAISE NOTICE '   • (machine/production/warehouse)';
    RAISE NOTICE '';
    RAISE NOTICE '2️⃣  Fire Otomatik Depoya Girer:';
    RAISE NOTICE '   • warehouse_transactions''a entry kaydı';
    RAISE NOTICE '   • "FIRE-001" ürününe eklenir';
    RAISE NOTICE '';
    RAISE NOTICE '3️⃣  Fire Normal Ürün Gibi:';
    RAISE NOTICE '   • Depodan çıkış yapılabilir';
    RAISE NOTICE '   • Sevkiyat edilebilir';
    RAISE NOTICE '   • Satılabilir';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık fire normal bir ürün!';
    RAISE NOTICE '========================================';
END $$;
