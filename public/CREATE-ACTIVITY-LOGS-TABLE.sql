-- AKTİVİTE LOG KAYITLARI TABLOSU
-- ===================================

-- Önce mevcut tabloyu sil (varsa)
DROP TABLE IF EXISTS activity_logs CASCADE;

-- Aktivite log kayıtları tablosu
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Kullanıcı Bilgileri
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name VARCHAR(255),
  user_email VARCHAR(255),

  -- İşlem Bilgileri
  action_type VARCHAR(50) NOT NULL, -- create, update, delete, login, logout, view, export
  module VARCHAR(50) NOT NULL, -- accounting, warehouse, production, hrm, customers, etc.
  entity_type VARCHAR(50), -- invoice, waybill, product, employee, etc.
  entity_id UUID, -- İlgili kaydın ID'si

  -- Detaylar
  description TEXT NOT NULL, -- "Yeni fatura oluşturuldu: #INV-001"
  old_values JSONB, -- Değişiklik öncesi değerler
  new_values JSONB, -- Değişiklik sonrası değerler

  -- Ek Bilgiler
  ip_address VARCHAR(45), -- IPv4 veya IPv6
  user_agent TEXT, -- Browser/device bilgisi

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler (hızlı sorgulama için)
CREATE INDEX idx_activity_logs_company ON activity_logs(company_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_action ON activity_logs(action_type);
CREATE INDEX idx_activity_logs_module ON activity_logs(module);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_company_created ON activity_logs(company_id, created_at DESC);

-- RLS Policies
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Sadece yöneticiler log kayıtlarını görebilir
CREATE POLICY "Admins can view activity logs"
  ON activity_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Sistem tarafından log kayıtları oluşturulabilir (authenticated kullanıcılar)
CREATE POLICY "Authenticated users can insert logs"
  ON activity_logs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Loglar silinemez (sadece görüntülenebilir)
-- CREATE POLICY "No one can delete logs" ON activity_logs FOR DELETE USING (false);

COMMENT ON TABLE activity_logs IS 'Sistem aktivite log kayıtları - tüm kullanıcı işlemleri';
COMMENT ON COLUMN activity_logs.action_type IS 'create, update, delete, login, logout, view, export';
COMMENT ON COLUMN activity_logs.module IS 'accounting, warehouse, production, hrm, customers, suppliers, etc.';
