-- EN MİNİMAL VERSİYON
-- company_id referanslarını kaldırdım

-- 1. PROJECTS'E SÜTUNLAR EKLE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'entry_machine_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN entry_machine_id UUID;
        RAISE NOTICE '✅ projects.entry_machine_id eklendi';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'exit_machine_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN exit_machine_id UUID;
        RAISE NOTICE '✅ projects.exit_machine_id eklendi';
    END IF;
END $$;

-- 2. PROJECT_MACHINES TABLOSU (MİNİMAL)
CREATE TABLE IF NOT EXISTS project_machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    machine_id UUID NOT NULL,
    sequence_order INTEGER NOT NULL DEFAULT 0,
    daily_capacity_target INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, machine_id)
);

CREATE INDEX IF NOT EXISTS idx_project_machines_project ON project_machines(project_id);
CREATE INDEX IF NOT EXISTS idx_project_machines_machine ON project_machines(machine_id);

-- 3. MACHINE_DAILY_PRODUCTION TABLOSU (MİNİMAL)
CREATE TABLE IF NOT EXISTS machine_daily_production (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL,
    machine_id UUID NOT NULL,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(machine_id, project_id, production_date)
);

CREATE INDEX IF NOT EXISTS idx_machine_daily_production_date ON machine_daily_production(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_machine ON machine_daily_production(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_project ON machine_daily_production(project_id);

-- 4. FONKSIYONLAR
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

-- BAŞARI MESAJI
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '✅ TABLOLAR OLUŞTURULDU!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '  ✓ projects: entry_machine_id, exit_machine_id';
    RAISE NOTICE '  ✓ project_machines';
    RAISE NOTICE '  ✓ machine_daily_production';
    RAISE NOTICE '  ✓ Fonksiyonlar';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ NOT: company_id foreign key yok (manuel eklenebilir)';
    RAISE NOTICE '⚠️ NOT: RLS politikaları yok (manuel eklenebilir)';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 SİSTEM KULLANIMA HAZIR!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE '';
END $$;
