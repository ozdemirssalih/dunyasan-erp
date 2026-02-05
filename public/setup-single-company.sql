-- DÜNYASAN ERP - Tek Şirket Kurulumu
-- Tüm kullanıcıları Dünyasan şirketine atar

-- =====================================================
-- ADIM 1: Mevcut şirketi kontrol et veya oluştur
-- =====================================================

DO $$
DECLARE
  company_uuid UUID;
BEGIN
  -- Dünyasan şirketi var mı?
  SELECT id INTO company_uuid
  FROM companies
  WHERE name ILIKE '%dünyasan%'
  LIMIT 1;

  -- Yoksa oluştur
  IF company_uuid IS NULL THEN
    INSERT INTO companies (name, industry, phone, email, address)
    VALUES (
      'Dünyasan Savunma Sistemleri A.Ş.',
      'Savunma Sanayi',
      '0312 XXX XX XX',
      'info@dunyasan.com',
      'Ankara, Türkiye'
    )
    RETURNING id INTO company_uuid;

    RAISE NOTICE '✅ Dünyasan şirketi oluşturuldu: %', company_uuid;
  ELSE
    RAISE NOTICE '✅ Dünyasan şirketi mevcut: %', company_uuid;
  END IF;

  -- =====================================================
  -- ADIM 2: Tüm kullanıcıları bu şirkete ata
  -- =====================================================

  UPDATE profiles
  SET company_id = company_uuid
  WHERE company_id IS NULL OR company_id != company_uuid;

  RAISE NOTICE '✅ Tüm kullanıcılar Dünyasan şirketine atandı';

  -- =====================================================
  -- ADIM 3: Sonuçları göster
  -- =====================================================

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEK ŞİRKET KURULUMU TAMAMLANDI!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Şirket Bilgileri:';
  RAISE NOTICE '  ID: %', company_uuid;
  RAISE NOTICE '  Ad: Dünyasan Savunma Sistemleri A.Ş.';
  RAISE NOTICE '';
  RAISE NOTICE 'Toplam Kullanıcı: %', (SELECT COUNT(*) FROM profiles WHERE company_id = company_uuid);
  RAISE NOTICE '';
  RAISE NOTICE 'Artık tüm kullanıcılar aynı şirkette!';
  RAISE NOTICE '';

END $$;

-- Kontrol sorgusu
SELECT
  p.id,
  p.full_name,
  p.email,
  c.name as company_name
FROM profiles p
LEFT JOIN companies c ON p.company_id = c.id
ORDER BY p.full_name;
