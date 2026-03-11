-- Önce mevcut tabloyu sil (varsa)
DROP TABLE IF EXISTS checks CASCADE;

-- Çek Takip Tablosu
CREATE TABLE checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Çek Bilgileri
  check_number VARCHAR(100) NOT NULL,
  check_type VARCHAR(20) NOT NULL CHECK (check_type IN ('incoming', 'outgoing')), -- gelen_cek, giden_cek

  -- Tutar Bilgileri
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'TRY',

  -- Tarih Bilgileri
  check_date DATE NOT NULL, -- Çek tarihi
  due_date DATE NOT NULL, -- Vade tarihi

  -- İlişkili Bilgiler
  customer_id UUID, -- Gelen çek için - Foreign key sonra eklenecek
  supplier_id UUID, -- Giden çek için - Foreign key sonra eklenecek

  -- Durum
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'paid', 'bounced', 'cancelled')),
  -- pending: beklemede
  -- collected: tahsil edildi (gelen çek)
  -- paid: ödendi (giden çek)
  -- bounced: karşılıksız
  -- cancelled: iptal edildi

  -- Ek Bilgiler
  document_url TEXT, -- Çek PDF belgesi
  endorsee VARCHAR(255), -- Ciro edilen kişi/firma
  description TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- İndeksler
CREATE INDEX idx_checks_company ON checks(company_id);
CREATE INDEX idx_checks_type ON checks(check_type);
CREATE INDEX idx_checks_status ON checks(status);
CREATE INDEX idx_checks_due_date ON checks(due_date);
CREATE INDEX idx_checks_customer ON checks(customer_id);
CREATE INDEX idx_checks_supplier ON checks(supplier_id);

-- RLS Policies
ALTER TABLE checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checks in their company"
  ON checks FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert checks in their company"
  ON checks FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update checks in their company"
  ON checks FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete checks in their company"
  ON checks FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_checks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER checks_updated_at
  BEFORE UPDATE ON checks
  FOR EACH ROW
  EXECUTE FUNCTION update_checks_updated_at();

COMMENT ON TABLE checks IS 'Çek takip tablosu - gelen ve giden çeklerin yönetimi';
COMMENT ON COLUMN checks.check_type IS 'incoming: gelen çek, outgoing: giden çek';
COMMENT ON COLUMN checks.status IS 'pending: beklemede, collected: tahsil edildi, paid: ödendi, bounced: karşılıksız, cancelled: iptal';

-- Foreign key'leri sonra ekle (customers ve suppliers tabloları varsa)
-- ALTER TABLE checks ADD CONSTRAINT fk_checks_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
-- ALTER TABLE checks ADD CONSTRAINT fk_checks_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
