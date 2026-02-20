-- ============================================================
-- project_machines KOLON İSİMLERİNİ DÜZELT
-- sequence_order -> display_order
-- daily_capacity_target ekle (eğer yoksa)
-- notes ekle (eğer yoksa)
-- ============================================================

-- 1. sequence_order kolonunu display_order olarak yeniden adlandır
ALTER TABLE project_machines
  RENAME COLUMN sequence_order TO display_order;

-- 2. daily_capacity_target kolonu ekle (eğer yoksa)
ALTER TABLE project_machines
  ADD COLUMN IF NOT EXISTS daily_capacity_target INTEGER;

-- 3. notes kolonu ekle (eğer yoksa)
ALTER TABLE project_machines
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- TAMAMLANDI
-- ============================================================
