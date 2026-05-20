-- production_plans tablosunu sıfırdan oluştur
DROP TABLE IF EXISTS production_operations;
DROP TABLE IF EXISTS production_plans;

CREATE TABLE production_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID,
  project_name VARCHAR(255),
  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(100),
  quantity INTEGER DEFAULT 0,
  completed_quantity INTEGER DEFAULT 0,
  machine_id UUID,
  machine_name VARCHAR(255),
  priority VARCHAR(20) DEFAULT 'normal',
  status VARCHAR(20) DEFAULT 'planned',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE production_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
  sira INTEGER NOT NULL,
  operation_name VARCHAR(255) NOT NULL,
  machine_id UUID,
  machine_name VARCHAR(255),
  responsible VARCHAR(255),
  estimated_duration INTEGER,
  actual_duration INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pp_sel" ON production_plans FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "pp_ins" ON production_plans FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "pp_upd" ON production_plans FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "pp_del" ON production_plans FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "po_sel" ON production_operations FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "po_ins" ON production_operations FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "po_upd" ON production_operations FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "po_del" ON production_operations FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

SELECT 'production_plans ve production_operations tabloları oluşturuldu!' as mesaj;
