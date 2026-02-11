-- MACHINES tablosunu sıfırdan oluştur (eğer yoksa) veya company_id ekle

-- ADIM 1: Mevcut durumu kontrol et
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'machines') THEN
        RAISE NOTICE '✅ Machines tablosu mevcut';
    ELSE
        RAISE NOTICE '⚠️ Machines tablosu bulunamadı, oluşturulacak';
    END IF;
END $$;

-- ADIM 2: Eğer machines tablosu yoksa oluştur
CREATE TABLE IF NOT EXISTS machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    machine_code TEXT NOT NULL,
    machine_name TEXT NOT NULL,
    machine_type TEXT,
    model TEXT,
    manufacturer TEXT,
    serial_number TEXT,
    purchase_date DATE,
    installation_date DATE,
    location TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'offline', 'retired')),
    capacity_per_hour DECIMAL(10,2),
    power_consumption DECIMAL(10,2),
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(company_id, machine_code)
);

-- ADIM 3: Eğer machines tablosu varsa ama company_id yoksa, ekle
DO $$
BEGIN
    -- company_id sütunu var mı kontrol et
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'machines' AND column_name = 'company_id'
    ) THEN
        RAISE NOTICE '⚠️ company_id sütunu yok, ekleniyor...';

        -- company_id ekle (önce NULL olarak)
        ALTER TABLE machines ADD COLUMN company_id UUID;

        -- Mevcut kayıtlara default company ata
        UPDATE machines
        SET company_id = (SELECT id FROM companies LIMIT 1)
        WHERE company_id IS NULL;

        -- NOT NULL yap
        ALTER TABLE machines ALTER COLUMN company_id SET NOT NULL;

        -- Foreign key ekle
        ALTER TABLE machines
        ADD CONSTRAINT fk_machines_company
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

        RAISE NOTICE '✅ company_id sütunu başarıyla eklendi';
    ELSE
        RAISE NOTICE '✅ company_id sütunu zaten mevcut';
    END IF;
END $$;

-- ADIM 4: Index'leri ekle
CREATE INDEX IF NOT EXISTS idx_machines_company ON machines(company_id);
CREATE INDEX IF NOT EXISTS idx_machines_project ON machines(project_id);
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);

-- ADIM 5: RLS politikalarını temizle ve yeniden oluştur
ALTER TABLE machines DISABLE ROW LEVEL SECURITY;

-- Tüm eski politikaları sil
DROP POLICY IF EXISTS "Users can view machines of their company" ON machines;
DROP POLICY IF EXISTS "Users can insert machines for their company" ON machines;
DROP POLICY IF EXISTS "Users can update machines of their company" ON machines;
DROP POLICY IF EXISTS "Users can delete machines of their company" ON machines;
DROP POLICY IF EXISTS "Enable read access for all users" ON machines;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON machines;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON machines;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON machines;

-- RLS'i aktif et
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Yeni politikaları ekle
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
DECLARE
    machine_count INTEGER;
    company_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO machine_count FROM machines;
    SELECT COUNT(*) INTO company_count FROM companies;

    RAISE NOTICE '==============================================';
    RAISE NOTICE '✅ MACHINES TABLOSU HAZIR!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Toplam Company: %', company_count;
    RAISE NOTICE 'Toplam Machine: %', machine_count;
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Şimdi UPDATE-PROJECTS-MACHINES.sql çalıştırabilirsiniz';
    RAISE NOTICE '==============================================';
END $$;
