-- ============================================================
-- TAKIM - TEZGAH TESLİMAT SİSTEMİ
-- Dünyasan ERP | 2026
-- ============================================================

-- Eski zimmette sistemini kaldır
DROP TABLE IF EXISTS tool_checkouts CASCADE;

-- Yeni teslim tablosu
CREATE TABLE IF NOT EXISTS tool_machine_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tool_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_tool_machine_deliveries_company ON tool_machine_deliveries(company_id);
CREATE INDEX IF NOT EXISTS idx_tool_machine_deliveries_tool ON tool_machine_deliveries(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_machine_deliveries_machine ON tool_machine_deliveries(machine_id);
CREATE INDEX IF NOT EXISTS idx_tool_machine_deliveries_date ON tool_machine_deliveries(delivered_at DESC);

-- RLS Politikaları
ALTER TABLE tool_machine_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tool deliveries for their company" ON tool_machine_deliveries;
CREATE POLICY "Users can view tool deliveries for their company"
  ON tool_machine_deliveries FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert tool deliveries for their company" ON tool_machine_deliveries;
CREATE POLICY "Users can insert tool deliveries for their company"
  ON tool_machine_deliveries FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update tool deliveries for their company" ON tool_machine_deliveries;
CREATE POLICY "Users can update tool deliveries for their company"
  ON tool_machine_deliveries FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete tool deliveries for their company" ON tool_machine_deliveries;
CREATE POLICY "Users can delete tool deliveries for their company"
  ON tool_machine_deliveries FOR DELETE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- TAMAMLANDI
-- ============================================================
