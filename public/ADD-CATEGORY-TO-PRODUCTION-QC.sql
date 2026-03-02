-- Üretim ve Kalite Kontrol tablolarına category (TEXT) kolonu ekle
-- Mevcut item_type değerlerinden kategori isimlerini oluştur

-- ========================================
-- 1️⃣ PRODUCTION_INVENTORY
-- ========================================

-- category kolonu ekle
ALTER TABLE production_inventory
ADD COLUMN IF NOT EXISTS category TEXT;

-- Mevcut item_type'lardan category'ye dönüştür
UPDATE production_inventory
SET category = CASE
    WHEN item_type = 'raw_material' THEN 'Hammadde'
    WHEN item_type = 'finished_product' THEN 'Bitmiş Ürün'
    WHEN item_type = 'scrap' THEN 'Fire/Hurda'
    ELSE 'Yarı Mamül'
END
WHERE category IS NULL;

-- ========================================
-- 2️⃣ QUALITY_CONTROL_INVENTORY
-- ========================================

-- category kolonu ekle (eğer tablo varsa)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quality_control_inventory') THEN
        ALTER TABLE quality_control_inventory
        ADD COLUMN IF NOT EXISTS category TEXT;

        -- Mevcut item_type'lardan category'ye dönüştür
        UPDATE quality_control_inventory
        SET category = CASE
            WHEN item_type = 'raw_material' THEN 'Hammadde'
            WHEN item_type = 'finished_product' THEN 'Bitmiş Ürün'
            WHEN item_type = 'scrap' THEN 'Fire/Hurda'
            ELSE 'Yarı Mamül'
        END
        WHERE category IS NULL;

        RAISE NOTICE '✓ quality_control_inventory tablosu güncellendi';
    ELSE
        RAISE NOTICE '⊘ quality_control_inventory tablosu bulunamadı (atlanıyor)';
    END IF;
END $$;

-- ========================================
-- ✅ BAŞARI MESAJI
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Üretim ve Kalite Kontrol tabloları güncellendi!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Değişiklikler:';
    RAISE NOTICE '   - production_inventory: category (TEXT) kolonu eklendi';
    RAISE NOTICE '   - quality_control_inventory: category (TEXT) kolonu eklendi';
    RAISE NOTICE '   - item_type değerleri category''ye dönüştürüldü:';
    RAISE NOTICE '     • raw_material → Hammadde';
    RAISE NOTICE '     • finished_product → Bitmiş Ürün';
    RAISE NOTICE '     • scrap → Fire/Hurda';
    RAISE NOTICE '     • (diğer) → Yarı Mamül';
    RAISE NOTICE '';
    RAISE NOTICE '⚙️  item_type kolonu korundu (geriye uyumluluk)';
    RAISE NOTICE '';
END $$;
