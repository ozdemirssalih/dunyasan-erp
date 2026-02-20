-- ============================================================
-- PROJE TEZGAH SİSTEMİNİ BASİTLEŞTİRME
-- Giriş/Ara/Çıkış mantığını kaldır -> Sadece "Tezgahlar"
-- Dünyasan ERP | 2026
-- ============================================================

-- 1. Yeni junction table: project_machines
CREATE TABLE IF NOT EXISTS project_machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, machine_id)
);

-- İndeks
CREATE INDEX IF NOT EXISTS idx_project_machines_project ON project_machines(project_id);
CREATE INDEX IF NOT EXISTS idx_project_machines_machine ON project_machines(machine_id);

-- RLS
ALTER TABLE project_machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project machines for their company" ON project_machines;
CREATE POLICY "Users can view project machines for their company"
  ON project_machines FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can insert project machines for their company" ON project_machines;
CREATE POLICY "Users can insert project machines for their company"
  ON project_machines FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can update project machines for their company" ON project_machines;
CREATE POLICY "Users can update project machines for their company"
  ON project_machines FOR UPDATE
  USING (project_id IN (
    SELECT id FROM projects WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can delete project machines for their company" ON project_machines;
CREATE POLICY "Users can delete project machines for their company"
  ON project_machines FOR DELETE
  USING (project_id IN (
    SELECT id FROM projects WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- 2. Projects tablosundan eski kolonları kaldır
ALTER TABLE projects DROP COLUMN IF EXISTS entry_machine_id;
ALTER TABLE projects DROP COLUMN IF EXISTS exit_machine_id;

-- 3. machine_daily_production tablosunu güncelle
-- Eski kolonları kaldır
ALTER TABLE machine_daily_production DROP COLUMN IF EXISTS entry_machine_id;
ALTER TABLE machine_daily_production DROP COLUMN IF EXISTS exit_machine_id;

-- Sadece machine_id kalsın (zaten var)

-- ============================================================
-- TAMAMLANDI
-- ============================================================
