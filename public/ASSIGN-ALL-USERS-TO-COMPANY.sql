-- Tüm kullanıcıları aynı şirkete ata

-- 1. Önce mevcut durumu kontrol et
SELECT
    p.id,
    p.email,
    p.full_name,
    p.company_id,
    c.name as company_name,
    r.name as role_name
FROM profiles p
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN roles r ON p.role_id = r.id
ORDER BY p.created_at;

-- 2. Sistemdeki şirketleri listele
SELECT
    id,
    name,
    created_at
FROM companies
ORDER BY created_at;

-- 3. TÜM KULLANICILARI İLK ŞİRKETE ATA
-- NOT: Eğer belirli bir şirket kullanmak isterseniz, WHERE id = 'ŞIRKET-ID' şeklinde değiştirin

UPDATE profiles
SET
    company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1),
    updated_at = NOW()
WHERE TRUE;

-- 4. Kontrol: Tüm kullanıcıların company_id'si atandı mı?
SELECT
    COUNT(*) as total_users,
    COUNT(company_id) as users_with_company,
    COUNT(*) - COUNT(company_id) as users_without_company
FROM profiles;

-- 5. Son durum: Tüm kullanıcıları göster
SELECT
    p.email,
    p.full_name,
    c.name as company_name,
    r.name as role_name,
    CASE
        WHEN p.company_id IS NULL THEN '❌ Company atanmadı'
        ELSE '✅ OK'
    END as status
FROM profiles p
LEFT JOIN companies c ON p.company_id = c.id
LEFT JOIN roles r ON p.role_id = r.id
ORDER BY p.created_at;

-- 6. Success message
SELECT '✅ Tüm kullanıcılar aynı şirkete atandı!' as message;
SELECT 'Kullanıcılar artık şirket verilerini görebilir' as note;
