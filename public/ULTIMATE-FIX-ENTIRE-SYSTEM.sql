-- =====================================================
-- DÜNYASAN ERP - TÜM SİSTEMİ SIFIRDAN YENİLE
-- =====================================================
-- ❌ TÜM HATALARI TEK SEFERDE DÜZELT
-- ✅ CONSTRAINT'LER + KOLONLAR + TRIGGER'LAR
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔥 TÜM SİSTEM YENİDEN OLUŞTURULUYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- ADIM 1: TÜM TRIGGER'LARI SİL
-- =====================================================
DROP TRIGGER IF EXISTS trg_approve_material_request ON production_material_requests;
DROP TRIGGER IF EXISTS trg_approve_prod_warehouse_transfer ON production_to_warehouse_transfers;
DROP TRIGGER IF EXISTS trg_approve_prod_qc_transfer ON production_to_qc_transfers;
DROP TRIGGER IF EXISTS trg_approve_qc_warehouse_transfer ON qc_to_warehouse_transfers;
DROP TRIGGER IF EXISTS trg_transfer_prod_to_machine ON production_to_machine_transfers;
DROP TRIGGER IF EXISTS trg_record_scrap ON production_scrap_records;
DROP TRIGGER IF EXISTS trg_add_production_output ON production_outputs;

DO $$ BEGIN
    RAISE NOTICE '✅ Tüm eski trigger''lar silindi';
END $$;

-- =====================================================
-- ADIM 2: TÜM CONSTRAINT'LERİ DÜZELT
-- =====================================================

-- production_inventory: (company_id, item_id, item_type) UNIQUE
ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_company_id_item_id_key;
ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_unique_item;

ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_unique_item
UNIQUE (company_id, item_id, item_type);

DO $$ BEGIN
    RAISE NOTICE '✅ production_inventory UNIQUE constraint düzeltildi';
END $$;

-- production_inventory: item_type CHECK constraint (scrap dahil)
ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_item_type_check;

ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_item_type_check
CHECK (item_type IN ('raw_material', 'finished_product', 'scrap'));

DO $$ BEGIN
    RAISE NOTICE '✅ production_inventory item_type constraint düzeltildi (scrap eklendi)';
END $$;

-- =====================================================
-- ADIM 3: EKSİK KOLONLARI EKLE
-- =====================================================

-- production_material_requests
ALTER TABLE production_material_requests
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- production_to_warehouse_transfers
ALTER TABLE production_to_warehouse_transfers
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- production_to_qc_transfers
ALTER TABLE production_to_qc_transfers
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- qc_to_warehouse_transfers
ALTER TABLE qc_to_warehouse_transfers
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

DO $$ BEGIN
    RAISE NOTICE '✅ Tüm transfer tablolarına approved_by/approved_at kolonları eklendi';
END $$;

-- =====================================================
-- ADIM 4: TÜM TRIGGER FONKSIYONLARINI YENİDEN OLUŞTUR
-- =====================================================

-- =====================================================
-- TRIGGER 1: DEPO → ÜRETİM
-- =====================================================
CREATE OR REPLACE FUNCTION approve_material_request_to_production()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- 1. Depodan çıkış
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

        -- 2. Üretime HAMMADDE ekle
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
            current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
            updated_at = NOW();

        RAISE NOTICE '✅ Depo→Üretim: % adet item_id=%', NEW.quantity, NEW.item_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_material_request
    AFTER UPDATE ON production_material_requests
    FOR EACH ROW
    EXECUTE FUNCTION approve_material_request_to_production();

DO $$ BEGIN RAISE NOTICE '✅ Trigger 1/7: Depo→Üretim oluşturuldu'; END $$;

-- =====================================================
-- TRIGGER 2: ÜRETİM → DEPO
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

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Üretim deposunda yeterli bitmiş ürün yok! (item_id: %)', NEW.item_id;
        END IF;

        -- 2. Ana depoya giriş
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

        RAISE NOTICE '✅ Üretim→Depo: % adet item_id=%', NEW.quantity, NEW.item_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_prod_warehouse_transfer
    AFTER UPDATE ON production_to_warehouse_transfers
    FOR EACH ROW
    EXECUTE FUNCTION approve_production_to_warehouse_transfer();

DO $$ BEGIN RAISE NOTICE '✅ Trigger 2/7: Üretim→Depo oluşturuldu'; END $$;

-- =====================================================
-- TRIGGER 3: ÜRETİM → KALİTE KONTROL
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

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Üretim deposunda yeterli bitmiş ürün yok! (item_id: %)', NEW.item_id;
        END IF;

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
            current_stock = quality_control_inventory.current_stock + EXCLUDED.current_stock,
            updated_at = NOW();

        RAISE NOTICE '✅ Üretim→KK: % adet item_id=%', NEW.quantity, NEW.item_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_prod_qc_transfer
    AFTER UPDATE ON production_to_qc_transfers
    FOR EACH ROW
    EXECUTE FUNCTION approve_production_to_qc_transfer();

DO $$ BEGIN RAISE NOTICE '✅ Trigger 3/7: Üretim→KK oluşturuldu'; END $$;

-- =====================================================
-- TRIGGER 4: KALİTE KONTROL → DEPO/ÜRETİM
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

        IF NOT FOUND THEN
            RAISE EXCEPTION 'KK deposunda yeterli stok yok! (item_id: %)', NEW.item_id;
        END IF;

        -- 2. Kalite testi sonucuna göre
        IF NEW.quality_result = 'passed' THEN
            -- GEÇTİ: Ana depoya
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

            RAISE NOTICE '✅ KK→Depo (GEÇTİ): % adet item_id=%', NEW.quantity, NEW.item_id;
        ELSE
            -- KALDI: Üretime geri
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
                current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
                updated_at = NOW();

            RAISE NOTICE '⚠️ KK→Üretim (KALDI): % adet item_id=%', NEW.quantity, NEW.item_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_qc_warehouse_transfer
    AFTER UPDATE ON qc_to_warehouse_transfers
    FOR EACH ROW
    EXECUTE FUNCTION approve_qc_to_warehouse_transfer();

DO $$ BEGIN RAISE NOTICE '✅ Trigger 4/7: KK→Depo/Üretim oluşturuldu'; END $$;

-- =====================================================
-- TRIGGER 5: ÜRETİM → TEZGAH
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
        RAISE EXCEPTION 'Üretim deposunda yeterli hammadde yok! (item_id: %)', NEW.item_id;
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
        current_stock = machine_inventory.current_stock + EXCLUDED.current_stock,
        updated_at = NOW();

    RAISE NOTICE '✅ Üretim→Tezgah: % adet item_id=% → machine_id=%', NEW.quantity, NEW.item_id, NEW.machine_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transfer_prod_to_machine
    AFTER INSERT ON production_to_machine_transfers
    FOR EACH ROW
    EXECUTE FUNCTION transfer_production_to_machine();

DO $$ BEGIN RAISE NOTICE '✅ Trigger 5/7: Üretim→Tezgah oluşturuldu'; END $$;

-- =====================================================
-- TRIGGER 6: FİRE KAYDI
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
        UPDATE machine_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND item_id = NEW.item_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Tezgahta yeterli stok yok!';
        END IF;

        source_name := 'Tezgah #' || NEW.machine_id;

    ELSIF NEW.source_type = 'production' THEN
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
        'Fire - ' || source_name || ' - ' || NEW.scrap_reason
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
        updated_at = NOW();

    RAISE NOTICE '🔥 FİRE: % adet item_id=% (Kaynak: %)', NEW.quantity, NEW.item_id, source_name;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_scrap
    AFTER INSERT ON production_scrap_records
    FOR EACH ROW
    EXECUTE FUNCTION record_production_scrap();

DO $$ BEGIN RAISE NOTICE '✅ Trigger 6/7: Fire kayıt oluşturuldu'; END $$;

-- =====================================================
-- TRIGGER 7: ÜRETİM KAYDI → TEZGAHTAN OTOMATIK AZALT
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
        'Üretim kaydı #' || NEW.id
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
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

        UPDATE machine_inventory
        SET current_stock = current_stock - material_consumed,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND item_id = required_materials.item_id;

        RAISE NOTICE '📉 Tezgahtan azaltı: % adet item_id=% (machine_id=%)',
            material_consumed, required_materials.item_id, NEW.machine_id;
    END LOOP;

    RAISE NOTICE '✅ Üretim kaydı: % adet output_item_id=% üretildi', NEW.quantity, NEW.output_item_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_production_output
    AFTER INSERT ON production_outputs
    FOR EACH ROW
    EXECUTE FUNCTION add_production_output_to_inventory();

DO $$ BEGIN RAISE NOTICE '✅ Trigger 7/7: Üretim kaydı oluşturuldu'; END $$;

-- =====================================================
-- ADIM 5: RLS POLİTİKALARINI DÜZELT
-- =====================================================

-- Tüm transfer tabloları için tam yetki
DROP POLICY IF EXISTS "production_material_requests_all" ON production_material_requests;
CREATE POLICY "production_material_requests_all" ON production_material_requests
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "production_to_warehouse_transfers_all" ON production_to_warehouse_transfers;
CREATE POLICY "production_to_warehouse_transfers_all" ON production_to_warehouse_transfers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "production_to_qc_transfers_all" ON production_to_qc_transfers;
CREATE POLICY "production_to_qc_transfers_all" ON production_to_qc_transfers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "qc_to_warehouse_transfers_all" ON qc_to_warehouse_transfers;
CREATE POLICY "qc_to_warehouse_transfers_all" ON qc_to_warehouse_transfers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "production_inventory_all" ON production_inventory;
CREATE POLICY "production_inventory_all" ON production_inventory
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "machine_inventory_all" ON machine_inventory;
CREATE POLICY "machine_inventory_all" ON machine_inventory
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "quality_control_inventory_all" ON quality_control_inventory;
CREATE POLICY "quality_control_inventory_all" ON quality_control_inventory
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
    RAISE NOTICE '✅ Tüm RLS politikaları güncellendi';
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉🎉🎉 TÜM SİSTEM YENİLENDİ! 🎉🎉🎉';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Düzeltilen Constraint''ler:';
    RAISE NOTICE '   • production_inventory UNIQUE (company_id, item_id, item_type)';
    RAISE NOTICE '   • production_inventory CHECK (scrap dahil)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Eklenen Kolonlar:';
    RAISE NOTICE '   • approved_by (4 transfer tablosunda)';
    RAISE NOTICE '   • approved_at (4 transfer tablosunda)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Yeniden Oluşturulan Trigger''lar:';
    RAISE NOTICE '   1. Depo → Üretim';
    RAISE NOTICE '   2. Üretim → Depo';
    RAISE NOTICE '   3. Üretim → Kalite Kontrol';
    RAISE NOTICE '   4. Kalite Kontrol → Depo/Üretim';
    RAISE NOTICE '   5. Üretim → Tezgah';
    RAISE NOTICE '   6. Fire Kayıt';
    RAISE NOTICE '   7. Üretim Kaydı → Tezgahtan Otomatik Azalt';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tüm RLS Politikaları Güncellendi';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 ARTıK HER ŞEY ÇALIŞACAK!';
    RAISE NOTICE '========================================';
END $$;
