-- ============================================================
-- ÜRETİM AKIŞI MODÜLÜ - Tablolar
-- Rota şablonu + İş emri + Adım takibi (kabul/hurda/yeniden işlem)
-- ============================================================

-- 1. Rota şablonları (her ürün/parça için özel akış)
CREATE TABLE IF NOT EXISTS product_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  route_name VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_routes_company ON product_routes(company_id);
CREATE INDEX IF NOT EXISTS idx_product_routes_project ON product_routes(project_id);

-- 2. Rota adımları
CREATE TABLE IF NOT EXISTS product_route_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES product_routes(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  step_name VARCHAR(200) NOT NULL,
  step_type VARCHAR(30) NOT NULL DEFAULT 'operation',
  -- types: warehouse_in, qc_incoming, operation, qc_intermediate, qc_final, packaging, shipping
  station_name VARCHAR(100),
  is_qc_step BOOLEAN DEFAULT false,
  expected_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_route_steps_route ON product_route_steps(route_id);

-- 3. Üretim iş emirleri (yeni)
CREATE TABLE IF NOT EXISTS production_flow_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  project_id UUID REFERENCES projects(id),
  route_id UUID REFERENCES product_routes(id),
  customer_id UUID,
  customer_name VARCHAR(200),
  planned_quantity NUMERIC NOT NULL DEFAULT 0,
  warehouse_in_quantity NUMERIC DEFAULT 0,
  final_accepted_quantity NUMERIC DEFAULT 0,
  total_scrap_quantity NUMERIC DEFAULT 0,
  current_step_order INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'planned',
  -- planned, in_progress, on_hold, completed, cancelled
  priority VARCHAR(10) DEFAULT 'normal',
  -- low, normal, high, urgent
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date TIMESTAMPTZ,
  actual_end_date TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pfo_company ON production_flow_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_pfo_status ON production_flow_orders(status);
CREATE INDEX IF NOT EXISTS idx_pfo_project ON production_flow_orders(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pfo_company_order_number ON production_flow_orders(company_id, order_number);

-- 4. Adım kayıtları (her adım için giriş/kabul/hurda/yeniden işlem + QC sonucu)
CREATE TABLE IF NOT EXISTS production_flow_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES production_flow_orders(id) ON DELETE CASCADE,
  route_step_id UUID REFERENCES product_route_steps(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  step_name VARCHAR(200) NOT NULL,
  step_type VARCHAR(30) DEFAULT 'operation',
  station_name VARCHAR(100),
  in_quantity NUMERIC DEFAULT 0,
  accepted_quantity NUMERIC DEFAULT 0,
  scrap_quantity NUMERIC DEFAULT 0,
  rework_quantity NUMERIC DEFAULT 0,
  operator_id UUID,
  operator_name VARCHAR(200),
  machine_id UUID,
  machine_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  -- pending, in_progress, completed, on_hold
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  qc_result VARCHAR(20),
  -- pass, fail, partial
  scrap_reason TEXT,
  scrap_destination VARCHAR(30),
  -- warehouse_reject, non_compliant
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pfsl_order ON production_flow_step_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_pfsl_status ON production_flow_step_logs(status);

-- ============================================================
-- RLS (company_id bazlı izolasyon)
-- ============================================================
ALTER TABLE product_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_route_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_flow_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_flow_step_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pr_company_isolation" ON product_routes;
CREATE POLICY "pr_company_isolation" ON product_routes FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "prs_company_isolation" ON product_route_steps;
CREATE POLICY "prs_company_isolation" ON product_route_steps FOR ALL USING (
  route_id IN (SELECT id FROM product_routes WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
);

DROP POLICY IF EXISTS "pfo_company_isolation" ON production_flow_orders;
CREATE POLICY "pfo_company_isolation" ON production_flow_orders FOR ALL USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "pfsl_company_isolation" ON production_flow_step_logs;
CREATE POLICY "pfsl_company_isolation" ON production_flow_step_logs FOR ALL USING (
  order_id IN (SELECT id FROM production_flow_orders WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
);

SELECT 'Üretim Akış tabloları oluşturuldu!' as mesaj;
