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

-- 3. Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ warehouse_items tablosuna category (TEXT) kolonu eklendi!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Artık:';
    RAISE NOTICE '   - category kolonu sabit listeden seçilen değeri saklar';
    RAISE NOTICE '   - category_id kolonu opsiyonel (geriye uyumluluk için)';
    RAISE NOTICE '';
END $$;
