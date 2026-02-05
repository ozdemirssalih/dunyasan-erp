-- DÜNYASAN ERP - Proje ve Üretim Entegrasyonu
-- Üretim kayıtlarını projelerle ilişkilendir

-- =====================================================
-- ADIM 1: Üretim tablolarına proje kolonları ekle
-- =====================================================

-- Hammadde atamalarına proje bilgisi ekle
ALTER TABLE production_material_assignments
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS project_part_id UUID REFERENCES project_parts(id) ON DELETE SET NULL;

-- Üretim çıktılarına proje bilgisi ekle
ALTER TABLE production_outputs
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS project_part_id UUID REFERENCES project_parts(id) ON DELETE SET NULL;

-- =====================================================
-- ADIM 2: İndeksler ekle
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_material_assignments_project ON production_material_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_material_assignments_part ON production_material_assignments(project_part_id);
CREATE INDEX IF NOT EXISTS idx_production_outputs_project ON production_outputs(project_id);
CREATE INDEX IF NOT EXISTS idx_production_outputs_part ON production_outputs(project_part_id);

-- =====================================================
-- ADIM 3: Proje bazlı raporlama için view'ler
-- =====================================================

-- Projedeki toplam hammadde kullanımı
CREATE OR REPLACE VIEW project_material_usage AS
SELECT
    p.id as project_id,
    p.project_name,
    pp.id as part_id,
    pp.part_name,
    wi.id as material_id,
    wi.name as material_name,
    wi.unit,
    SUM(pma.quantity) as total_used,
    COUNT(pma.id) as assignment_count
FROM projects p
LEFT JOIN project_parts pp ON pp.project_id = p.id
LEFT JOIN production_material_assignments pma ON pma.project_part_id = pp.id
LEFT JOIN warehouse_items wi ON wi.id = pma.item_id
WHERE pma.id IS NOT NULL
GROUP BY p.id, p.project_name, pp.id, pp.part_name, wi.id, wi.name, wi.unit;

-- Projedeki toplam üretim çıktıları
CREATE OR REPLACE VIEW project_production_outputs AS
SELECT
    p.id as project_id,
    p.project_name,
    pp.id as part_id,
    pp.part_name,
    wi.id as output_id,
    wi.name as output_name,
    wi.unit,
    SUM(po.quantity) as total_produced,
    COUNT(po.id) as production_count,
    m.machine_name,
    po.quality_status
FROM projects p
LEFT JOIN project_parts pp ON pp.project_id = p.id
LEFT JOIN production_outputs po ON po.project_part_id = pp.id
LEFT JOIN warehouse_items wi ON wi.id = po.output_item_id
LEFT JOIN machines m ON m.id = po.machine_id
WHERE po.id IS NOT NULL
GROUP BY p.id, p.project_name, pp.id, pp.part_name, wi.id, wi.name, wi.unit, m.machine_name, po.quality_status;

-- =====================================================
-- ADIM 4: Proje ilerleme fonksiyonu
-- =====================================================

-- Projenin üretim durumunu hesapla
CREATE OR REPLACE FUNCTION get_project_production_progress(project_uuid UUID)
RETURNS TABLE (
    part_id UUID,
    part_name TEXT,
    part_code TEXT,
    target_quantity INTEGER,
    produced_quantity DECIMAL,
    completion_percentage DECIMAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.id,
        pp.part_name,
        pp.part_code,
        pp.quantity as target_quantity,
        COALESCE(SUM(po.quantity), 0) as produced_quantity,
        ROUND((COALESCE(SUM(po.quantity), 0) / NULLIF(pp.quantity, 0)) * 100, 2) as completion_percentage
    FROM project_parts pp
    LEFT JOIN production_outputs po ON po.project_part_id = pp.id AND po.quality_status = 'approved'
    WHERE pp.project_id = project_uuid
    GROUP BY pp.id, pp.part_name, pp.part_code, pp.quantity
    ORDER BY pp.part_name;
END;
$$;

-- =====================================================
-- BAŞARI MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PROJE-ÜRETİM ENTEGRASYONU TAMAMLANDI!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔗 Eklenen Özellikler:';
    RAISE NOTICE '   ✓ Hammadde atamaları projeyle ilişkilendirildi';
    RAISE NOTICE '   ✓ Üretim çıktıları projeyle ilişkilendirildi';
    RAISE NOTICE '   ✓ Proje hammadde kullanımı view''ü oluşturuldu';
    RAISE NOTICE '   ✓ Proje üretim çıktıları view''ü oluşturuldu';
    RAISE NOTICE '   ✓ Proje ilerleme hesaplama fonksiyonu eklendi';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Artık şunları yapabilirsiniz:';
    RAISE NOTICE '   • Üretim yaparken proje seçebilirsiniz';
    RAISE NOTICE '   • Projede hangi hammaddeler kullanıldı görebilirsiniz';
    RAISE NOTICE '   • Projede ne kadar ürün üretildi takip edebilirsiniz';
    RAISE NOTICE '   • Proje bazlı üretim ilerleme raporları alabilirsiniz';
    RAISE NOTICE '';
END $$;
