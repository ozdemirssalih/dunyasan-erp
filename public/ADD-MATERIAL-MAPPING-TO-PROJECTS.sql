-- Proje parçalarına hammadde ve mamül bağlantısı ekle
-- Bu sayede proje seçilince otomatik olarak hammadde ve mamül seçili gelecek

-- 1. project_parts tablosuna hammadde ve mamül kolonları ekle
ALTER TABLE project_parts
ADD COLUMN IF NOT EXISTS raw_material_id UUID REFERENCES warehouse_items(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS finished_product_id UUID REFERENCES warehouse_items(id) ON DELETE SET NULL;

-- 2. İndeksler oluştur (performans için)
CREATE INDEX IF NOT EXISTS idx_project_parts_raw_material
ON project_parts(raw_material_id);

CREATE INDEX IF NOT EXISTS idx_project_parts_finished_product
ON project_parts(finished_product_id);

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Proje parçalarına hammadde-mamül bağlantısı eklendi!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Eklenen kolonlar:';
    RAISE NOTICE '   ✓ raw_material_id - Kullanılacak hammadde';
    RAISE NOTICE '   ✓ finished_product_id - Üretilecek mamül';
    RAISE NOTICE '';
    RAISE NOTICE '💡 Kullanım: Proje parçası oluştururken hammadde ve mamülü seçin.';
    RAISE NOTICE '   Üretim kaydında proje seçilince otomatik dolacak!';
END $$;
