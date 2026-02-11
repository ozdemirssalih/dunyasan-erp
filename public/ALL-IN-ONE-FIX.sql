-- ====================================
-- HER ŞEYİ TEK SEFERDE HALLEDELIM
-- ====================================
-- Bu SQL her durumu kontrol eder ve gerekeni yapar
-- ====================================

-- ADIM 0: Hangi tablolar var bakalım
DO $$
DECLARE
    machines_exists BOOLEAN;
    projects_exists BOOLEAN;
    companies_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'machines'
    ) INTO machines_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'projects'
    ) INTO projects_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'companies'
    ) INTO companies_exists;

    RAISE NOTICE '==============================================';
    RAISE NOTICE 'TABLO DURUMU:';
    RAISE NOTICE '  companies: %', CASE WHEN companies_exists THEN '✅ VAR' ELSE '❌ YOK' END;
    RAISE NOTICE '  machines: %', CASE WHEN machines_exists THEN '✅ VAR' ELSE '❌ YOK' END;
    RAISE NOTICE '  projects: %', CASE WHEN projects_exists THEN '✅ VAR' ELSE '❌ YOK' END;
    RAISE NOTICE '==============================================';
END $$;

-- ====================================
-- ADIM 1: MACHINES TABLOSUNU DÜZELT
-- ====================================

-- RLS'i kapat (hata alırsa devam et)
DO $$
BEGIN
    ALTER TABLE machines DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ Machines RLS kapatıldı';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ℹ️ Machines RLS zaten kapalı veya tablo yok';
END $$;

-- Tüm RLS politikalarını sil
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'machines'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON machines', pol.policyname);
        RAISE NOTICE '🗑️ Silindi: %', pol.policyname;
    END LOOP;
END $$;

-- company_id sütununu ekle (eğer yoksa)
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'machines'
          AND column_name = 'company_id'
    ) INTO column_exists;

    IF NOT column_exists THEN
        ALTER TABLE machines ADD COLUMN company_id UUID;
        RAISE NOTICE '✅ machines.company_id sütunu eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ machines.company_id sütunu zaten var';
    END IF;
END $$;

-- NULL olanları doldur
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

-- NOT NULL yap
DO $$
DECLARE
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_count FROM machines WHERE company_id IS NULL;

    IF null_count = 0 THEN
        ALTER TABLE machines ALTER COLUMN company_id SET NOT NULL;
        RAISE NOTICE '✅ machines.company_id NOT NULL yapıldı';
    ELSE
        RAISE NOTICE '⚠️ % adet makinede hala NULL var', null_count;
    END IF;
END $$;

-- Foreign key ekle
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'machines'
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name = 'machines_company_id_fkey'
    ) THEN
        ALTER TABLE machines
        ADD CONSTRAINT machines_company_id_fkey
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
        RAISE NOTICE '✅ machines.company_id foreign key eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ machines.company_id foreign key zaten var';
    END IF;
END $$;

-- Index ekle
CREATE INDEX IF NOT EXISTS idx_machines_company_id ON machines(company_id);

-- RLS'i aç ve politikaları ekle
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view machines of their company"
    ON machines FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert machines for their company"
    ON machines FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update machines of their company"
    ON machines FOR UPDATE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete machines of their company"
    ON machines FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DO $$
BEGIN
    RAISE NOTICE '✅ Machines RLS politikaları eklendi';
END $$;

-- ====================================
-- ADIM 2: PROJECTS TABLOSUNU GÜNCELLE
-- ====================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'entry_machine_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN entry_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ projects.entry_machine_id eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ projects.entry_machine_id zaten var';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'exit_machine_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN exit_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;
        RAISE NOTICE '✅ projects.exit_machine_id eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ projects.exit_machine_id zaten var';
    END IF;
END $$;

-- ====================================
-- ADIM 3: PROJECT_MACHINES TABLOSU
-- ====================================

CREATE TABLE IF NOT EXISTS project_machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    sequence_order INTEGER NOT NULL DEFAULT 0,
    daily_capacity_target INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_project_machines_project ON project_machines(project_id);
CREATE INDEX IF NOT EXISTS idx_project_machines_machine ON project_machines(machine_id);
CREATE INDEX IF NOT EXISTS idx_project_machines_company ON project_machines(company_id);

ALTER TABLE project_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project machines of their company" ON project_machines;
CREATE POLICY "Users can view project machines of their company"
    ON project_machines FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert project machines for their company" ON project_machines;
CREATE POLICY "Users can insert project machines for their company"
    ON project_machines FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update project machines of their company" ON project_machines;
CREATE POLICY "Users can update project machines of their company"
    ON project_machines FOR UPDATE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete project machines of their company" ON project_machines;
CREATE POLICY "Users can delete project machines of their company"
    ON project_machines FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DO $$
BEGIN
    RAISE NOTICE '✅ project_machines tablosu hazır';
END $$;

-- ====================================
-- ADIM 4: MACHINE_DAILY_PRODUCTION TABLOSU
-- ====================================

CREATE TABLE IF NOT EXISTS machine_daily_production (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    capacity_target INTEGER NOT NULL DEFAULT 0,
    actual_production INTEGER NOT NULL DEFAULT 0,
    defect_count INTEGER NOT NULL DEFAULT 0,
    efficiency_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN capacity_target > 0 THEN (actual_production::DECIMAL / capacity_target * 100)
            ELSE 0
        END
    ) STORED,
    shift TEXT,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(machine_id, project_id, production_date)
);

CREATE INDEX IF NOT EXISTS idx_machine_daily_production_date ON machine_daily_production(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_machine ON machine_daily_production(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_project ON machine_daily_production(project_id);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_company ON machine_daily_production(company_id);

ALTER TABLE machine_daily_production ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view production records of their company" ON machine_daily_production;
CREATE POLICY "Users can view production records of their company"
    ON machine_daily_production FOR SELECT
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert production records for their company" ON machine_daily_production;
CREATE POLICY "Users can insert production records for their company"
    ON machine_daily_production FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update production records of their company" ON machine_daily_production;
CREATE POLICY "Users can update production records of their company"
    ON machine_daily_production FOR UPDATE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete production records of their company" ON machine_daily_production;
CREATE POLICY "Users can delete production records of their company"
    ON machine_daily_production FOR DELETE
    USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DO $$
BEGIN
    RAISE NOTICE '✅ machine_daily_production tablosu hazır';
END $$;

-- ====================================
-- ADIM 5: FONKSIYONLAR
-- ====================================

CREATE OR REPLACE FUNCTION calculate_project_total_defects(
    p_project_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
    v_total_defects INTEGER;
BEGIN
    SELECT COALESCE(SUM(defect_count), 0)
    INTO v_total_defects
    FROM machine_daily_production
    WHERE project_id = p_project_id
      AND (p_start_date IS NULL OR production_date >= p_start_date)
      AND (p_end_date IS NULL OR production_date <= p_end_date);
    RETURN v_total_defects;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_machine_avg_efficiency(
    p_machine_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS DECIMAL LANGUAGE plpgsql AS $$
DECLARE
    v_avg_efficiency DECIMAL;
BEGIN
    SELECT COALESCE(AVG(efficiency_rate), 0)
    INTO v_avg_efficiency
    FROM machine_daily_production
    WHERE machine_id = p_machine_id
      AND production_date >= CURRENT_DATE - p_days;
    RETURN ROUND(v_avg_efficiency, 2);
END;
$$;

DO $$
BEGIN
    RAISE NOTICE '✅ Fonksiyonlar oluşturuldu';
END $$;

-- ====================================
-- BAŞARI MESAJI
-- ====================================

DO $$
DECLARE
    companies_count INTEGER;
    machines_count INTEGER;
    projects_count INTEGER;
    project_machines_count INTEGER;
    daily_production_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO companies_count FROM companies;
    SELECT COUNT(*) INTO machines_count FROM machines;
    SELECT COUNT(*) INTO projects_count FROM projects;
    SELECT COUNT(*) INTO project_machines_count FROM project_machines;
    SELECT COUNT(*) INTO daily_production_count FROM machine_daily_production;

    RAISE NOTICE '';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '🎉 TÜM SİSTEM HAZIR!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '📊 Veri Durumu:';
    RAISE NOTICE '  - Companies: %', companies_count;
    RAISE NOTICE '  - Machines: %', machines_count;
    RAISE NOTICE '  - Projects: %', projects_count;
    RAISE NOTICE '  - Project Machines: %', project_machines_count;
    RAISE NOTICE '  - Daily Production: %', daily_production_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tüm tablolar oluşturuldu';
    RAISE NOTICE '✅ Tüm RLS politikaları aktif';
    RAISE NOTICE '✅ Yardımcı fonksiyonlar hazır';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '🚀 SİSTEM KULLANIMA HAZIR!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '';
END $$;
