-- İş Emri Tablosu
CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  parca_no VARCHAR(100),
  parca_adi VARCHAR(255) NOT NULL,
  project_id UUID,
  project_name VARCHAR(255),
  iem_no VARCHAR(100),
  revizyon_no VARCHAR(50),
  fai VARCHAR(100),
  seri VARCHAR(100),
  delta_fai VARCHAR(100),
  customer_id UUID,
  customer_name VARCHAR(255),
  dosya_no VARCHAR(100),
  planlanan_miktar INTEGER DEFAULT 0,
  teslim_tarihi DATE,
  malzeme VARCHAR(255),
  alasim_spec TEXT,
  operasyon_no VARCHAR(100),
  is_merkezi VARCHAR(255),
  uygun_miktar INTEGER DEFAULT 0,
  ret_miktar INTEGER DEFAULT 0,
  uygunsuzluk_no VARCHAR(100),
  ekipman VARCHAR(255),
  baslama_tarihi DATE,
  bitis_tarihi DATE,
  dogrulama BOOLEAN DEFAULT FALSE,
  dogrulayan VARCHAR(255),
  dogrulama_tarihi TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'draft',
  notes TEXT,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wo_sel" ON work_orders FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "wo_ins" ON work_orders FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "wo_upd" ON work_orders FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "wo_del" ON work_orders FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_work_orders_company ON work_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_iem ON work_orders(iem_no);

SELECT 'work_orders tablosu oluşturuldu!' as mesaj;
