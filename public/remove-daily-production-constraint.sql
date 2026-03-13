-- =============================================
-- GÜNLÜK ÜRETİM UNIQUE CONSTRAINT KALDIRMA
-- =============================================
-- Aynı tezgah + proje + tarih + vardiya için
-- birden fazla kayıt girilebilmesini sağlar
-- =============================================

ALTER TABLE machine_daily_production
DROP CONSTRAINT IF EXISTS machine_daily_production_unique_shift;

-- Kontrol
SELECT
  '✅ Constraint kaldırıldı! Artık aynı tezgah için aynı gün birden fazla kayıt girebilirsiniz.' as message;
