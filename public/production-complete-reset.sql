-- DÜNYASAN ERP - ÜRETİM MODÜLÜ SIFIRDAN KURULUM
-- Tüm eski yapıları sil, baştan kur

-- =====================================================
-- ADIM 1: TEMİZLİK (Her şeyi sil)
-- =====================================================

-- Önce trigger fonksiyonlarını sil (CASCADE ile trigger'lar da silinir)
DROP FUNCTION IF EXISTS approve_production_material_request() CASCADE;
DROP FUNCTION IF EXISTS assign_material_to_machine() CASCADE;

-- Tabloları sil (CASCADE ile bağımlılıklar da silinir)
DROP TABLE IF EXISTS production_outputs CASCADE;
DROP TABLE IF EXISTS production_material_assignments CASCADE;
DROP TABLE IF EXISTS production_material_requests CASCADE;
DROP TABLE IF EXISTS production_inventory CASCADE;

-- =====================================================
-- ADIM 2: TABLOLARI OLUŞTUR
-- =====================================================

-- 1. Üretim Stoğu (Depodan onaylanmış malzemeler)
CREATE TABLE production_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    current_stock DECIMAL(15,3) DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, item_id)
);

-- 2. Üretim Malzeme Talepleri (Üretim → Depo)
CREATE TABLE production_material_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_by UUID NOT NULL REFERENCES profiles(id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tezgaha Hammadde Atamaları
CREATE TABLE production_material_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    assigned_by UUID NOT NULL REFERENCES profiles(id),
    assigned_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shift TEXT CHECK (shift IN ('sabah', 'oglen', 'gece')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Üretim Çıktıları
CREATE TABLE production_outputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    output_item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    production_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shift TEXT CHECK (shift IN ('sabah', 'oglen', 'gece')),
    operator_id UUID REFERENCES profiles(id),
    quality_status TEXT DEFAULT 'pending' CHECK (quality_status IN ('pending', 'approved', 'rejected')),
    notes TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ADIM 3: İNDEKSLER
-- =====================================================

CREATE INDEX idx_prod_inv_company ON production_inventory(company_id);
CREATE INDEX idx_prod_inv_item ON production_inventory(item_id);
CREATE INDEX idx_prod_req_company ON production_material_requests(company_id);
CREATE INDEX idx_prod_req_status ON production_material_requests(status);
CREATE INDEX idx_prod_assign_machine ON production_material_assignments(machine_id);
CREATE INDEX idx_prod_assign_date ON production_material_assignments(assigned_date);
CREATE INDEX idx_prod_out_machine ON production_outputs(machine_id);
CREATE INDEX idx_prod_out_date ON production_outputs(production_date);

-- =====================================================
-- ADIM 4: RLS POLİCİES
-- =====================================================

ALTER TABLE production_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_outputs ENABLE ROW LEVEL SECURITY;

-- production_inventory policies
CREATE POLICY "prod_inv_select" ON production_inventory
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_inv_insert" ON production_inventory
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_inv_update" ON production_inventory
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- production_material_requests policies
CREATE POLICY "prod_req_select" ON production_material_requests
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_req_insert" ON production_material_requests
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_req_update" ON production_material_requests
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- production_material_assignments policies
CREATE POLICY "prod_assign_select" ON production_material_assignments
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_assign_insert" ON production_material_assignments
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- production_outputs policies
CREATE POLICY "prod_out_select" ON production_outputs
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_out_insert" ON production_outputs
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "prod_out_update" ON production_outputs
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 5: MACHINES TABLOSU RLS (Eğer yoksa)
-- =====================================================

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machines_select" ON machines;
DROP POLICY IF EXISTS "machines_insert" ON machines;
DROP POLICY IF EXISTS "machines_update" ON machines;
DROP POLICY IF EXISTS "machines_delete" ON machines;

CREATE POLICY "machines_select" ON machines
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "machines_insert" ON machines
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "machines_update" ON machines
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "machines_delete" ON machines
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 6: TRIGGER FUNCTIONS
-- =====================================================

-- Trigger 1: Talep onaylandığında depo↓ üretim↑
CREATE OR REPLACE FUNCTION approve_production_material_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Sadece pending→approved değişiminde çalış
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN

        -- Depo stoğunu azalt
        UPDATE warehouse_items
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.item_id;

        -- Üretim stoğunu arttır (yoksa oluştur)
        INSERT INTO production_inventory (company_id, item_id, current_stock)
        VALUES (NEW.company_id, NEW.item_id, NEW.quantity)
        ON CONFLICT (company_id, item_id)
        DO UPDATE SET
            current_stock = production_inventory.current_stock + NEW.quantity,
            updated_at = NOW();

    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_production_request
    AFTER UPDATE ON production_material_requests
    FOR EACH ROW
    EXECUTE FUNCTION approve_production_material_request();

-- Trigger 2: Tezgaha hammadde verildiğinde üretim stoğu↓
CREATE OR REPLACE FUNCTION assign_material_to_machine()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Üretim stoğunu azalt
    UPDATE production_inventory
    SET current_stock = current_stock - NEW.quantity,
        updated_at = NOW()
    WHERE company_id = NEW.company_id
      AND item_id = NEW.item_id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_material_to_machine
    AFTER INSERT ON production_material_assignments
    FOR EACH ROW
    EXECUTE FUNCTION assign_material_to_machine();

-- =====================================================
-- BAŞARI MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ÜRETİM MODÜLÜ BAŞARILI KURULDU!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 4 Tablo oluşturuldu:';
    RAISE NOTICE '   - production_inventory';
    RAISE NOTICE '   - production_material_requests';
    RAISE NOTICE '   - production_material_assignments';
    RAISE NOTICE '   - production_outputs';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Tüm RLS policies aktif';
    RAISE NOTICE '🔄 2 Otomatik trigger aktif:';
    RAISE NOTICE '   1. Talep onay → Depo↓ Üretim↑';
    RAISE NOTICE '   2. Tezgaha ver → Üretim stok↓';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Sistem hazır! Test edebilirsiniz.';
    RAISE NOTICE '';
END $$;
