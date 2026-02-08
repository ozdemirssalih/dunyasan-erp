-- Proje-Malzeme İlişki Tablosu
-- Bu tablo projelerde kullanılacak malzemeleri takip eder

CREATE TABLE IF NOT EXISTS project_materials (
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
CREATE INDEX IF NOT EXISTS idx_project_materials_project_id ON project_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_project_materials_warehouse_item_id ON project_materials(warehouse_item_id);

-- RLS Policies
ALTER TABLE project_materials ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi şirketlerinin proje malzemelerini görebilir
CREATE POLICY "Users can view their company's project materials"
  ON project_materials FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Kullanıcılar kendi şirketlerinin projelerine malzeme ekleyebilir
CREATE POLICY "Users can insert project materials for their company"
  ON project_materials FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Kullanıcılar kendi şirketlerinin proje malzemelerini güncelleyebilir
CREATE POLICY "Users can update their company's project materials"
  ON project_materials FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Kullanıcılar kendi şirketlerinin proje malzemelerini silebilir
CREATE POLICY "Users can delete their company's project materials"
  ON project_materials FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
