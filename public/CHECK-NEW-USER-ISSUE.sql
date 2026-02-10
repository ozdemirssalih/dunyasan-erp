-- Yeni kullanıcıların şirket verilerini görememesi sorunu için kontroller

-- 1. profiles tablosundaki kullanıcıları kontrol et (company_id NULL olanları bul)
SELECT
    p.id,
    p.email,
    p.full_name,
    p.company_id,
    p.role_id,
    r.name as role_name,
    c.name as company_name
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
LEFT JOIN companies c ON p.company_id = c.id
ORDER BY p.created_at DESC
LIMIT 10;

-- 2. company_id NULL olan kullanıcılar var mı?
SELECT
    COUNT(*) as users_without_company,
    array_agg(email) as emails
FROM profiles
WHERE company_id IS NULL;

-- 3. profiles tablosundaki SELECT RLS politikalarını kontrol et
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- 4. Tüm data tablolarındaki RLS politikalarını kontrol et (SELECT işlemleri için)
SELECT
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
AND cmd = 'SELECT'
AND qual LIKE '%company_id%'
ORDER BY tablename, policyname;

-- ÇÖZÜM: Eğer company_id NULL olan kullanıcılar varsa, onları bir şirkete ata
-- Bu SQL'i çalıştırmadan önce yukarıdaki sorguları kontrol edin!

-- Örnek: Tüm company_id NULL kullanıcıları ilk şirkete ata
-- UPDATE profiles
-- SET company_id = (SELECT id FROM companies LIMIT 1)
-- WHERE company_id IS NULL;
