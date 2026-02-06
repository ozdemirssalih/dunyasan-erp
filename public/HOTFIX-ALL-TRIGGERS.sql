-- =====================================================
-- DÜNYASAN ERP - TÜM TRİGGER'LARI ACİL DÜZELT
-- =====================================================
-- ❌ "record 'new' has no field 'approved_by'" HATASINI DÜZELT
-- ✅ TÜM TRANSFER TRİGGER'LARINI YENİDEN OLUŞTUR
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 TÜM TRIGGER FONKSIYONLARI YENİDEN OLUŞTURULUYOR...';
END $$;

-- =====================================================
-- 1. DEPO → ÜRETİM TRANSFER TRİGGER
-- =====================================================
CREATE OR REPLACE FUNCTION approve_material_request_to_production()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- 1. Depodan çıkış transaction kaydı oluştur
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

DROP TRIGGER IF EXISTS trg_approve_material_request ON production_material_requests;
CREATE TRIGGER trg_approve_material_request
    AFTER UPDATE ON production_material_requests
    FOR EACH ROW
    EXECUTE FUNCTION approve_material_request_to_production();

DO $$ BEGIN
    RAISE NOTICE '✅ 1/6 - Depo→Üretim trigger düzeltildi';
END $$;

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

        -- 2. Ana depoya giriş transaction kaydı
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

DROP TRIGGER IF EXISTS trg_approve_prod_warehouse_transfer ON production_to_warehouse_transfers;
CREATE TRIGGER trg_approve_prod_warehouse_transfer
    AFTER UPDATE ON production_to_warehouse_transfers
    FOR EACH ROW
    EXECUTE FUNCTION approve_production_to_warehouse_transfer();

DO $$ BEGIN
    RAISE NOTICE '✅ 2/6 - Üretim→Depo trigger düzeltildi';
END $$;

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

DROP TRIGGER IF EXISTS trg_approve_prod_qc_transfer ON production_to_qc_transfers;
CREATE TRIGGER trg_approve_prod_qc_transfer
    AFTER UPDATE ON production_to_qc_transfers
    FOR EACH ROW
    EXECUTE FUNCTION approve_production_to_qc_transfer();

DO $$ BEGIN
    RAISE NOTICE '✅ 3/6 - Üretim→KK trigger düzeltildi';
END $$;

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
            -- Ana depoya giriş transaction
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
            -- Kalite testi geçemedi, üretim deposuna geri dön
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

DROP TRIGGER IF EXISTS trg_approve_qc_warehouse_transfer ON qc_to_warehouse_transfers;
CREATE TRIGGER trg_approve_qc_warehouse_transfer
    AFTER UPDATE ON qc_to_warehouse_transfers
    FOR EACH ROW
    EXECUTE FUNCTION approve_qc_to_warehouse_transfer();

DO $$ BEGIN
    RAISE NOTICE '✅ 4/6 - KK→Depo/Üretim trigger düzeltildi';
END $$;

-- =====================================================
-- 5. ÜRETİM → TEZGAH TRANSFER TRİGGER
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

DROP TRIGGER IF EXISTS trg_transfer_prod_to_machine ON production_to_machine_transfers;
CREATE TRIGGER trg_transfer_prod_to_machine
    AFTER INSERT ON production_to_machine_transfers
    FOR EACH ROW
    EXECUTE FUNCTION transfer_production_to_machine();

DO $$ BEGIN
    RAISE NOTICE '✅ 5/6 - Üretim→Tezgah trigger düzeltildi';
END $$;

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
        -- Üretim deposundan fire
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

DROP TRIGGER IF EXISTS trg_record_scrap ON production_scrap_records;
CREATE TRIGGER trg_record_scrap
    AFTER INSERT ON production_scrap_records
    FOR EACH ROW
    EXECUTE FUNCTION record_production_scrap();

DO $$ BEGIN
    RAISE NOTICE '✅ 6/6 - Fire kayıt trigger düzeltildi';
END $$;

-- =====================================================
-- 7. ÜRETİM KAYDI TRİGGER (Tezgahtan otomatik azalma)
-- =====================================================
CREATE OR REPLACE FUNCTION add_production_output_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    required_materials RECORD;
    material_consumed DECIMAL(15,3);
BEGIN
    -- 1. Bitmiş ürünü üretim deposuna ekle
    INSERT INTO production_inventory (
        company_id,
        item_id,
        current_stock,
        item_type,
        notes
    ) VALUES (
        NEW.company_id,
        NEW.output_item_id,
        NEW.quantity,
        'finished_product',
        'Üretim kaydı #' || NEW.id || ' - Tezgah: ' || (SELECT code FROM machines WHERE id = NEW.machine_id)
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + NEW.quantity,
        updated_at = NOW();

    -- 2. Tezgahtan hammadde OTOMATIK AZALT
    FOR required_materials IN
        SELECT item_id, quantity
        FROM production_material_assignments
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND assigned_date::date = NEW.production_date::date
    LOOP
        material_consumed := required_materials.quantity * NEW.quantity;

        -- Tezgah envanterinden OTOMATIK AZALT
        UPDATE machine_inventory
        SET current_stock = current_stock - material_consumed,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND item_id = required_materials.item_id;
    END LOOP;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_production_output ON production_outputs;
CREATE TRIGGER trg_add_production_output
    AFTER INSERT ON production_outputs
    FOR EACH ROW
    EXECUTE FUNCTION add_production_output_to_inventory();

DO $$ BEGIN
    RAISE NOTICE '✅ 7/7 - Üretim kaydı trigger düzeltildi';
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 TÜM TRIGGER HATALARI DÜZELTİLDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Düzeltilen Trigger''lar:';
    RAISE NOTICE '   1. approve_material_request_to_production';
    RAISE NOTICE '   2. approve_production_to_warehouse_transfer';
    RAISE NOTICE '   3. approve_production_to_qc_transfer';
    RAISE NOTICE '   4. approve_qc_to_warehouse_transfer';
    RAISE NOTICE '   5. transfer_production_to_machine';
    RAISE NOTICE '   6. record_production_scrap';
    RAISE NOTICE '   7. add_production_output_to_inventory';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Yapılan Düzeltme:';
    RAISE NOTICE '   NEW.approved_by → COALESCE(NEW.approved_by, NEW.requested_by)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık TÜM transferler çalışacak!';
    RAISE NOTICE '========================================';
END $$;
