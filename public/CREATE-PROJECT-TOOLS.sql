-- ============================================================
-- PROJE - TAKIM İLİŞKİSİ (Maliyet Hesaplama için)
-- Dünyasan ERP | 2026
-- ============================================================

-- Proje takımları junction table
CREATE TABLE IF NOT EXISTS project_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  breakage_rate INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, tool_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_project_tools_project ON project_tools(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tools_tool ON project_tools(tool_id);

-- RLS Politikaları
ALTER TABLE project_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project tools for their company" ON project_tools;
CREATE POLICY "Users can view project tools for their company"
  ON project_tools FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = project_id
      AND pr.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert project tools for their company" ON project_tools;
CREATE POLICY "Users can insert project tools for their company"
  ON project_tools FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = project_id
      AND pr.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update project tools for their company" ON project_tools;
CREATE POLICY "Users can update project tools for their company"
  ON project_tools FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = project_id
      AND pr.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete project tools for their company" ON project_tools;
CREATE POLICY "Users can delete project tools for their company"
  ON project_tools FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = project_id
      AND pr.id = auth.uid()
    )
  );

-- ============================================================
-- TAMAMLANDI
-- ============================================================
