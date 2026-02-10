-- dunyasandepo@dunyasan.com kullanıcısını sil

-- 1. Önce kullanıcıyı kontrol et
SELECT
    p.id,
    p.email,
    p.full_name,
    r.name as role_name,
    c.name as company_name
FROM profiles p
LEFT JOIN roles r ON p.role_id = r.id
LEFT JOIN companies c ON p.company_id = c.id
WHERE p.email = 'dunyasandepo@dunyasan.com';

-- 2. Auth kullanıcısının ID'sini al
SELECT id, email, created_at
FROM auth.users
WHERE email = 'dunyasandepo@dunyasan.com';

-- 3. KULLANICIYI SİL
-- NOT: Önce profiles'tan, sonra auth.users'tan silinmeli

-- profiles tablosundan sil
DELETE FROM profiles
WHERE email = 'dunyasandepo@dunyasan.com';

-- auth.users tablosundan sil (admin işlemi gerektirir)
-- Eğer bu SQL çalışmazsa, Supabase Dashboard > Authentication > Users'tan manuel silin
DELETE FROM auth.users
WHERE email = 'dunyasandepo@dunyasan.com';

-- 4. Kontrol: Kullanıcı silindi mi?
SELECT
    COUNT(*) as profiles_count
FROM profiles
WHERE email = 'dunyasandepo@dunyasan.com';

SELECT
    COUNT(*) as auth_count
FROM auth.users
WHERE email = 'dunyasandepo@dunyasan.com';

-- 5. Success message
SELECT '✅ Kullanıcı silindi: dunyasandepo@dunyasan.com' as message;
