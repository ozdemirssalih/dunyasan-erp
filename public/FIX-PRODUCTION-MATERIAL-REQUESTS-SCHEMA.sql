-- =====================================================
-- DÜNYASAN ERP - production_material_requests ŞEMASINI DÜZELT
-- =====================================================
-- approved_by, approved_at kolonları ekleniyor
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '🔧 production_material_requests tablosu güncelleniyor...';
END $$;

-- approved_by kolonu ekle (eğer yoksa)
ALTER TABLE production_material_requests
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);

-- approved_at kolonu ekle (eğer yoksa)
ALTER TABLE production_material_requests
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Mevcut verileri kontrol et ve logla
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    -- approved_by kolonunu kontrol et
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'production_material_requests'
      AND column_name = 'approved_by';

    IF column_count > 0 THEN
        RAISE NOTICE '✅ approved_by kolonu mevcut';
    ELSE
        RAISE NOTICE '❌ approved_by kolonu EKLENEMEDİ!';
    END IF;

    -- approved_at kolonunu kontrol et
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'production_material_requests'
      AND column_name = 'approved_at';

    IF column_count > 0 THEN
        RAISE NOTICE '✅ approved_at kolonu mevcut';
    ELSE
        RAISE NOTICE '❌ approved_at kolonu EKLENEMEDİ!';
    END IF;
END $$;

-- RLS politikasını güncelle
DROP POLICY IF EXISTS "production_material_requests_all" ON production_material_requests;
CREATE POLICY "production_material_requests_all"
    ON production_material_requests
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TABLO ŞEMASI GÜNCELLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Eklenen Kolonlar:';
    RAISE NOTICE '   • approved_by (UUID → profiles)';
    RAISE NOTICE '   • approved_at (TIMESTAMP)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık onay işlemi çalışacak!';
    RAISE NOTICE '========================================';
END $$;

-- Tablo yapısını göster
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'production_material_requests'
ORDER BY ordinal_position;
