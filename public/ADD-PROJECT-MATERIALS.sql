-- Proje-Malzeme İlişki Tablosu
-- Bu tablo projelerde kullanılacak malzemeleri takip eder

-- Önce mevcut tabloyu sil (varsa)
DROP TABLE IF EXISTS project_materials CASCADE;

-- Yeni tablo oluştur
CREATE TABLE project_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  warehouse_item_id UUID NOT NULL REFERENCES warehouse_items(id) ON DELETE CASCADE,
  required_quantity DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, warehouse_item_id)
);

-- Index'ler
CREATE INDEX idx_project_materials_project_id ON project_materials(project_id);
CREATE INDEX idx_project_materials_warehouse_item_id ON project_materials(warehouse_item_id);

-- RLS Policies
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;

-- SELECT policy
CREATE POLICY "Users can view their company's project materials"
  ON project_materials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = project_materials.project_id
      AND pr.id = auth.uid()
    )
  );

-- INSERT policy
CREATE POLICY "Users can insert project materials for their company"
  ON project_materials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = project_materials.project_id
      AND pr.id = auth.uid()
    )
  );

-- UPDATE policy
CREATE POLICY "Users can update their company's project materials"
  ON project_materials FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = project_materials.project_id
      AND pr.id = auth.uid()
    )
  );

-- DELETE policy
CREATE POLICY "Users can delete their company's project materials"
  ON project_materials FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      INNER JOIN profiles pr ON pr.company_id = p.company_id
      WHERE p.id = project_materials.project_id
      AND pr.id = auth.uid()
    )
  );
