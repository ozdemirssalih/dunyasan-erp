-- DÜNYASAN ERP - Machines Tablosu RLS Düzeltmesi
-- machines tablosu için RLS policy eksik

-- RLS'i aktif et
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Eski policy'leri sil
DROP POLICY IF EXISTS "view_machines" ON machines;
DROP POLICY IF EXISTS "insert_machines" ON machines;
DROP POLICY IF EXISTS "update_machines" ON machines;
DROP POLICY IF EXISTS "delete_machines" ON machines;

-- Yeni policy'ler ekle
CREATE POLICY "view_machines" ON machines
    FOR SELECT TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "insert_machines" ON machines
    FOR INSERT TO authenticated
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "update_machines" ON machines
    FOR UPDATE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "delete_machines" ON machines
    FOR DELETE TO authenticated
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Machines tablosu RLS policy eklendi!';
    RAISE NOTICE '📝 Artık tezgahlar görülebilir ve yönetilebilir';
END $$;
