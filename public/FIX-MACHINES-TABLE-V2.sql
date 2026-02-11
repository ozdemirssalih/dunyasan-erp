-- FIX: machines tablosuna company_id ekle (güvenli sıralama)

-- ADIM 1: Önce eski RLS politikalarını devre dışı bırak
ALTER TABLE machines DISABLE ROW LEVEL SECURITY;

-- ADIM 2: Eski politikaları sil
DROP POLICY IF EXISTS "Users can view machines of their company" ON machines;
DROP POLICY IF EXISTS "Users can insert machines for their company" ON machines;
DROP POLICY IF EXISTS "Users can update machines of their company" ON machines;
DROP POLICY IF EXISTS "Users can delete machines of their company" ON machines;

-- Varsa diğer politikaları da sil
DROP POLICY IF EXISTS "Enable read access for all users" ON machines;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON machines;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON machines;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON machines;

-- ADIM 3: company_id sütununu ekle (NULL olarak)
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS company_id UUID;

-- ADIM 4: Mevcut makinelere company_id ata
DO $$
DECLARE
    default_company_id UUID;
BEGIN
    -- İlk company'yi al
    SELECT id INTO default_company_id FROM companies LIMIT 1;

    -- Eğer company varsa, NULL olan makinelere ata
    IF default_company_id IS NOT NULL THEN
        UPDATE machines
        SET company_id = default_company_id
        WHERE company_id IS NULL;

        RAISE NOTICE '✅ % adet makineye company_id atandı', (SELECT COUNT(*) FROM machines WHERE company_id IS NOT NULL);
    ELSE
        RAISE NOTICE '⚠️ Hiç company bulunamadı, lütfen önce company ekleyin';
    END IF;
END $$;

-- ADIM 5: company_id'yi NOT NULL yap (eğer tüm kayıtlara atandıysa)
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM machines WHERE company_id IS NULL) = 0 THEN
        ALTER TABLE machines
        ALTER COLUMN company_id SET NOT NULL;

        -- Foreign key constraint ekle
        ALTER TABLE machines
        ADD CONSTRAINT fk_machines_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

        RAISE NOTICE '✅ company_id NOT NULL yapıldı ve foreign key eklendi';
    ELSE
        RAISE NOTICE '⚠️ Bazı makinelerde company_id NULL, lütfen önce tüm makinelere company atayın';
    END IF;
END $$;

-- ADIM 6: Index ekle
CREATE INDEX IF NOT EXISTS idx_machines_company ON machines(company_id);

-- ADIM 7: RLS'i tekrar aktif et
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- ADIM 8: Yeni RLS politikalarını ekle
CREATE POLICY "Users can view machines of their company"
    ON machines FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert machines for their company"
    ON machines FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update machines of their company"
    ON machines FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete machines of their company"
    ON machines FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- BAŞARI MESAJI
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE '✅ Machines tablosu başarıyla güncellendi!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Toplam makine: %', (SELECT COUNT(*) FROM machines);
    RAISE NOTICE 'company_id olan: %', (SELECT COUNT(*) FROM machines WHERE company_id IS NOT NULL);
    RAISE NOTICE 'company_id NULL: %', (SELECT COUNT(*) FROM machines WHERE company_id IS NULL);
    RAISE NOTICE '==============================================';
END $$;
