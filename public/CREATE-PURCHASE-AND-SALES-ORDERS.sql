-- ============================================================
-- SATIN ALMA VE SATIŞ SİPARİŞ TABLOLARI
-- ============================================================

-- SATIN ALMA SİPARİŞLERİ (Purchase Orders)
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

  order_number VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,

  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- draft, pending, approved, received, cancelled

  total_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(company_id, order_number)
);

-- SATIN ALMA SİPARİŞ DETAYLARI
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,

  item_type VARCHAR(20) NOT NULL, -- 'material', 'tool', 'other'
  item_id UUID, -- İlgili item'ın ID'si (materials, tools vb.)
  item_name VARCHAR(255) NOT NULL,
  item_code VARCHAR(100),

  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20),
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SATIŞ SİPARİŞLERİ (Sales Orders)
CREATE TABLE IF NOT EXISTS sales_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customer_companies(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  order_number VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,

  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- pending, confirmed, in_production, completed, cancelled

  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(100),
  quantity DECIMAL(10,2) NOT NULL,
  unit VARCHAR(20),
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(company_id, order_number)
);

-- ============================================================
-- RLS POLİCİES
-- ============================================================

-- Purchase Orders RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase orders for their company"
  ON purchase_orders FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert purchase orders for their company"
  ON purchase_orders FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update purchase orders for their company"
  ON purchase_orders FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete purchase orders for their company"
  ON purchase_orders FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Purchase Order Items RLS
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchase order items for their company"
  ON purchase_order_items FOR SELECT
  USING (purchase_order_id IN (
    SELECT id FROM purchase_orders WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert purchase order items for their company"
  ON purchase_order_items FOR INSERT
  WITH CHECK (purchase_order_id IN (
    SELECT id FROM purchase_orders WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can update purchase order items for their company"
  ON purchase_order_items FOR UPDATE
  USING (purchase_order_id IN (
    SELECT id FROM purchase_orders WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can delete purchase order items for their company"
  ON purchase_order_items FOR DELETE
  USING (purchase_order_id IN (
    SELECT id FROM purchase_orders WHERE company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  ));

-- Sales Orders RLS
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sales orders for their company"
  ON sales_orders FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert sales orders for their company"
  ON sales_orders FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update sales orders for their company"
  ON sales_orders FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete sales orders for their company"
  ON sales_orders FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_sales_orders_company ON sales_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_project ON sales_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(status);

-- ============================================================
-- TAMAMLANDI
-- ============================================================
