-- DÜNYASAN ERP - Üretim Modülü
-- 32 tezgah, hammadde takibi, üretim kayıtları

-- =====================================================
-- ADIM 1: TEMİZLİK (Eski tabloları sil)
-- =====================================================

-- Önce fonksiyonları sil
DROP FUNCTION IF EXISTS approve_production_material_request() CASCADE;
DROP FUNCTION IF EXISTS assign_material_to_machine() CASCADE;

-- Sonra tabloları sil (CASCADE ile trigger'lar da silinir)
DROP TABLE IF EXISTS production_outputs CASCADE;
DROP TABLE IF EXISTS production_material_assignments CASCADE;
DROP TABLE IF EXISTS production_material_requests CASCADE;
DROP TABLE IF EXISTS production_inventory CASCADE;

-- =====================================================
-- ADIM 2: TABLOLARI OLUŞTUR
-- =====================================================

-- 1. Üretim Stoğu (Depodan gelen onaylanmış hammaddeler)
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

-- 3. Tezgaha Hammadde Atamaları (Üretim Stoğu → Tezgah)
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

-- 4. Üretim Çıktıları (Tezgahlardan Çıkan Ürünler)
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

CREATE INDEX idx_production_inventory_company ON production_inventory(company_id);
CREATE INDEX idx_production_inventory_item ON production_inventory(item_id);
CREATE INDEX idx_production_requests_company ON production_material_requests(company_id);
CREATE INDEX idx_production_requests_status ON production_material_requests(status);
CREATE INDEX idx_production_assignments_machine ON production_material_assignments(machine_id);
CREATE INDEX idx_production_assignments_date ON production_material_assignments(assigned_date);
CREATE INDEX idx_production_outputs_machine ON production_outputs(machine_id);
CREATE INDEX idx_production_outputs_date ON production_outputs(production_date);

-- =====================================================
-- ADIM 4: RLS POLİCİES
-- =====================================================

ALTER TABLE production_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_material_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_production_inventory" ON production_inventory
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "insert_production_inventory" ON production_inventory
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "update_production_inventory" ON production_inventory
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "view_production_requests" ON production_material_requests
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "insert_production_requests" ON production_material_requests
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "update_production_requests" ON production_material_requests
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "update_production_requests" ON production_material_requests
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "view_material_assignments" ON production_material_assignments
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "insert_material_assignments" ON production_material_assignments
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "view_production_outputs" ON production_outputs
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "insert_production_outputs" ON production_outputs
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "update_production_outputs" ON production_outputs
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- =====================================================
-- ADIM 5: TRIGGER FUNCTIONS
-- =====================================================

-- Trigger: Talep onaylandığında depo stoğu azalt, üretim stoğu arttır
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

-- Trigger: Tezgaha hammadde verildiğinde üretim stoğunu azalt
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
    RAISE NOTICE '✅ Üretim modülü başarıyla kuruldu!';
    RAISE NOTICE '🏭 4 tablo oluşturuldu';
    RAISE NOTICE '🔄 Otomatik stok transferi aktif';
    RAISE NOTICE '';
    RAISE NOTICE '📌 Talep onaylanınca: Depo ↓ | Üretim ↑';
    RAISE NOTICE '📌 Tezgaha hammadde verilince: Üretim Stoğu ↓';
    RAISE NOTICE '';
    RAISE NOTICE '👉 Şimdi üretim sayfasını kullanabilirsiniz: /dashboard/production';
END $$;
