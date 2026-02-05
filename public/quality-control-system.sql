-- DÜNYASAN ERP - Kalite Kontrol ve Manuel Stok Sistemi
-- Üretim → Kalite Kontrol → Ana Depo akışı

-- =====================================================
-- ADIM 1: Kalite Kontrol Deposu
-- =====================================================

CREATE TABLE IF NOT EXISTS quality_control_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    current_stock DECIMAL(15,3) DEFAULT 0 NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, item_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_qc_inventory_company ON quality_control_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_qc_inventory_item ON quality_control_inventory(item_id);

-- RLS
ALTER TABLE quality_control_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_inventory_select" ON quality_control_inventory;
DROP POLICY IF EXISTS "qc_inventory_insert" ON quality_control_inventory;
DROP POLICY IF EXISTS "qc_inventory_update" ON quality_control_inventory;

CREATE POLICY "qc_inventory_select" ON quality_control_inventory
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "qc_inventory_insert" ON quality_control_inventory
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "qc_inventory_update" ON quality_control_inventory
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 2: Üretim → Kalite Kontrol Transferleri
-- =====================================================

CREATE TABLE IF NOT EXISTS production_to_qc_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by UUID NOT NULL REFERENCES profiles(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_prod_qc_transfers_company ON production_to_qc_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_prod_qc_transfers_status ON production_to_qc_transfers(status);

-- RLS
ALTER TABLE production_to_qc_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_qc_transfers_select" ON production_to_qc_transfers;
DROP POLICY IF EXISTS "prod_qc_transfers_insert" ON production_to_qc_transfers;
DROP POLICY IF EXISTS "prod_qc_transfers_update" ON production_to_qc_transfers;

CREATE POLICY "prod_qc_transfers_select" ON production_to_qc_transfers
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_qc_transfers_insert" ON production_to_qc_transfers
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_qc_transfers_update" ON production_to_qc_transfers
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 3: Kalite Kontrol → Ana Depo Transferleri
-- =====================================================

CREATE TABLE IF NOT EXISTS qc_to_warehouse_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    quality_result TEXT NOT NULL CHECK (quality_result IN ('passed', 'failed')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by UUID NOT NULL REFERENCES profiles(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_qc_warehouse_transfers_company ON qc_to_warehouse_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_qc_warehouse_transfers_status ON qc_to_warehouse_transfers(status);

-- RLS
ALTER TABLE qc_to_warehouse_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qc_warehouse_transfers_select" ON qc_to_warehouse_transfers;
DROP POLICY IF EXISTS "qc_warehouse_transfers_insert" ON qc_to_warehouse_transfers;
DROP POLICY IF EXISTS "qc_warehouse_transfers_update" ON qc_to_warehouse_transfers;

CREATE POLICY "qc_warehouse_transfers_select" ON qc_to_warehouse_transfers
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "qc_warehouse_transfers_insert" ON qc_to_warehouse_transfers
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "qc_warehouse_transfers_update" ON qc_to_warehouse_transfers
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 4: Üretim → QC Transfer Trigger
-- =====================================================

-- Transfer onaylanınca: Üretim deposu↓ QC deposu↑
CREATE OR REPLACE FUNCTION approve_production_to_qc_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- Üretim deposundan bitmiş ürünü azalt
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id
          AND item_type = 'finished_product';

        -- Kalite kontrol deposuna ekle
        INSERT INTO quality_control_inventory (company_id, item_id, current_stock)
        VALUES (NEW.company_id, NEW.item_id, NEW.quantity)
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

-- =====================================================
-- ADIM 5: QC → Depo Transfer Trigger
-- =====================================================

-- Transfer onaylanınca:
-- - Geçti ise: QC↓ Ana Depo↑
-- - Kaldı ise: QC↓ Üretim↑ (geri dönüyor)
CREATE OR REPLACE FUNCTION approve_qc_to_warehouse_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- Kalite kontrol deposundan azalt
        UPDATE quality_control_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id;

        -- Kalite testi geçti mi?
        IF NEW.quality_result = 'passed' THEN
            -- Ana depoya ekle
            UPDATE warehouse_items
            SET current_stock = current_stock + NEW.quantity,
                updated_at = NOW()
            WHERE id = NEW.item_id;
        ELSE
            -- Kalite testi geçemedi, üretim deposuna geri dön
            INSERT INTO production_inventory (company_id, item_id, current_stock, item_type)
            VALUES (NEW.company_id, NEW.item_id, NEW.quantity, 'finished_product')
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

-- =====================================================
-- BAŞARI MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ KALİTE KONTROL SİSTEMİ KURULDU!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 3 Yeni Tablo:';
    RAISE NOTICE '   - quality_control_inventory (KK deposu)';
    RAISE NOTICE '   - production_to_qc_transfers (Üretim → KK)';
    RAISE NOTICE '   - qc_to_warehouse_transfers (KK → Depo)';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Otomatik Akış:';
    RAISE NOTICE '   Üretim → KK (onay) → Kalite testi → Ana Depo';
    RAISE NOTICE '   Kalma durumunda: Geri üretim deposuna';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Üretim artık:';
    RAISE NOTICE '   - Manuel stok girebilir';
    RAISE NOTICE '   - Kalite kontrole gönderebilir';
    RAISE NOTICE '   - Doğrudan ana depoya gönderebilir';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Sistem hazır!';
    RAISE NOTICE '';
END $$;
