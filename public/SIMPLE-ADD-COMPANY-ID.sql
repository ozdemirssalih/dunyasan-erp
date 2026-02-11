-- BASİT: machines tablosuna company_id ekle

-- Adım 1: Önce column var mı diye kontrol et, yoksa ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'machines' AND column_name = 'company_id'
    ) THEN
        -- company_id yoksa ekle (önce NULL)
        ALTER TABLE machines ADD COLUMN company_id UUID;
        RAISE NOTICE '✅ company_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ company_id sütunu zaten var';
    END IF;
END $$;

-- Adım 2: NULL olanları doldur
DO $$
DECLARE
    first_company UUID;
BEGIN
    SELECT id INTO first_company FROM companies LIMIT 1;

    IF first_company IS NOT NULL THEN
        UPDATE machines
        SET company_id = first_company
        WHERE company_id IS NULL;
        RAISE NOTICE '✅ % adet makineye company_id atandı', (SELECT COUNT(*) FROM machines WHERE company_id = first_company);
    END IF;
END $$;

-- Adım 3: NOT NULL yap (eğer hiç NULL yoksa)
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM machines WHERE company_id IS NULL) = 0 THEN
        ALTER TABLE machines ALTER COLUMN company_id SET NOT NULL;
        RAISE NOTICE '✅ company_id NOT NULL yapıldı';
    ELSE
        RAISE NOTICE '⚠️ Bazı makinelerde hala NULL var';
    END IF;
END $$;

-- Adım 4: Foreign key ekle (eğer yoksa)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'machines' AND constraint_name = 'machines_company_id_fkey'
    ) THEN
        ALTER TABLE machines
        ADD CONSTRAINT machines_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ Foreign key eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ Foreign key zaten var';
    END IF;
END $$;

-- Adım 5: Index ekle
CREATE INDEX IF NOT EXISTS idx_machines_company_id ON machines(company_id);

RAISE NOTICE '==============================================';
RAISE NOTICE '✅ İŞLEM TAMAMLANDI';
RAISE NOTICE '==============================================';
