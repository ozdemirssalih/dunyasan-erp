-- DÜNYASAN ERP - Üretim Stok Sistemi Yükseltme
-- Üretim deposunda hem hammadde hem bitmiş ürün takibi
-- Otomatik transferler ve kayıt sistemi

-- =====================================================
-- ADIM 1: production_inventory Tablosunu Güncelle
-- =====================================================

-- item_type kolonu ekle (hammadde / bitmiş ürün)
ALTER TABLE production_inventory
ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'raw_material'
CHECK (item_type IN ('raw_material', 'finished_product'));

-- Açıklama kolonu ekle
ALTER TABLE production_inventory
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_production_inventory_type ON production_inventory(item_type);

-- =====================================================
-- ADIM 2: Üretim → Ana Depo Transfer Tablosu
-- =====================================================

CREATE TABLE IF NOT EXISTS production_to_warehouse_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_prod_warehouse_transfers_company ON production_to_warehouse_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_prod_warehouse_transfers_status ON production_to_warehouse_transfers(status);

-- RLS
ALTER TABLE production_to_warehouse_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prod_warehouse_transfers_select" ON production_to_warehouse_transfers;
DROP POLICY IF EXISTS "prod_warehouse_transfers_insert" ON production_to_warehouse_transfers;
DROP POLICY IF EXISTS "prod_warehouse_transfers_update" ON production_to_warehouse_transfers;

CREATE POLICY "prod_warehouse_transfers_select" ON production_to_warehouse_transfers
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_warehouse_transfers_insert" ON production_to_warehouse_transfers
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_warehouse_transfers_update" ON production_to_warehouse_transfers
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 3: Üretim Kaydı → Üretim Deposu Trigger
-- =====================================================

-- Üretim kaydı yapılınca bitmiş ürünü üretim deposuna ekle
CREATE OR REPLACE FUNCTION add_production_output_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Bitmiş ürünü üretim deposuna ekle
    INSERT INTO production_inventory (company_id, item_id, current_stock, item_type, notes)
    VALUES (NEW.company_id, NEW.output_item_id, NEW.quantity, 'finished_product', 'Üretim kaydı #' || NEW.id)
    ON CONFLICT (company_id, item_id, item_type)
    DO UPDATE SET
        current_stock = production_inventory.current_stock + NEW.quantity,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_production_output ON production_outputs;

CREATE TRIGGER trg_add_production_output
    AFTER INSERT ON production_outputs
    FOR EACH ROW
    EXECUTE FUNCTION add_production_output_to_inventory();

-- =====================================================
-- ADIM 4: Transfer Onay → Stok Hareketi Trigger
-- =====================================================

-- Transfer onaylanınca: Üretim deposu↓ Ana depo↑
CREATE OR REPLACE FUNCTION approve_production_to_warehouse_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sadece pending→approved değişiminde çalış
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- Üretim deposundan bitmiş ürünü azalt
        UPDATE production_inventory
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE company_id = NEW.company_id
          AND item_id = NEW.item_id
          AND item_type = 'finished_product';

        -- Ana depo stoğunu arttır
        UPDATE warehouse_items
        SET current_stock = current_stock + NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;

    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approve_prod_warehouse_transfer ON production_to_warehouse_transfers;

CREATE TRIGGER trg_approve_prod_warehouse_transfer
    AFTER UPDATE ON production_to_warehouse_transfers
    FOR EACH ROW
    EXECUTE FUNCTION approve_production_to_warehouse_transfer();

-- =====================================================
-- ADIM 5: production_inventory UNIQUE Constraint Güncelle
-- =====================================================

-- Eski unique constraint'i kaldır
ALTER TABLE production_inventory DROP CONSTRAINT IF EXISTS production_inventory_company_id_item_id_key;

-- Yeni unique constraint ekle (company_id, item_id, item_type)
ALTER TABLE production_inventory
DROP CONSTRAINT IF EXISTS production_inventory_unique_item;

ALTER TABLE production_inventory
ADD CONSTRAINT production_inventory_unique_item
UNIQUE (company_id, item_id, item_type);

-- =====================================================
-- BAŞARI MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ÜRETİM STOK SİSTEMİ YÜKSELTİLDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Üretim Deposu Özellikleri:';
    RAISE NOTICE '   ✓ Hammadde takibi (raw_material)';
    RAISE NOTICE '   ✓ Bitmiş ürün takibi (finished_product)';
    RAISE NOTICE '   ✓ Otomatik üretim kaydı → üretim deposu';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Transfer Sistemi:';
    RAISE NOTICE '   ✓ Üretim deposu → Ana depo transfer tablosu';
    RAISE NOTICE '   ✓ Onay sistemi ile otomatik stok hareketi';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Sistem hazır! UI güncellemelerini yapabilirsiniz.';
    RAISE NOTICE '';
END $$;
