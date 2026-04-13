-- ============================================================
-- SATINALMA TAKİP TABLOSU
-- ============================================================

CREATE TABLE IF NOT EXISTS purchasing_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  sira_no SERIAL,
  siparis_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
  firma_adi VARCHAR(255) NOT NULL,
  satinalma_sorumlusu VARCHAR(255),
  parca_kodu VARCHAR(100),
  po_numarasi VARCHAR(100),
  malzeme_talep_no VARCHAR(100),
  satinalma_teklif_no VARCHAR(100),
  fiyat DECIMAL(12,2),
  siparis_detayi TEXT,
  miktar DECIMAL(10,2),
  sevk_irsaliye_no VARCHAR(100),
  fatura_numarasi VARCHAR(100),
  satinalma_onay BOOLEAN DEFAULT FALSE,
  satinalma_red BOOLEAN DEFAULT FALSE,
  aciklama TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS POLİCİES
-- ============================================================

ALTER TABLE purchasing_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view purchasing tracking for their company"
  ON purchasing_tracking FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert purchasing tracking for their company"
  ON purchasing_tracking FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update purchasing tracking for their company"
  ON purchasing_tracking FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete purchasing tracking for their company"
  ON purchasing_tracking FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_purchasing_tracking_company ON purchasing_tracking(company_id);
CREATE INDEX IF NOT EXISTS idx_purchasing_tracking_firma ON purchasing_tracking(firma_adi);
CREATE INDEX IF NOT EXISTS idx_purchasing_tracking_po ON purchasing_tracking(po_numarasi);
CREATE INDEX IF NOT EXISTS idx_purchasing_tracking_tarih ON purchasing_tracking(siparis_tarihi);
CREATE INDEX IF NOT EXISTS idx_purchasing_tracking_onay ON purchasing_tracking(satinalma_onay);

-- ============================================================
-- TAMAMLANDI
-- ============================================================
