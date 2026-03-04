-- Sadece invoices ve waybills tablolarını oluştur
-- customer_companies ve suppliers zaten mevcut

-- Faturalar Tablosu (Invoices)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('sales', 'purchase')),
  customer_id UUID,
  supplier_id UUID,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, invoice_number)
);

-- İrsaliyeler Tablosu (Waybills)
CREATE TABLE IF NOT EXISTS waybills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  waybill_number VARCHAR(100) NOT NULL,
  waybill_type VARCHAR(20) NOT NULL CHECK (waybill_type IN ('outgoing', 'incoming')),
  customer_id UUID,
  supplier_id UUID,
  waybill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, waybill_number)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE INDEX IF NOT EXISTS idx_waybills_company_id ON waybills(company_id);
CREATE INDEX IF NOT EXISTS idx_waybills_customer_id ON waybills(customer_id);
CREATE INDEX IF NOT EXISTS idx_waybills_supplier_id ON waybills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_waybills_waybill_date ON waybills(waybill_date);
CREATE INDEX IF NOT EXISTS idx_waybills_status ON waybills(status);

-- Updated_at tetikleyicileri
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_waybills_updated_at ON waybills;
CREATE TRIGGER update_waybills_updated_at
  BEFORE UPDATE ON waybills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) Politikaları
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE waybills ENABLE ROW LEVEL SECURITY;

-- Invoices RLS Politikaları
DROP POLICY IF EXISTS "Users can view invoices from their company" ON invoices;
CREATE POLICY "Users can view invoices from their company" ON invoices
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert invoices for their company" ON invoices;
CREATE POLICY "Users can insert invoices for their company" ON invoices
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update invoices from their company" ON invoices;
CREATE POLICY "Users can update invoices from their company" ON invoices
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete invoices from their company" ON invoices;
CREATE POLICY "Users can delete invoices from their company" ON invoices
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Waybills RLS Politikaları
DROP POLICY IF EXISTS "Users can view waybills from their company" ON waybills;
CREATE POLICY "Users can view waybills from their company" ON waybills
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert waybills for their company" ON waybills;
CREATE POLICY "Users can insert waybills for their company" ON waybills
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update waybills from their company" ON waybills;
CREATE POLICY "Users can update waybills from their company" ON waybills
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete waybills from their company" ON waybills;
CREATE POLICY "Users can delete waybills from their company" ON waybills
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Yorum ekleyelim
COMMENT ON TABLE invoices IS 'Satış ve alış faturaları tablosu';
COMMENT ON TABLE waybills IS 'Çıkış ve giriş irsaliyeleri tablosu';
