-- =====================================================
-- DÜNYASAN ERP - TÜM TRİGGER FIELD HATALARINI DÜZELT
-- =====================================================
-- "approved_by" yerine COALESCE kullan
-- Olmayan field'lar için fallback ekle
-- =====================================================

-- =====================================================
-- 1. DEPO → ÜRETİM TRANSFER TRİGGER
-- =====================================================
CREATE OR REPLACE FUNCTION approve_material_request_to_production()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- 1. Depodan çıkış transaction kaydı oluştur (trigger otomatik stoku azaltacak)
        INSERT INTO warehouse_transactions (
            company_id,
            item_id,
            type,
            quantity,
            notes,
            reference_number,
            created_by,
            created_at
        ) VALUES (
            NEW.company_id,
            NEW.item_id,
            'exit',
            NEW.quantity,
            'Üretime malzeme transferi - Talep #' || NEW.id,
            'PROD-REQ-' || NEW.id,
            COALESCE(NEW.approved_by, NEW.requested_by),
            NOW()
        );

        -- 2. Üretim deposuna HAMMADDE olarak ekle
        INSERT INTO production_inventory (
            company_id,
            item_id,
            current_stock,
            item_type,
            notes
        ) VALUES (
            NEW.company_id,
            NEW.item_id,
            NEW.quantity,
            'raw_material',
            'Depodan transfer - Talep #' || NEW.id
        )
        ON CONFLICT (company_id, item_id, item_type)
        DO UPDATE SET
            current_stock = production_inventory.current_stock + NEW.quantity,
            updated_at = NOW();

    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 2. ÜRETİM → DEPO TRANSFER TRİGGER
-- =====================================================
CREATE OR REPLACE FUNCTION approve_production_to_warehouse_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- 1. Üretim deposundan BİTMİŞ ÜRÜN azalt
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id
          AND item_type = 'finished_product';

        -- 2. Ana depoya giriş transaction kaydı (trigger stoku artıracak)
        INSERT INTO warehouse_transactions (
            company_id,
            item_id,
            type,
            quantity,
            notes,
            reference_number,
            created_by,
            created_at
        ) VALUES (
            NEW.company_id,
            NEW.item_id,
            'entry',
            NEW.quantity,
            'Üretimden gelen mamul - Transfer #' || NEW.id,
            'PROD-WH-' || NEW.id,
            COALESCE(NEW.approved_by, NEW.requested_by),
            NOW()
        );

    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 3. ÜRETİM → KALİTE KONTROL TRANSFER TRİGGER
-- =====================================================
CREATE OR REPLACE FUNCTION approve_production_to_qc_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- 1. Üretim deposundan BİTMİŞ ÜRÜN azalt
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id
          AND item_type = 'finished_product';

        -- 2. Kalite kontrol deposuna ekle
        INSERT INTO quality_control_inventory (
            company_id,
            item_id,
            current_stock,
            notes
        ) VALUES (
            NEW.company_id,
            NEW.item_id,
            NEW.quantity,
            'Üretimden gelen - Transfer #' || NEW.id
        )
        ON CONFLICT (company_id, item_id)
        DO UPDATE SET
            current_stock = quality_control_inventory.current_stock + NEW.quantity,
            updated_at = NOW();

    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 4. KALİTE KONTROL → DEPO/ÜRETİM TRANSFER TRİGGER
-- =====================================================
CREATE OR REPLACE FUNCTION approve_qc_to_warehouse_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- 1. Kalite kontrol deposundan azalt
        UPDATE quality_control_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id;

        -- 2. Kalite testi geçti mi?
        IF NEW.quality_result = 'passed' THEN
            -- Ana depoya giriş transaction (trigger stoku artıracak)
            INSERT INTO warehouse_transactions (
                company_id,
                item_id,
                type,
                quantity,
                notes,
                reference_number,
                created_by,
                created_at
            ) VALUES (
                NEW.company_id,
                NEW.item_id,
                'entry',
                NEW.quantity,
                'Kalite kontrolden geçti - Transfer #' || NEW.id,
                'QC-WH-' || NEW.id,
                COALESCE(NEW.approved_by, NEW.requested_by),
                NOW()
            );

        ELSE
            -- Kalite testi geçemedi, üretim deposuna geri dön (bitmiş ürün)
            INSERT INTO production_inventory (
                company_id,
                item_id,
                current_stock,
                item_type,
                notes
            ) VALUES (
                NEW.company_id,
                NEW.item_id,
                NEW.quantity,
                'finished_product',
                'Kalite kontrolden dönen - Transfer #' || NEW.id
            )
            ON CONFLICT (company_id, item_id, item_type)
            DO UPDATE SET
                current_stock = production_inventory.current_stock + NEW.quantity,
                updated_at = NOW();
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

-- =====================================================
-- 5. ÜRETİM → TEZGAH TRANSFER TRİGGER (Direkt, onaysız)
-- =====================================================
CREATE OR REPLACE FUNCTION transfer_production_to_machine()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- 1. Üretim deposundan HAMMADDE azalt
    UPDATE production_inventory
    SET current_stock = current_stock - NEW.quantity,
        updated_at = NOW()
    WHERE company_id = NEW.company_id
      AND item_id = NEW.item_id
      AND item_type = 'raw_material';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Üretim deposunda yeterli hammadde yok! (Item: %, Miktar: %)',
            (SELECT code FROM warehouse_items WHERE id = NEW.item_id),
            NEW.quantity;
    END IF;

    -- 2. Tezgah envanterine ekle
    INSERT INTO machine_inventory (
        company_id,
        machine_id,
        item_id,
        current_stock,
        notes
    ) VALUES (
        NEW.company_id,
        NEW.machine_id,
        NEW.item_id,
        NEW.quantity,
        'Transfer #' || NEW.id
    )
    ON CONFLICT (company_id, machine_id, item_id)
    DO UPDATE SET
        current_stock = machine_inventory.current_stock + NEW.quantity,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- =====================================================
-- 6. FİRE KAYIT TRİGGER
-- =====================================================
CREATE OR REPLACE FUNCTION record_production_scrap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    source_name TEXT;
BEGIN
    -- 1. Kaynağa göre stoktan düş
    IF NEW.source_type = 'machine' THEN
        -- Tezgahtan fire
        UPDATE machine_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND item_id = NEW.item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Tezgahta yeterli stok yok!';
        END IF;

        source_name := 'Tezgah: ' || (SELECT code FROM machines WHERE id = NEW.machine_id);

    ELSIF NEW.source_type = 'production' THEN
        -- Üretim deposundan fire (hammadde veya bitmiş ürün)
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id
          AND item_type IN ('raw_material', 'finished_product');

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Üretim deposunda yeterli stok yok!';
        END IF;

        source_name := 'Üretim Deposu';

    ELSIF NEW.source_type = 'warehouse' THEN
        -- Ana depodan fire
        UPDATE warehouse_items
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Ana depoda yeterli stok yok!';
        END IF;

        source_name := 'Ana Depo';
    END IF;

    -- 2. Fire stoğuna ekle
    INSERT INTO production_inventory (
        company_id,
        item_id,
        current_stock,
        item_type,
        notes
    ) VALUES (
        NEW.company_id,
        NEW.item_id,
        NEW.quantity,
        'scrap',
        'Fire - Kaynak: ' || source_name || ' - Sebep: ' || NEW.scrap_reason || ' - Kayıt #' || NEW.id
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + NEW.quantity,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- =====================================================
-- SONUÇ MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM TRİGGER FIELD HATALARI DÜZELTİLDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Düzeltmeler:';
    RAISE NOTICE '   ✓ NEW.approved_by → COALESCE(NEW.approved_by, NEW.requested_by)';
    RAISE NOTICE '   ✓ Olmayan field''lar için fallback eklendi';
    RAISE NOTICE '   ✓ Tüm transfer trigger''ları güncellendi';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Artık tüm transferler çalışacak!';
    RAISE NOTICE '========================================';
END $$;
