-- Yeni kullanıcıların şirket verilerini görmesi için düzeltmeler

-- 1. ÖNCE KONTROL: company_id NULL olan kullanıcılar var mı?
SELECT
    id,
    email,
    full_name,
    company_id,
    role_id,
    created_at
FROM profiles
WHERE company_id IS NULL
ORDER BY created_at DESC;

-- 2. Sistemdeki şirketleri listele
SELECT id, name FROM companies;

-- 3. ÇÖZÜM 1: Mevcut company_id NULL kullanıcıları ilk şirkete ata
-- NOT: Aşağıdaki SQL'i çalıştırmadan önce yukarıdaki sorguları kontrol edin!
-- Eğer birden fazla şirket varsa, doğru company_id'yi manuel olarak seçin

-- Tüm company_id NULL kullanıcıları ilk şirkete ata:
UPDATE profiles
SET
    company_id = (SELECT id FROM companies ORDER BY created_at LIMIT 1),
    updated_at = NOW()
WHERE company_id IS NULL;

-- 4. Kontrol: Artık company_id NULL olan kullanıcı kaldı mı?
SELECT COUNT(*) as remaining_null_company FROM profiles WHERE company_id IS NULL;

-- 5. ÇÖZÜM 2: Yeni kullanıcılar için otomatik şirket ataması yapan trigger
-- Bu trigger auth.users tablosuna yeni kullanıcı eklendiğinde profiles'a otomatik ekler

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_company_id UUID;
    default_role_id UUID;
BEGIN
    -- İlk şirketi al (veya belirli bir şirketi kullan)
    SELECT id INTO default_company_id FROM companies ORDER BY created_at LIMIT 1;

    -- Varsayılan rolü al (örneğin "User" rolü)
    SELECT id INTO default_role_id FROM roles WHERE name = 'User' LIMIT 1;

    -- Eğer varsayılan rol yoksa, herhangi bir rolü al
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM roles WHERE is_system_role = false LIMIT 1;
    END IF;

    -- profiles tablosuna ekle
    INSERT INTO profiles (id, email, full_name, company_id, role_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        default_company_id,
        default_role_id
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        company_id = COALESCE(profiles.company_id, EXCLUDED.company_id),
        role_id = COALESCE(profiles.role_id, EXCLUDED.role_id),
        updated_at = NOW();

    RETURN NEW;
END;
$$;

-- Trigger'ı oluştur (eğer yoksa)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- 6. Success message
SELECT '✅ Yeni kullanıcı düzeltmeleri tamamlandı!' as message;
SELECT 'Mevcut company_id NULL kullanıcılar şirkete atandı' as step1;
SELECT 'Yeni kullanıcılar için otomatik şirket ataması trigger eklendi' as step2;
