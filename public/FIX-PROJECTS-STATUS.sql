-- =====================================================
-- PROJECTS TABLOSUNA STATUS VE CODE EKLE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔧 PROJECTS TABLOSU GÜNCELLENİYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- Status kolonu ekle
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled'));

-- Project code kolonu ekle
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS project_code VARCHAR(50);

-- Description kolonu ekle
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS description TEXT;

-- Mevcut projelere kod ata (eğer yoksa)
DO $$
DECLARE
    proj RECORD;
    new_code VARCHAR(50);
    counter INT := 1;
BEGIN
    FOR proj IN SELECT id FROM projects WHERE project_code IS NULL OR project_code = ''
    LOOP
        new_code := 'PRJ-' || LPAD(counter::TEXT, 4, '0');
        UPDATE projects SET project_code = new_code WHERE id = proj.id;
        counter := counter + 1;
    END LOOP;
END $$;

COMMENT ON COLUMN projects.status IS 'Proje durumu: active, completed, on_hold, cancelled';
COMMENT ON COLUMN projects.project_code IS 'Proje kodu (örn: PRJ-0001)';

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PROJECTS TABLOSU GÜNCELLENDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Yeni kolonlar:';
    RAISE NOTICE '   • status (active/completed/on_hold/cancelled)';
    RAISE NOTICE '   • project_code (PRJ-XXXX)';
    RAISE NOTICE '   • description (açıklama)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık SETUP-PROJECT-MANAGEMENT.sql çalıştırılabilir!';
    RAISE NOTICE '========================================';
END $$;
