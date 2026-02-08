-- =====================================================
-- CUSTOMER_COMPANIES TABLOSU İÇİN RLS POLİTİKASI
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔒 CUSTOMER_COMPANIES RLS KURULUYOR...';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;

-- RLS aktif et
ALTER TABLE customer_companies ENABLE ROW LEVEL SECURITY;

-- Eski politikaları sil
DROP POLICY IF EXISTS "customer_companies_all" ON customer_companies;

-- Yeni politika oluştur (authenticated kullanıcılar için tüm işlemler)
CREATE POLICY "customer_companies_all"
ON customer_companies
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ CUSTOMER_COMPANIES RLS HAZIR!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
