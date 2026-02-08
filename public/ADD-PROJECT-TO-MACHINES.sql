-- =====================================================
-- MACHINES TABLOSUNA PROJECT_ID KOLONU EKLE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔧 MACHINES TABLOSUNA PROJECT_ID EKLENIYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- project_id kolonu ekle (nullable - tezgah projede olmayabilir)
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Index ekle (performans için)
CREATE INDEX IF NOT EXISTS idx_machines_project_id ON machines(project_id);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ MACHINES TABLOSU GÜNCELLENDI!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
