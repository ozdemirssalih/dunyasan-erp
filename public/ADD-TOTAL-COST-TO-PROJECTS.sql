-- ============================================================
-- projects TABLOSUNA TOPLAM MALİYET HESAPLAMA KOLONLARI EKLE
-- ============================================================

-- Son hesaplanan toplam kesici maliyeti
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS last_calculated_total_cost DECIMAL(10,2);

-- Son hesaplanan parça başı toplam maliyet
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS last_calculated_unit_cost DECIMAL(10,4);

-- Son hesaplama yapılan sipariş adedi
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS last_order_quantity INTEGER;

-- Son maliyet hesaplama tarihi
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS last_cost_calculation_date TIMESTAMPTZ;

-- ============================================================
-- TAMAMLANDI
-- ============================================================
