-- =====================================================
-- DÜNYASAN ERP - TEZGAH STOK VE TRANSFER SİSTEMİ
-- =====================================================
-- Her tezgahın kendi envanteri
-- Üretim deposu → Tezgah: Direkt transfer (onaysız)
-- Üretim kaydı yapılınca: Tezgahtan hammadde azalır otomatik
-- =====================================================

-- =====================================================
-- ADIM 1: TEZGAH ENVANTERİ TABLOSU
-- =====================================================

CREATE TABLE IF NOT EXISTS machine_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    current_stock DECIMAL(15,3) DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, machine_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_machine_inventory_company ON machine_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_machine_inventory_machine ON machine_inventory(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_inventory_item ON machine_inventory(item_id);

COMMENT ON TABLE machine_inventory IS 'Her tezgahın kendi hammadde stoğu';

-- RLS
ALTER TABLE machine_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machine_inventory_select" ON machine_inventory;
DROP POLICY IF EXISTS "machine_inventory_insert" ON machine_inventory;
DROP POLICY IF EXISTS "machine_inventory_update" ON machine_inventory;

CREATE POLICY "machine_inventory_select" ON machine_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "machine_inventory_insert" ON machine_inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "machine_inventory_update" ON machine_inventory FOR UPDATE TO authenticated USING (true);

-- =====================================================
-- ADIM 2: ÜRETİM → TEZGAH TRANSFER TABLOSU
-- =====================================================
-- Geçmiş için kayıt tutuluyor, ama onaysız direkt işlem

CREATE TABLE IF NOT EXISTS production_to_machine_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    transferred_by UUID NOT NULL REFERENCES profiles(id),
    transferred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_prod_machine_transfers_company ON production_to_machine_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_prod_machine_transfers_machine ON production_to_machine_transfers(machine_id);
CREATE INDEX IF NOT EXISTS idx_prod_machine_transfers_date ON production_to_machine_transfers(transferred_at);

COMMENT ON TABLE production_to_machine_transfers IS 'Üretim deposundan tezgaha malzeme verme geçmişi';

-- RLS
ALTER TABLE production_to_machine_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_machine_transfers_select" ON production_to_machine_transfers;
DROP POLICY IF EXISTS "prod_machine_transfers_insert" ON production_to_machine_transfers;

CREATE POLICY "prod_machine_transfers_select" ON production_to_machine_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "prod_machine_transfers_insert" ON production_to_machine_transfers FOR INSERT TO authenticated WITH CHECK (true);

-- =====================================================
-- ADIM 3: ÜRETİM → TEZGAH TRANSFER TRİGGER
-- =====================================================
-- Kayıt eklenir eklenmez: Üretimden azalt, tezgaha ekle

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

    RAISE NOTICE '✅ Üretim→Tezgah: % adet % → Tezgah %',
        NEW.quantity,
        (SELECT code FROM warehouse_items WHERE id = NEW.item_id),
        (SELECT code FROM machines WHERE id = NEW.machine_id);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_prod_to_machine ON production_to_machine_transfers;

CREATE TRIGGER trg_transfer_prod_to_machine
    AFTER INSERT ON production_to_machine_transfers
    FOR EACH ROW
    EXECUTE FUNCTION transfer_production_to_machine();

-- =====================================================
-- ADIM 4: ÜRETİM KAYDI → TEZGAHTAN HAMMADDE AZALT
-- =====================================================
-- Mevcut production_outputs trigger'ını güncelle
-- Üretim kaydı yapılınca hem tezgahtan hammadde azalır hem üretime bitmiş ürün eklenir

CREATE OR REPLACE FUNCTION add_production_output_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    required_materials RECORD;
BEGIN
    -- 1. Bitmiş ürünü üretim deposuna ekle (eski davranış korunuyor)
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

    -- 2. Tezgahtan hammadde azalt (eğer production_material_assignments varsa)
    -- production_material_assignments tablosunda bu üretim için atanmış malzemeleri bul
    FOR required_materials IN
        SELECT item_id, quantity
        FROM production_material_assignments
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND assigned_date::date = NEW.production_date::date
    LOOP
        -- Tezgah envanterinden azalt
        UPDATE machine_inventory
        SET current_stock = current_stock - (required_materials.quantity * NEW.quantity),
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND machine_id = NEW.machine_id
          AND item_id = required_materials.item_id;

        RAISE NOTICE '📉 Tezgahtan hammadde azaldı: % adet % (Tezgah: %)',
            (required_materials.quantity * NEW.quantity),
            (SELECT code FROM warehouse_items WHERE id = required_materials.item_id),
            (SELECT code FROM machines WHERE id = NEW.machine_id);
    END LOOP;

    RAISE NOTICE '✅ Üretim kaydı: % adet % üretildi (Tezgah: %, Kayıt #%)',
        NEW.quantity,
        (SELECT code FROM warehouse_items WHERE id = NEW.output_item_id),
        (SELECT code FROM machines WHERE id = NEW.machine_id),
        NEW.id;

    RETURN NEW;
END;
$$;

-- Eski trigger'ı kaldır ve yenisini oluştur
DROP TRIGGER IF EXISTS trg_add_production_output ON production_outputs;

CREATE TRIGGER trg_add_production_output
    AFTER INSERT ON production_outputs
    FOR EACH ROW
    EXECUTE FUNCTION add_production_output_to_inventory();

-- =====================================================
-- SONUÇ MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TEZGAH STOK SİSTEMİ KURULDU!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Yeni Tablolar:';
    RAISE NOTICE '   1. machine_inventory - Her tezgahın kendi stoğu';
    RAISE NOTICE '   2. production_to_machine_transfers - Üretim→Tezgah geçmişi';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Akış:';
    RAISE NOTICE '';
    RAISE NOTICE '   1️⃣  ÜRETİM → TEZGAH (Malzeme Verme):';
    RAISE NOTICE '       • production_to_machine_transfers''a kayıt ekle';
    RAISE NOTICE '       • Trigger otomatik: Üretim deposu ↓, Tezgah ↑';
    RAISE NOTICE '       • ONAYSIZ direkt işlem!';
    RAISE NOTICE '';
    RAISE NOTICE '   2️⃣  ÜRETİM KAYDI (production_outputs):';
    RAISE NOTICE '       • Üretim kaydı yapılınca otomatik:';
    RAISE NOTICE '       • Tezgahtan hammadde ↓ (assignments''a göre)';
    RAISE NOTICE '       • Üretim deposuna bitmiş ürün ↑';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tezgahların tam stok takibi!';
    RAISE NOTICE '✅ Geçmiş kayıtları tutuluyor!';
    RAISE NOTICE '✅ Üretim-Tezgah arası ONAYSIZ!';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık her tezgahın kendi stoğu var!';
    RAISE NOTICE '========================================';
END $$;
