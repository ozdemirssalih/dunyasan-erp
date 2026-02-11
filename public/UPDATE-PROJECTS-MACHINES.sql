-- Proje-Tezgah İlişkisi ve Günlük Üretim Takibi
-- 1. Projects tablosuna giriş/çıkış tezgahı sütunları ekle
-- 2. Ara tezgahlar için yeni tablo
-- 3. Günlük üretim takibi tablosu

-- ====================================
-- 1. PROJECTS TABLOSUNU GÜNCELLE
-- ====================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS entry_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS exit_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;

COMMENT ON COLUMN projects.entry_machine_id IS 'Hammadde giriş tezgahı (A1)';
COMMENT ON COLUMN projects.exit_machine_id IS 'Mamül çıkış tezgahı (A7)';

-- ====================================
-- 2. ARA TEZGAHLAR TABLOSU
-- ====================================

CREATE TABLE IF NOT EXISTS project_machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,

    -- Sıralama ve kapasite
    sequence_order INTEGER NOT NULL DEFAULT 0, -- İşlem sırası (1, 2, 3...)
    daily_capacity_target INTEGER, -- Günlük kapasite hedefi

    -- Notlar
    notes TEXT,

    -- Tarihler
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Benzersiz kısıt: Bir projede aynı tezgah birden fazla olamaz
    UNIQUE(project_id, machine_id)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_project_machines_project ON project_machines(project_id);
CREATE INDEX IF NOT EXISTS idx_project_machines_machine ON project_machines(machine_id);
CREATE INDEX IF NOT EXISTS idx_project_machines_company ON project_machines(company_id);

-- RLS politikaları
ALTER TABLE project_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project machines of their company" ON project_machines;
CREATE POLICY "Users can view project machines of their company"
    ON project_machines FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert project machines for their company" ON project_machines;
CREATE POLICY "Users can insert project machines for their company"
    ON project_machines FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update project machines of their company" ON project_machines;
CREATE POLICY "Users can update project machines of their company"
    ON project_machines FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete project machines of their company" ON project_machines;
CREATE POLICY "Users can delete project machines of their company"
    ON project_machines FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- ====================================
-- 3. GÜNLÜK ÜRETİM TAKİBİ TABLOSU
-- ====================================

CREATE TABLE IF NOT EXISTS machine_daily_production (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,

    -- Tarih
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Kapasite ve Üretim
    capacity_target INTEGER NOT NULL DEFAULT 0, -- Günlük kapasite hedefi
    actual_production INTEGER NOT NULL DEFAULT 0, -- Gerçekleşen üretim
    defect_count INTEGER NOT NULL DEFAULT 0, -- Fire/hatalı ürün sayısı

    -- Otomatik hesaplanan verimlilik
    efficiency_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN capacity_target > 0 THEN (actual_production::DECIMAL / capacity_target * 100)
            ELSE 0
        END
    ) STORED,

    -- Ek bilgiler
    shift TEXT, -- Vardiya (Gündüz/Gece)
    notes TEXT,

    -- Kayıt bilgileri
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Benzersiz kısıt: Bir tezgah için günde bir kayıt
    UNIQUE(machine_id, project_id, production_date)
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_date ON machine_daily_production(production_date DESC);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_machine ON machine_daily_production(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_project ON machine_daily_production(project_id);
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_company ON machine_daily_production(company_id);

-- RLS politikaları
ALTER TABLE machine_daily_production ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view production records of their company" ON machine_daily_production;
CREATE POLICY "Users can view production records of their company"
    ON machine_daily_production FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert production records for their company" ON machine_daily_production;
CREATE POLICY "Users can insert production records for their company"
    ON machine_daily_production FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update production records of their company" ON machine_daily_production;
CREATE POLICY "Users can update production records of their company"
    ON machine_daily_production FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete production records of their company" ON machine_daily_production;
CREATE POLICY "Users can delete production records of their company"
    ON machine_daily_production FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM profiles WHERE id = auth.uid()
        )
    );

-- ====================================
-- 4. YARDIMCI FONKSIYONLAR
-- ====================================

-- Proje için toplam fire hesaplama
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

-- Tezgah için ortalama verimlilik hesaplama
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
-- BAŞARILI MESAJI
-- ====================================

DO $$
BEGIN
    RAISE NOTICE '✅ Proje-Tezgah ilişkisi tabloları oluşturuldu!';
    RAISE NOTICE '📋 Tablolar:';
    RAISE NOTICE '  - projects: entry_machine_id, exit_machine_id eklendi';
    RAISE NOTICE '  - project_machines: Ara tezgahlar tablosu';
    RAISE NOTICE '  - machine_daily_production: Günlük üretim takibi';
    RAISE NOTICE '🔧 Fonksiyonlar:';
    RAISE NOTICE '  - calculate_project_total_defects()';
    RAISE NOTICE '  - calculate_machine_avg_efficiency()';
END $$;
