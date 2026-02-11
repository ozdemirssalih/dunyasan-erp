-- RLS OLMADAN sadece tabloları oluştur
-- RLS'i sonra manuel eklersin

-- ====================================
-- 1. PROJECTS TABLOSUNU GÜNCELLE
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
-- 2. PROJECT_MACHINES TABLOSU (RLS YOK)
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

-- RLS'i şimdilik kapalı tut
ALTER TABLE project_machines DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    RAISE NOTICE '✅ project_machines tablosu oluşturuldu (RLS kapalı)';
END $$;

-- ====================================
-- 3. MACHINE_DAILY_PRODUCTION TABLOSU (RLS YOK)
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
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(machine_id, project_id, production_date)
);

CREATE INDEX IF NOT EXISTS idx_machine_daily_production_date ON machine_daily_production(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_machine ON machine_daily_production(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_project ON machine_daily_production(project_id);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_company ON machine_daily_production(company_id);

-- RLS'i şimdilik kapalı tut
ALTER TABLE machine_daily_production DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    RAISE NOTICE '✅ machine_daily_production tablosu oluşturuldu (RLS kapalı)';
END $$;

-- ====================================
-- 4. FONKSIYONLAR
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

-- ====================================
-- BAŞARI MESAJI
-- ====================================

DO $$
DECLARE
    projects_count INTEGER;
    project_machines_count INTEGER;
    daily_production_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO projects_count FROM projects;
    SELECT COUNT(*) INTO project_machines_count FROM project_machines;
    SELECT COUNT(*) INTO daily_production_count FROM machine_daily_production;

    RAISE NOTICE '';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '✅ TABLOLAR OLUŞTURULDU!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '📋 Tablolar:';
    RAISE NOTICE '  ✓ projects: entry_machine_id, exit_machine_id';
    RAISE NOTICE '  ✓ project_machines: Oluşturuldu';
    RAISE NOTICE '  ✓ machine_daily_production: Oluşturuldu';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ RLS POLİTİKALARI KAPALI';
    RAISE NOTICE '   (Şimdilik güvenlik devre dışı, sonra ekleyebilirsiniz)';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Mevcut Veriler:';
    RAISE NOTICE '  - Toplam Proje: %', projects_count;
    RAISE NOTICE '  - Ara Tezgah İlişkisi: %', project_machines_count;
    RAISE NOTICE '  - Günlük Üretim Kaydı: %', daily_production_count;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 SİSTEM KULLANIMA HAZIR!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '';
END $$;
