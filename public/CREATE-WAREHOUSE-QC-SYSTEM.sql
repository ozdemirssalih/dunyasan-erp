-- DEPO GİRİŞİ İÇİN KALİTE KONTROL SİSTEMİ

-- 1. Depo kalite kontrol talepleri tablosu
CREATE TABLE IF NOT EXISTS warehouse_qc_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
    quantity DECIMAL(15,3) NOT NULL,
    supplier TEXT,
    reference_number TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    requested_by UUID REFERENCES profiles(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_warehouse_qc_requests_company ON warehouse_qc_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_qc_requests_status ON warehouse_qc_requests(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_qc_requests_item ON warehouse_qc_requests(item_id);

-- 2. Onaylandığında otomatik warehouse_transactions'a ekle
CREATE OR REPLACE FUNCTION approve_warehouse_qc_request()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Eğer status 'approved' olarak güncellendiyse
    IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
        -- Warehouse transactions'a ekle
        INSERT INTO warehouse_transactions (
            company_id,
            item_id,
            type,
            quantity,
            supplier,
            reference_number,
            notes,
            created_by,
            created_at
        ) VALUES (
            NEW.company_id,
            NEW.item_id,
            'entry',
            NEW.quantity,
            NEW.supplier,
            COALESCE(NEW.reference_number, 'QC-' || NEW.id),
            COALESCE('Kalite Kontrolden Onaylandı. ' || NEW.review_notes, 'Kalite Kontrolden Onaylandı'),
            NEW.reviewed_by,
            NOW()
        );

        RAISE NOTICE '✅ Warehouse QC Request approved - Added to warehouse_transactions';
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger oluştur
DROP TRIGGER IF EXISTS trg_approve_warehouse_qc_request ON warehouse_qc_requests;
CREATE TRIGGER trg_approve_warehouse_qc_request
    AFTER UPDATE ON warehouse_qc_requests
    FOR EACH ROW
    EXECUTE FUNCTION approve_warehouse_qc_request();

-- RLS Politikaları
ALTER TABLE warehouse_qc_requests ENABLE ROW LEVEL SECURITY;

-- SELECT policy
DROP POLICY IF EXISTS "Users can view their company's warehouse qc requests" ON warehouse_qc_requests;
CREATE POLICY "Users can view their company's warehouse qc requests"
    ON warehouse_qc_requests FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- INSERT policy
DROP POLICY IF EXISTS "Users can create warehouse qc requests" ON warehouse_qc_requests;
CREATE POLICY "Users can create warehouse qc requests"
    ON warehouse_qc_requests FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- UPDATE policy (kalite kontrol onay/red için)
DROP POLICY IF EXISTS "Users can update warehouse qc requests" ON warehouse_qc_requests;
CREATE POLICY "Users can update warehouse qc requests"
    ON warehouse_qc_requests FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ DEPO KALİTE KONTROL SİSTEMİ HAZIR!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '  ✓ warehouse_qc_requests tablosu oluşturuldu';
    RAISE NOTICE '  ✓ Otomatik onay trigger''ı eklendi';
    RAISE NOTICE '  ✓ RLS politikaları ayarlandı';
    RAISE NOTICE '';
    RAISE NOTICE 'Akış:';
    RAISE NOTICE '  1. Depo giri şinde "Kalite Kontrol Gerekli" seçilir';
    RAISE NOTICE '  2. Kayıt warehouse_qc_requests''e eklenir (pending)';
    RAISE NOTICE '  3. Kalite kontrol onaylar/reddeder';
    RAISE NOTICE '  4. Onaylanırsa warehouse_transactions''a eklenir';
    RAISE NOTICE '  5. Stok otomatik güncellenir';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
END $$;
