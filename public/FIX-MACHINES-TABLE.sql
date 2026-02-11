-- FIX: machines tablosuna company_id ekle (eğer yoksa)

ALTER TABLE machines
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Mevcut makinelere company_id ata (eğer null ise)
UPDATE machines
SET company_id = (SELECT id FROM companies LIMIT 1)
WHERE company_id IS NULL;

-- company_id'yi NOT NULL yap
ALTER TABLE machines
ALTER COLUMN company_id SET NOT NULL;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_machines_company ON machines(company_id);

-- RLS politikalarını güncelle
DROP POLICY IF EXISTS "Users can view machines of their company" ON machines;
CREATE POLICY "Users can view machines of their company"
    ON machines FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert machines for their company" ON machines;
CREATE POLICY "Users can insert machines for their company"
    ON machines FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update machines of their company" ON machines;
CREATE POLICY "Users can update machines of their company"
    ON machines FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete machines of their company" ON machines;
CREATE POLICY "Users can delete machines of their company"
    ON machines FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DO $$
BEGIN
    RAISE NOTICE '✅ Machines tablosu company_id ile güncellendi!';
END $$;
