-- Gizli kasa hesaplama tabloları
CREATE TABLE IF NOT EXISTS calc_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  initial_balance DECIMAL(14,2) NOT NULL DEFAULT 0,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calc_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  deposit DECIMAL(14,2) NOT NULL DEFAULT 0,
  withdrawal DECIMAL(14,2) NOT NULL DEFAULT 0,
  commission DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance_after DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_commission DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE calc_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calc_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calc_settings_select" ON calc_settings FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "calc_settings_insert" ON calc_settings FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "calc_settings_update" ON calc_settings FOR UPDATE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "calc_entries_select" ON calc_entries FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "calc_entries_insert" ON calc_entries FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "calc_entries_delete" ON calc_entries FOR DELETE USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

SELECT 'Calc tabloları oluşturuldu!' as mesaj;
