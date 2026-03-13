-- =============================================
-- GÜNLÜK ÜRETİME BİRDEN FAZLA PERSONEL EKLENEBİLMESİ
-- =============================================
-- machine_daily_production tablosuna employee_ids kolonu ekler
-- Birden fazla personel seçilebilmesini sağlar
-- =============================================

-- 1. employee_ids kolonu ekle (text array)
ALTER TABLE machine_daily_production
ADD COLUMN IF NOT EXISTS employee_ids TEXT[];

-- 2. Mevcut employee_id verilerini employee_ids array'ine kopyala
UPDATE machine_daily_production
SET employee_ids = ARRAY[employee_id]::TEXT[]
WHERE employee_id IS NOT NULL AND employee_ids IS NULL;

-- 3. Kolon açıklaması
COMMENT ON COLUMN machine_daily_production.employee_ids IS 'Tezgahta çalışan personellerin ID listesi (birden fazla olabilir)';

-- Başarı mesajı
SELECT
  '✅ Günlük üretim tablosuna employee_ids kolonu eklendi!' as message,
  'Artık her tezgah için birden fazla personel seçilebilir.' as details;

-- =============================================
-- NOT:
-- - Eski employee_id kolonu backward compatibility için korunuyor
-- - Yeni kayıtlar employee_ids array kullanacak
-- - Eski kayıtlar varsa employee_id'den employee_ids'ye kopyalanacak
-- =============================================
