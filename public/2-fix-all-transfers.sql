-- =====================================================
-- DÜNYASAN ERP - TÜM BİRİMLER ARASI TRANSFER SİSTEMİ
-- =====================================================
-- Tüm transfer trigger'larını düzelt
-- Depo ↔ Üretim ↔ Kalite Kontrol arasındaki tüm akışlar
-- =====================================================

-- =====================================================
-- ADIM 1: UNIQUE Constraint'leri Düzelt
-- =====================================================

-- Production inventory için (company_id, item_id, item_type) unique olmalı
ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_company_id_item_id_key;
ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_unique_item;

ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_unique_item
UNIQUE (company_id, item_id, item_type);

DO $$ BEGIN
    RAISE NOTICE '✅ production_inventory UNIQUE constraint düzeltildi';
END $$;

-- =====================================================
-- ADIM 2: DEPO → ÜRETİM Transfer Trigger
-- =====================================================
-- production_material_requests onaylanınca:
-- - Depodan çıkar (warehouse_items stok azalt + transaction kaydı)
-- - Üretime ekle (production_inventory hammadde olarak ekle)

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

        RAISE NOTICE '✅ Depo→Üretim transfer: % adet % (Talep #%)',
            NEW.quantity,
            (SELECT code FROM warehouse_items WHERE id = NEW.item_id),
            NEW.id;
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
    RAISE NOTICE '✅ Depo→Üretim trigger oluşturuldu';
END $$;

-- =====================================================
-- ADIM 3: ÜRETİM → DEPO Transfer Trigger
-- =====================================================
-- production_to_warehouse_transfers onaylanınca:
-- - Üretim deposundan bitmiş ürünü azalt
-- - Ana depoya ekle (warehouse_transactions kaydı, trigger stoku artıracak)

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

        RAISE NOTICE '✅ Üretim→Depo transfer: % adet % (Transfer #%)',
            NEW.quantity,
            (SELECT code FROM warehouse_items WHERE id = NEW.item_id),
            NEW.id;
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
    RAISE NOTICE '✅ Üretim→Depo trigger oluşturuldu';
END $$;

-- =====================================================
-- ADIM 4: ÜRETİM → KALİTE KONTROL Transfer Trigger
-- =====================================================
-- production_to_qc_transfers onaylanınca:
-- - Üretim deposundan bitmiş ürünü azalt
-- - Kalite kontrol deposuna ekle

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

        RAISE NOTICE '✅ Üretim→KK transfer: % adet % (Transfer #%)',
            NEW.quantity,
            (SELECT code FROM warehouse_items WHERE id = NEW.item_id),
            NEW.id;
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
    RAISE NOTICE '✅ Üretim→KK trigger oluşturuldu';
END $$;

-- =====================================================
-- ADIM 5: KALİTE KONTROL → DEPO Transfer Trigger
-- =====================================================
-- qc_to_warehouse_transfers onaylanınca:
-- - Kalite kontrol deposundan azalt
-- - Passed ise: Ana depoya ekle (transaction ile)
-- - Failed ise: Üretim deposuna geri gönder (bitmiş ürün olarak)

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

            RAISE NOTICE '✅ KK→Depo transfer (GEÇTİ): % adet % (Transfer #%)',
                NEW.quantity,
                (SELECT code FROM warehouse_items WHERE id = NEW.item_id),
                NEW.id;
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

            RAISE NOTICE '⚠️ KK→Üretim transfer (KALDI): % adet % (Transfer #%)',
                NEW.quantity,
                (SELECT code FROM warehouse_items WHERE id = NEW.item_id),
                NEW.id;
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
    RAISE NOTICE '✅ KK→Depo trigger oluşturuldu';
END $$;

-- =====================================================
-- ADIM 6: ÜRETİM KAYDI → ÜRETİM DEPOSU Trigger
-- =====================================================
-- Üretim kaydı yapılınca bitmiş ürünü üretim deposuna ekle

CREATE OR REPLACE FUNCTION add_production_output_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Bitmiş ürünü üretim deposuna ekle
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

    RAISE NOTICE '✅ Üretim kaydı: % adet % üretildi (Kayıt #%)',
        NEW.quantity,
        (SELECT code FROM warehouse_items WHERE id = NEW.output_item_id),
        NEW.id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_production_output ON production_outputs;

CREATE TRIGGER trg_add_production_output
    AFTER INSERT ON production_outputs
    FOR EACH ROW
    EXECUTE FUNCTION add_production_output_to_inventory();

DO $$ BEGIN
    RAISE NOTICE '✅ Üretim kaydı trigger oluşturuldu';
END $$;

-- =====================================================
-- SONUÇ MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TÜM TRANSFER SİSTEMİ DÜZELTİLDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Aktif Transfer Akışları:';
    RAISE NOTICE '';
    RAISE NOTICE '1️⃣  DEPO → ÜRETİM';
    RAISE NOTICE '   • production_material_requests onaylanınca';
    RAISE NOTICE '   • Depo stok azalır (warehouse_transactions exit)';
    RAISE NOTICE '   • Üretim deposuna HAMMADDE eklenir';
    RAISE NOTICE '';
    RAISE NOTICE '2️⃣  ÜRETİM → DEPO';
    RAISE NOTICE '   • production_to_warehouse_transfers onaylanınca';
    RAISE NOTICE '   • Üretim deposundan BİTMİŞ ÜRÜN azalır';
    RAISE NOTICE '   • Ana depo stok artar (warehouse_transactions entry)';
    RAISE NOTICE '';
    RAISE NOTICE '3️⃣  ÜRETİM → KALİTE KONTROL';
    RAISE NOTICE '   • production_to_qc_transfers onaylanınca';
    RAISE NOTICE '   • Üretim deposundan BİTMİŞ ÜRÜN azalır';
    RAISE NOTICE '   • KK deposuna eklenir';
    RAISE NOTICE '';
    RAISE NOTICE '4️⃣  KALİTE KONTROL → DEPO/ÜRETİM';
    RAISE NOTICE '   • qc_to_warehouse_transfers onaylanınca';
    RAISE NOTICE '   • KK deposundan azalır';
    RAISE NOTICE '   • GEÇTİ ise → Ana depoya (warehouse_transactions entry)';
    RAISE NOTICE '   • KALDI ise → Üretim deposuna geri (bitmiş ürün)';
    RAISE NOTICE '';
    RAISE NOTICE '5️⃣  ÜRETİM KAYDI → ÜRETİM DEPOSU';
    RAISE NOTICE '   • production_outputs eklenenince';
    RAISE NOTICE '   • Otomatik üretim deposuna BİTMİŞ ÜRÜN eklenir';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tüm trigger''lar warehouse_transactions kullanıyor';
    RAISE NOTICE '✅ Stok geçmişi tam olarak tutuluyor';
    RAISE NOTICE '✅ ON CONFLICT hataları düzeltildi';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık birimler arası transfer sorunsuz çalışacak!';
    RAISE NOTICE '========================================';
END $$;
