-- =====================================================
-- DÜNYASAN ERP - KOMPLE SİSTEM KURULUMU
-- =====================================================
-- Tüm tabloları, constraint'leri, trigger'ları oluşturur
-- Bu dosyayı sadece 1 KERE çalıştırın
-- =====================================================

\timing on

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🚀 DÜNYASAN ERP SİSTEMİ KURULUYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- =====================================================
-- BÖLÜM 1: TEZGAH ENVANTERİ SİSTEMİ
-- =====================================================

-- Tezgah stoğu tablosu
CREATE TABLE IF NOT EXISTS machine_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    current_stock DECIMAL(15,3) DEFAULT 0 NOT NULL CHECK (current_stock >= 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, machine_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_machine_inv_company ON machine_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_machine_inv_machine ON machine_inventory(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_inv_item ON machine_inventory(item_id);

-- Üretim → Tezgah transfer geçmişi
CREATE TABLE IF NOT EXISTS production_to_machine_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    transferred_by UUID NOT NULL REFERENCES profiles(id),
    transferred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prod_mach_trans_company ON production_to_machine_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_prod_mach_trans_machine ON production_to_machine_transfers(machine_id);
CREATE INDEX IF NOT EXISTS idx_prod_mach_trans_date ON production_to_machine_transfers(transferred_at);

DO $$ BEGIN RAISE NOTICE '✅ 1/7 - Tezgah envanter tabloları oluşturuldu'; END $$;

-- =====================================================
-- BÖLÜM 2: FİRE (SCRAP) SİSTEMİ
-- =====================================================

-- Fire kayıt tablosu
CREATE TABLE IF NOT EXISTS production_scrap_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('machine', 'production', 'warehouse')),
    machine_id UUID REFERENCES machines(id),
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL CHECK (quantity > 0),
    scrap_reason TEXT NOT NULL CHECK (scrap_reason IN (
        'damaged', 'defective', 'expired', 'process_error',
        'quality_fail', 'measurement_error', 'material_fault', 'other'
    )),
    notes TEXT,
    recorded_by UUID NOT NULL REFERENCES profiles(id),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrap_company ON production_scrap_records(company_id);
CREATE INDEX IF NOT EXISTS idx_scrap_machine ON production_scrap_records(machine_id);
CREATE INDEX IF NOT EXISTS idx_scrap_source ON production_scrap_records(source_type);
CREATE INDEX IF NOT EXISTS idx_scrap_date ON production_scrap_records(recorded_at);

DO $$ BEGIN RAISE NOTICE '✅ 2/7 - Fire kayıt tablosu oluşturuldu'; END $$;

-- =====================================================
-- BÖLÜM 3: TRANSFER TABLOLARINA KOLON EKLEMELERİ
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

DO $$ BEGIN RAISE NOTICE '✅ 3/7 - Transfer tablolarına approved_by/approved_at eklendi'; END $$;

-- =====================================================
-- BÖLÜM 4: CONSTRAINT DÜZELTMELERİ
-- =====================================================

-- production_inventory: Tüm UNIQUE constraint'leri temizle
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'production_inventory'::regclass
          AND contype = 'u'
          AND conname != 'production_inventory_pkey'
    LOOP
        EXECUTE format('ALTER TABLE production_inventory DROP CONSTRAINT %I CASCADE', constraint_name);
    END LOOP;
END $$;

-- Doğru UNIQUE constraint ekle
ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_unique_item
UNIQUE (company_id, item_id, item_type);

-- item_type CHECK constraint (scrap dahil)
ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_item_type_check CASCADE;

ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_item_type_check
CHECK (item_type IN ('raw_material', 'finished_product', 'scrap'));

DO $$ BEGIN RAISE NOTICE '✅ 4/7 - production_inventory constraint''leri düzeltildi'; END $$;

-- =====================================================
-- BÖLÜM 5: RLS POLİTİKALARI
-- =====================================================

-- Tüm tablolar için RLS aktif
ALTER TABLE machine_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_to_machine_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_scrap_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_to_warehouse_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_to_qc_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_to_warehouse_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_control_inventory ENABLE ROW LEVEL SECURITY;

-- Tüm politikaları sil
DROP POLICY IF EXISTS "machine_inventory_all" ON machine_inventory;
DROP POLICY IF EXISTS "production_to_machine_transfers_all" ON production_to_machine_transfers;
DROP POLICY IF EXISTS "production_scrap_records_all" ON production_scrap_records;
DROP POLICY IF EXISTS "production_inventory_all" ON production_inventory;
DROP POLICY IF EXISTS "production_material_requests_all" ON production_material_requests;
DROP POLICY IF EXISTS "production_to_warehouse_transfers_all" ON production_to_warehouse_transfers;
DROP POLICY IF EXISTS "production_to_qc_transfers_all" ON production_to_qc_transfers;
DROP POLICY IF EXISTS "qc_to_warehouse_transfers_all" ON qc_to_warehouse_transfers;
DROP POLICY IF EXISTS "quality_control_inventory_all" ON quality_control_inventory;

-- Yeni politikalar: Herkes her şeyi görebilir/yapabilir
CREATE POLICY "machine_inventory_all" ON machine_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_to_machine_transfers_all" ON production_to_machine_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_scrap_records_all" ON production_scrap_records FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_inventory_all" ON production_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_material_requests_all" ON production_material_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_to_warehouse_transfers_all" ON production_to_warehouse_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_to_qc_transfers_all" ON production_to_qc_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "qc_to_warehouse_transfers_all" ON qc_to_warehouse_transfers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quality_control_inventory_all" ON quality_control_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN RAISE NOTICE '✅ 5/7 - RLS politikaları oluşturuldu'; END $$;

-- =====================================================
-- BÖLÜM 6: TÜM TRIGGER FONKSIYONLARI
-- =====================================================

-- Eski trigger'ları sil
DROP TRIGGER IF EXISTS trg_approve_material_request ON production_material_requests;
DROP TRIGGER IF EXISTS trg_approve_prod_warehouse_transfer ON production_to_warehouse_transfers;
DROP TRIGGER IF EXISTS trg_approve_prod_qc_transfer ON production_to_qc_transfers;
DROP TRIGGER IF EXISTS trg_approve_qc_warehouse_transfer ON qc_to_warehouse_transfers;
DROP TRIGGER IF EXISTS trg_transfer_prod_to_machine ON production_to_machine_transfers;
DROP TRIGGER IF EXISTS trg_record_scrap ON production_scrap_records;
DROP TRIGGER IF EXISTS trg_add_production_output ON production_outputs;

-- TRIGGER 1: Depo → Üretim
CREATE OR REPLACE FUNCTION approve_material_request_to_production()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        INSERT INTO warehouse_transactions (
            company_id, item_id, type, quantity, notes, reference_number, created_by, created_at
        ) VALUES (
            NEW.company_id, NEW.item_id, 'exit', NEW.quantity,
            'Üretime transfer - Talep #' || NEW.id,
            'PROD-REQ-' || NEW.id,
            COALESCE(NEW.approved_by, NEW.requested_by),
            NOW()
        );

        INSERT INTO production_inventory (
            company_id, item_id, current_stock, item_type, notes
        ) VALUES (
            NEW.company_id, NEW.item_id, NEW.quantity, 'raw_material',
            'Depodan - Talep #' || NEW.id
        )
        ON CONFLICT (company_id, item_id, item_type)
        DO UPDATE SET
            current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_material_request
AFTER UPDATE ON production_material_requests
FOR EACH ROW EXECUTE FUNCTION approve_material_request_to_production();

-- TRIGGER 2: Üretim → Depo
CREATE OR REPLACE FUNCTION approve_production_to_warehouse_transfer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id AND item_id = NEW.item_id AND item_type = 'finished_product';

        INSERT INTO warehouse_transactions (
            company_id, item_id, type, quantity, notes, reference_number, created_by, created_at
        ) VALUES (
            NEW.company_id, NEW.item_id, 'entry', NEW.quantity,
            'Üretimden - Transfer #' || NEW.id,
            'PROD-WH-' || NEW.id,
            COALESCE(NEW.approved_by, NEW.requested_by),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_prod_warehouse_transfer
AFTER UPDATE ON production_to_warehouse_transfers
FOR EACH ROW EXECUTE FUNCTION approve_production_to_warehouse_transfer();

-- TRIGGER 3: Üretim → Kalite Kontrol
CREATE OR REPLACE FUNCTION approve_production_to_qc_transfer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id AND item_id = NEW.item_id AND item_type = 'finished_product';

        INSERT INTO quality_control_inventory (
            company_id, item_id, current_stock, notes
        ) VALUES (
            NEW.company_id, NEW.item_id, NEW.quantity, 'Üretimden - Transfer #' || NEW.id
        )
        ON CONFLICT (company_id, item_id)
        DO UPDATE SET
            current_stock = quality_control_inventory.current_stock + EXCLUDED.current_stock,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_prod_qc_transfer
AFTER UPDATE ON production_to_qc_transfers
FOR EACH ROW EXECUTE FUNCTION approve_production_to_qc_transfer();

-- TRIGGER 4: Kalite Kontrol → Depo/Üretim
CREATE OR REPLACE FUNCTION approve_qc_to_warehouse_transfer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        UPDATE quality_control_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id AND item_id = NEW.item_id;

        IF NEW.quality_result = 'passed' THEN
            INSERT INTO warehouse_transactions (
                company_id, item_id, type, quantity, notes, reference_number, created_by, created_at
            ) VALUES (
                NEW.company_id, NEW.item_id, 'entry', NEW.quantity,
                'KK''den geçti - Transfer #' || NEW.id,
                'QC-WH-' || NEW.id,
                COALESCE(NEW.approved_by, NEW.requested_by),
                NOW()
            );
        ELSE
            INSERT INTO production_inventory (
                company_id, item_id, current_stock, item_type, notes
            ) VALUES (
                NEW.company_id, NEW.item_id, NEW.quantity, 'finished_product',
                'KK''den dönen - Transfer #' || NEW.id
            )
            ON CONFLICT (company_id, item_id, item_type)
            DO UPDATE SET
                current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
                updated_at = NOW();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_qc_warehouse_transfer
AFTER UPDATE ON qc_to_warehouse_transfers
FOR EACH ROW EXECUTE FUNCTION approve_qc_to_warehouse_transfer();

-- TRIGGER 5: Üretim → Tezgah
CREATE OR REPLACE FUNCTION transfer_production_to_machine()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE production_inventory
    SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
    WHERE company_id = NEW.company_id AND item_id = NEW.item_id AND item_type = 'raw_material';

    INSERT INTO machine_inventory (
        company_id, machine_id, item_id, current_stock, notes
    ) VALUES (
        NEW.company_id, NEW.machine_id, NEW.item_id, NEW.quantity, 'Transfer #' || NEW.id
    )
    ON CONFLICT (company_id, machine_id, item_id)
    DO UPDATE SET
        current_stock = machine_inventory.current_stock + EXCLUDED.current_stock,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transfer_prod_to_machine
AFTER INSERT ON production_to_machine_transfers
FOR EACH ROW EXECUTE FUNCTION transfer_production_to_machine();

-- TRIGGER 6: Fire Kayıt
CREATE OR REPLACE FUNCTION record_production_scrap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.source_type = 'machine' THEN
        UPDATE machine_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id AND machine_id = NEW.machine_id AND item_id = NEW.item_id;
    ELSIF NEW.source_type = 'production' THEN
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE company_id = NEW.company_id AND item_id = NEW.item_id AND item_type IN ('raw_material', 'finished_product');
    ELSIF NEW.source_type = 'warehouse' THEN
        UPDATE warehouse_items
        SET current_stock = current_stock - NEW.quantity, updated_at = NOW()
        WHERE id = NEW.item_id;
    END IF;

    INSERT INTO production_inventory (
        company_id, item_id, current_stock, item_type, notes
    ) VALUES (
        NEW.company_id, NEW.item_id, NEW.quantity, 'scrap', 'Fire - ' || NEW.scrap_reason
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_scrap
AFTER INSERT ON production_scrap_records
FOR EACH ROW EXECUTE FUNCTION record_production_scrap();

-- TRIGGER 7: Üretim Kaydı → Tezgahtan Otomatik Azalt
CREATE OR REPLACE FUNCTION add_production_output_to_inventory()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    req RECORD;
BEGIN
    INSERT INTO production_inventory (
        company_id, item_id, current_stock, item_type, notes
    ) VALUES (
        NEW.company_id, NEW.output_item_id, NEW.quantity, 'finished_product', 'Üretim #' || NEW.id
    )
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + EXCLUDED.current_stock,
        updated_at = NOW();

    FOR req IN
        SELECT item_id, quantity
        FROM production_material_assignments
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND assigned_date::date = NEW.production_date::date
    LOOP
        UPDATE machine_inventory
        SET current_stock = current_stock - (req.quantity * NEW.quantity), updated_at = NOW()
        WHERE company_id = NEW.company_id AND machine_id = NEW.machine_id AND item_id = req.item_id;
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_production_output
AFTER INSERT ON production_outputs
FOR EACH ROW EXECUTE FUNCTION add_production_output_to_inventory();

DO $$ BEGIN RAISE NOTICE '✅ 6/7 - Tüm trigger''lar oluşturuldu (7 trigger)'; END $$;

-- =====================================================
-- BÖLÜM 7: SİSTEM DOĞRULAMA
-- =====================================================

DO $$
DECLARE
    constraint_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Constraint kontrolü
    SELECT COUNT(*) INTO constraint_count
    FROM pg_constraint
    WHERE conrelid = 'production_inventory'::regclass
      AND conname = 'production_inventory_unique_item';

    IF constraint_count = 0 THEN
        RAISE EXCEPTION 'HATA: UNIQUE constraint oluşturulamadı!';
    END IF;

    -- Trigger kontrolü
    SELECT COUNT(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname IN (
        'trg_approve_material_request',
        'trg_approve_prod_warehouse_transfer',
        'trg_approve_prod_qc_transfer',
        'trg_approve_qc_warehouse_transfer',
        'trg_transfer_prod_to_machine',
        'trg_record_scrap',
        'trg_add_production_output'
    );

    IF trigger_count < 7 THEN
        RAISE EXCEPTION 'HATA: Bazı trigger''lar oluşturulamadı! (Beklenen: 7, Bulunan: %)', trigger_count;
    END IF;

    RAISE NOTICE '✅ 7/7 - Sistem doğrulandı (%/7 trigger aktif)', trigger_count;
END $$;

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🎉 DÜNYASAN ERP SİSTEMİ HAZIR!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Oluşturulan Tablolar:';
    RAISE NOTICE '   • machine_inventory';
    RAISE NOTICE '   • production_to_machine_transfers';
    RAISE NOTICE '   • production_scrap_records';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Düzeltilen Constraint''ler:';
    RAISE NOTICE '   • production_inventory UNIQUE (company_id, item_id, item_type)';
    RAISE NOTICE '   • production_inventory CHECK (scrap dahil)';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Aktif Trigger''lar (7 adet):';
    RAISE NOTICE '   1. Depo → Üretim';
    RAISE NOTICE '   2. Üretim → Depo';
    RAISE NOTICE '   3. Üretim → Kalite Kontrol';
    RAISE NOTICE '   4. Kalite Kontrol → Depo/Üretim';
    RAISE NOTICE '   5. Üretim → Tezgah';
    RAISE NOTICE '   6. Fire Kayıt';
    RAISE NOTICE '   7. Üretim Kaydı → Otomatik Azaltma';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tüm RLS politikaları aktif';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 SİSTEM KULLANIMA HAZIR!';
    RAISE NOTICE '========================================';
END $$;

\timing off
