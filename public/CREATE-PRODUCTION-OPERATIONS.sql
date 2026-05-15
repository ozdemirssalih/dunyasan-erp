-- Üretim planı operasyonları tablosu
CREATE TABLE IF NOT EXISTS production_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,

  sira INTEGER NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  machine_id UUID REFERENCES machines(id),
  machine_name VARCHAR(255),
  responsible VARCHAR(255),
  estimated_duration INTEGER, -- dakika
  actual_duration INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, skipped
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE production_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_sel" ON production_operations FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "po_ins" ON production_operations FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "po_upd" ON production_operations FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "po_del" ON production_operations FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_prod_ops_plan ON production_operations(plan_id);
SELECT 'production_operations tablosu oluşturuldu!' as mesaj;
