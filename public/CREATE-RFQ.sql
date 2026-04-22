-- ============================================================
-- TEKLİF TALEBİ (RFQ) TABLOLARI
-- ============================================================

CREATE TABLE IF NOT EXISTS rfq (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  rfq_number VARCHAR(50) NOT NULL,
  rfq_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE,
  delivery_time VARCHAR(255),
  payment_terms VARCHAR(255),

  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(255) NOT NULL,
  supplier_contact VARCHAR(255),
  supplier_phone VARCHAR(100),
  supplier_email VARCHAR(255),
  supplier_address TEXT,

  currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
  notes TEXT,
  internal_notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- draft, sent, received, accepted, rejected, expired

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(company_id, rfq_number)
);

CREATE TABLE IF NOT EXISTS rfq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rfq_id UUID NOT NULL REFERENCES rfq(id) ON DELETE CASCADE,

  sira INTEGER NOT NULL,
  parca_kodu VARCHAR(100),
  parca_adi VARCHAR(255) NOT NULL,
  malzeme TEXT,
  miktar DECIMAL(10,2) NOT NULL DEFAULT 1,
  birim VARCHAR(20) DEFAULT 'adet',
  teknik_detay TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE rfq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rfq" ON rfq FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert rfq" ON rfq FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can update rfq" ON rfq FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can delete rfq" ON rfq FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE rfq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view rfq_items" ON rfq_items FOR SELECT USING (rfq_id IN (SELECT id FROM rfq WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Users can insert rfq_items" ON rfq_items FOR INSERT WITH CHECK (rfq_id IN (SELECT id FROM rfq WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Users can update rfq_items" ON rfq_items FOR UPDATE USING (rfq_id IN (SELECT id FROM rfq WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));
CREATE POLICY "Users can delete rfq_items" ON rfq_items FOR DELETE USING (rfq_id IN (SELECT id FROM rfq WHERE company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())));

CREATE INDEX IF NOT EXISTS idx_rfq_company ON rfq(company_id);
CREATE INDEX IF NOT EXISTS idx_rfq_supplier ON rfq(supplier_id);
CREATE INDEX IF NOT EXISTS idx_rfq_status ON rfq(status);
CREATE INDEX IF NOT EXISTS idx_rfq_items_rfq ON rfq_items(rfq_id);

SELECT 'RFQ tabloları oluşturuldu!' as mesaj;
