-- Fire'yi dahil ederek verimlilik hesaplamasını düzelt
-- Sorun: efficiency_rate fire (defect_count) sayısını dikkate almıyor
-- Çözüm: Gerçek kullanılabilir üretim = actual_production - defect_count

-- 1. Mevcut computed column'u kaldır
ALTER TABLE machine_daily_production
DROP COLUMN IF EXISTS efficiency_rate;

-- 2. Yeni computed column'u fire dahil olarak ekle
ALTER TABLE machine_daily_production
ADD COLUMN efficiency_rate DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
        WHEN capacity_target > 0 THEN
            ((actual_production - COALESCE(defect_count, 0))::DECIMAL / capacity_target * 100)
        ELSE 0
    END
) STORED;

-- 3. Index'i yeniden oluştur
CREATE INDEX IF NOT EXISTS idx_machine_daily_production_efficiency
ON machine_daily_production(efficiency_rate DESC);

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Fire dahil verimlilik hesaplaması güncellendi!';
    RAISE NOTICE '   Formül: ((actual_production - defect_count) / capacity_target) * 100';
END $$;
