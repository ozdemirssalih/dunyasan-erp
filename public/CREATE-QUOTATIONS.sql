-- ============================================================
-- FİYAT TEKLİFİ TABLOLARI
-- ============================================================

-- TEKLİFLER
CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  quotation_number VARCHAR(50) NOT NULL,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_days INTEGER DEFAULT 30,
  delivery_time VARCHAR(255),
  payment_terms VARCHAR(255),

  customer_id UUID REFERENCES customer_companies(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_contact VARCHAR(255),
  customer_phone VARCHAR(100),
  customer_email VARCHAR(255),
  customer_address TEXT,
  customer_tax_number VARCHAR(100),
  customer_tax_office VARCHAR(255),

  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  subtotal DECIMAL(14,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(14,2) DEFAULT 0,
  discount_rate DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(14,2) DEFAULT 0,
  grand_total DECIMAL(14,2) DEFAULT 0,

  notes TEXT,
  internal_notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- draft, sent, accepted, rejected, expired, revised

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(company_id, quotation_number)
);

-- TEKLİF KALEMLERİ
CREATE TABLE IF NOT EXISTS quotation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,

  sira INTEGER NOT NULL,
  parca_kodu VARCHAR(100),
  parca_adi VARCHAR(255) NOT NULL,
  malzeme TEXT,
  miktar DECIMAL(10,2) NOT NULL DEFAULT 1,
  birim VARCHAR(20) DEFAULT 'adet',
  birim_fiyat DECIMAL(14,2) NOT NULL DEFAULT 0,
  toplam_fiyat DECIMAL(14,2) NOT NULL DEFAULT 0,
  aciklama TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotations for their company"
  ON quotations FOR SELECT
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert quotations for their company"
  ON quotations FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update quotations for their company"
  ON quotations FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete quotations for their company"
  ON quotations FOR DELETE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotation items"
  ON quotation_items FOR SELECT
  USING (quotation_id IN (SELECT id FROM quotations WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can insert quotation items"
  ON quotation_items FOR INSERT
  WITH CHECK (quotation_id IN (SELECT id FROM quotations WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can update quotation items"
  ON quotation_items FOR UPDATE
  USING (quotation_id IN (SELECT id FROM quotations WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE POLICY "Users can delete quotation items"
  ON quotation_items FOR DELETE
  USING (quotation_id IN (SELECT id FROM quotations WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_quotations_company ON quotations(company_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(quotation_date);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);

-- ============================================================
-- TAMAMLANDI
-- ============================================================
