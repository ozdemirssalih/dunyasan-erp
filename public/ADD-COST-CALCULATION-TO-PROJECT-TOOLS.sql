-- ============================================================
-- project_tools TABLOSUNA MALİYET HESAPLAMA KOLONLARI EKLE
-- ============================================================

-- Hesaplanan birim maliyet
ALTER TABLE project_tools
  ADD COLUMN IF NOT EXISTS calculated_unit_cost DECIMAL(10,2);

-- Son hesaplama tarihi
ALTER TABLE project_tools
  ADD COLUMN IF NOT EXISTS last_calculation_date TIMESTAMPTZ;

-- Hesaplama notları (opsiyonel)
ALTER TABLE project_tools
  ADD COLUMN IF NOT EXISTS calculation_notes TEXT;

-- ============================================================
-- TAMAMLANDI
-- ============================================================
