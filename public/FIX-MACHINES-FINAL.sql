-- STEP BY STEP: RLS kapat, company_id ekle, RLS aç

-- ADIM 1: RLS'i tamamen kapat
DO $$
BEGIN
    ALTER TABLE machines DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ RLS devre dışı bırakıldı';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ℹ️ RLS zaten kapalı veya tablo yok';
END $$;

-- ADIM 2: Tüm RLS politikalarını sil
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'machines'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON machines', pol.policyname);
        RAISE NOTICE '🗑️ Silindi: %', pol.policyname;
    END LOOP;
END $$;

-- ADIM 3: company_id sütununu ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'machines' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE machines ADD COLUMN company_id UUID;
        RAISE NOTICE '✅ company_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ company_id sütunu zaten var';
    END IF;
END $$;

-- ADIM 4: NULL olanları doldur
DO $$
DECLARE
    first_company UUID;
    updated_count INTEGER;
BEGIN
    SELECT id INTO first_company FROM companies LIMIT 1;

    IF first_company IS NOT NULL THEN
        UPDATE machines
        SET company_id = first_company
        WHERE company_id IS NULL;

        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE '✅ % adet makineye company_id atandı', updated_count;
    ELSE
        RAISE NOTICE '⚠️ Hiç company bulunamadı!';
    END IF;
END $$;

-- ADIM 5: NOT NULL yap (eğer hiç NULL yoksa)
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM machines WHERE company_id IS NULL;

    IF null_count = 0 THEN
        ALTER TABLE machines ALTER COLUMN company_id SET NOT NULL;
        RAISE NOTICE '✅ company_id NOT NULL yapıldı';
    ELSE
        RAISE NOTICE '⚠️ % adet makinede hala NULL var', null_count;
    END IF;
END $$;

-- ADIM 6: Foreign key ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'machines'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%company%'
    ) THEN
        ALTER TABLE machines
        ADD CONSTRAINT machines_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Foreign key eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ Foreign key zaten var';
    END IF;
END $$;

-- ADIM 7: Index ekle
CREATE INDEX IF NOT EXISTS idx_machines_company_id ON machines(company_id);

-- ADIM 8: RLS'i tekrar aç ve politikaları oluştur
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

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

-- ADIM 9: Final mesaj
DO $$
DECLARE
    total_machines INTEGER;
    total_companies INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_machines FROM machines;
    SELECT COUNT(*) INTO total_companies FROM companies;

    RAISE NOTICE '==============================================';
    RAISE NOTICE '✅ MACHINES TABLOSU HAZIR!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Toplam Company: %', total_companies;
    RAISE NOTICE 'Toplam Machine: %', total_machines;
    RAISE NOTICE 'RLS Politikaları: 4 adet (SELECT, INSERT, UPDATE, DELETE)';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'ŞİMDİ UPDATE-PROJECTS-MACHINES.SQL ÇALIŞTIR!';
    RAISE NOTICE '==============================================';
END $$;
