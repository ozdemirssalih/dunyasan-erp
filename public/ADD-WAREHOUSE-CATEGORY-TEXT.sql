-- Warehouse items tablosuna category (TEXT) kolonu ekle
-- Artık category_id yerine direkt kategori adı saklanacak (sabit listeden)

-- 1. Yeni category kolonu ekle (TEXT, nullable)
ALTER TABLE warehouse_items
ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Mevcut category_id'lerden category isimlerini kopyala (eğer kategori tablosu varsa)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'warehouse_categories') THEN
        UPDATE warehouse_items wi
        SET category = wc.name
        FROM warehouse_categories wc
        WHERE wi.category_id = wc.id AND wi.category IS NULL;

        RAISE NOTICE '✓ Mevcut kategori isimleri kopyalandı';
    ELSE
        RAISE NOTICE '⊘ warehouse_categories tablosu bulunamadı (atlanıyor)';
    END IF;
END $$;

-- 3. category_id kolonunu NULLABLE yap (NOT NULL constraint'i kaldır)
ALTER TABLE warehouse_items
ALTER COLUMN category_id DROP NOT NULL;

RAISE NOTICE '✓ category_id artık nullable (opsiyonel)';

-- 4. Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ warehouse_items tablosu güncellendi!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Değişiklikler:';
    RAISE NOTICE '   - category (TEXT) kolonu eklendi - sabit listeden değer saklar';
    RAISE NOTICE '   - category_id artık NULLABLE - geriye uyumluluk için korundu';
    RAISE NOTICE '';
END $$;
