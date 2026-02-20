-- ============================================================
-- GÜNLÜK ÜRETİM KAYITLARINA GİRİŞ VE ÇIKIŞ TEZGAHLARI EKLEME
-- Dünyasan ERP | 2026
-- ============================================================

-- machine_daily_production tablosuna giriş ve çıkış tezgahı kolonlarını ekle
ALTER TABLE machine_daily_production
  ADD COLUMN IF NOT EXISTS entry_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;

ALTER TABLE machine_daily_production
  ADD COLUMN IF NOT EXISTS exit_machine_id UUID REFERENCES machines(id) ON DELETE SET NULL;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_daily_production_entry_machine
  ON machine_daily_production(entry_machine_id);

CREATE INDEX IF NOT EXISTS idx_daily_production_exit_machine
  ON machine_daily_production(exit_machine_id);

-- ============================================================
-- TAMAMLANDI
-- ============================================================
