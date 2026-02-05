-- DÜNYASAN ERP - Companies Tablosu RLS Düzeltmesi
-- Tüm kullanıcılar companies tablosunu okuyabilir

-- =====================================================
-- Companies Tablosu RLS Politikaları
-- =====================================================

-- RLS'i aktif et
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Eski politikaları sil
DROP POLICY IF EXISTS "companies_select" ON companies;
DROP POLICY IF EXISTS "companies_insert" ON companies;
DROP POLICY IF EXISTS "companies_update" ON companies;
DROP POLICY IF EXISTS "companies_delete" ON companies;

-- YENİ POLİTİKALAR

-- Herkes okuyabilir (tüm kullanıcılar şirket bilgisini görebilir)
CREATE POLICY "companies_select" ON companies
    FOR SELECT TO authenticated
    USING (true);

-- Sadece Super Admin ekleyebilir
CREATE POLICY "companies_insert" ON companies
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid()
            AND r.name = 'Super Admin'
        )
    );

-- Sadece Super Admin güncelleyebilir
CREATE POLICY "companies_update" ON companies
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid()
            AND r.name = 'Super Admin'
        )
    );

-- Sadece Super Admin silebilir
CREATE POLICY "companies_delete" ON companies
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid()
            AND r.name = 'Super Admin'
        )
    );

-- =====================================================
-- BAŞARI MESAJI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ COMPANIES RLS POLİTİKALARI DÜZELTİLDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Politikalar:';
    RAISE NOTICE '  ✅ SELECT: Tüm kullanıcılar okuyabilir';
    RAISE NOTICE '  ✅ INSERT: Sadece Super Admin';
    RAISE NOTICE '  ✅ UPDATE: Sadece Super Admin';
    RAISE NOTICE '  ✅ DELETE: Sadece Super Admin';
    RAISE NOTICE '';
    RAISE NOTICE 'Artık companies tablosuna erişebilirsiniz!';
    RAISE NOTICE '';
END $$;
