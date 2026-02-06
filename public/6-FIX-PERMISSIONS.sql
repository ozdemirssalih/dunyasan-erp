-- =====================================================
-- DÜNYASAN ERP - YETKİLENDİRME SİSTEMİNİ DÜZELT
-- =====================================================
-- Roles tablosu için RLS politikası eksikti!
-- =====================================================

-- ROLES tablosu için RLS aktif mi kontrol et
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Eski politikaları sil
DROP POLICY IF EXISTS "roles_select" ON roles;
DROP POLICY IF EXISTS "roles_all" ON roles;

-- Yeni politika: Herkes tüm rolleri görebilir
CREATE POLICY "roles_all" ON roles
    FOR SELECT TO authenticated
    USING (true);

-- PROFILES tablosu politikalarını da kontrol et
DROP POLICY IF EXISTS "profiles_all" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

CREATE POLICY "profiles_select" ON profiles
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "profiles_update" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- =====================================================
-- SONUÇ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ YETKİLENDİRME SİSTEMİ DÜZELTİLDİ!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ roles tablosu: Herkes okuyabilir';
    RAISE NOTICE '✅ profiles tablosu: Herkes okuyabilir';
    RAISE NOTICE '✅ Kullanıcılar kendi profilini güncelleyebilir';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Artık yetkilendirme sistemi çalışıyor!';
    RAISE NOTICE '========================================';
END $$;
