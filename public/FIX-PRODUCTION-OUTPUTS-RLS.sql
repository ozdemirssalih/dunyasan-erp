-- ============================================================
-- PRODUCTION_OUTPUTS & PRODUCTION_INVENTORY RLS DÜZELTMESİ
-- Silme ve güncelleme işlemlerini aktif etmek için
-- ============================================================

-- 1. production_outputs RLS
ALTER TABLE production_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view production_outputs" ON production_outputs;
CREATE POLICY "Users can view production_outputs"
  ON production_outputs FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert production_outputs" ON production_outputs;
CREATE POLICY "Users can insert production_outputs"
  ON production_outputs FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update production_outputs" ON production_outputs;
CREATE POLICY "Users can update production_outputs"
  ON production_outputs FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete production_outputs" ON production_outputs;
CREATE POLICY "Users can delete production_outputs"
  ON production_outputs FOR DELETE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- 2. production_inventory RLS
ALTER TABLE production_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view production_inventory" ON production_inventory;
CREATE POLICY "Users can view production_inventory"
  ON production_inventory FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert production_inventory" ON production_inventory;
CREATE POLICY "Users can insert production_inventory"
  ON production_inventory FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can update production_inventory" ON production_inventory;
CREATE POLICY "Users can update production_inventory"
  ON production_inventory FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete production_inventory" ON production_inventory;
CREATE POLICY "Users can delete production_inventory"
  ON production_inventory FOR DELETE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- ============================================================
-- TAMAMLANDI
-- ============================================================
SELECT 'production_outputs ve production_inventory RLS politikaları güncellendi!' as mesaj;
