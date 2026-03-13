-- =============================================
-- YENİ PERSONELLER EKLEME
-- =============================================
-- 33 yeni personeli employees tablosuna ekler
-- =============================================

-- Şirket ID'sini otomatik al (Dünyasan şirketi için)
DO $$
DECLARE
  v_company_id UUID;
  v_next_code INTEGER;
BEGIN
  -- Company ID'yi al
  SELECT id INTO v_company_id
  FROM companies
  WHERE LOWER(name) LIKE '%dünyasan%'
  LIMIT 1;

  -- Eğer company bulunamazsa, ilk company'yi kullan
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM companies
    LIMIT 1;
  END IF;

  -- Mevcut en yüksek personel kodunu bul
  SELECT COALESCE(MAX(CAST(SUBSTRING(employee_code FROM '[0-9]+') AS INTEGER)), 0) + 1
  INTO v_next_code
  FROM employees
  WHERE company_id = v_company_id
    AND employee_code ~ '^P[0-9]+$';

  -- Eğer hiç kod bulunamazsa 1'den başla
  IF v_next_code IS NULL THEN
    v_next_code := 1;
  END IF;

  -- Personelleri ekle
  INSERT INTO employees (
    company_id,
    employee_code,
    full_name,
    status,
    created_at,
    updated_at
  )
  SELECT
    v_company_id,
    'P' || LPAD((v_next_code + (row_number - 1))::TEXT, 3, '0'),
    full_name,
    'active',
    NOW(),
    NOW()
  FROM (
    VALUES
      (1, 'AHMET OSMAN UÇAN'),
      (2, 'ALİHAN TOPUZ'),
      (3, 'ARDA BATIN KARAYOL'),
      (4, 'ARDA SUNGURTAŞ'),
      (5, 'BURHAN ÖZTÜRK'),
      (6, 'EKREM HASAN BEKTAŞ'),
      (7, 'EKREM KÜTÜKOĞLU'),
      (8, 'ELVAN TAHA TÜRE'),
      (9, 'EMİN DÜĞEROĞLU'),
      (10, 'EMİRHAN ŞİMŞEK'),
      (11, 'ENES EGEHAN AKDENİZ'),
      (12, 'ERSİN YÜCEL'),
      (13, 'HÜSEYİN KAPLAN'),
      (14, 'HÜSEYİN MERT AKKOÇ'),
      (15, 'İBRAHİM ÖKSÜZ'),
      (16, 'İKLİM DENİZ'),
      (17, 'İLKER ÖZTÜRK'),
      (18, 'İREMSU EROĞLU'),
      (19, 'MEHMET YILMAZ'),
      (20, 'MERT BEKAR'),
      (21, 'MERTCAN ÇALI'),
      (22, 'METEHAN DALBUDAK'),
      (23, 'METEHAN ÜNLÜ'),
      (24, 'MİRAÇ CEM ADIGÜZEL'),
      (25, 'MUHAMMED MUSTAFA KOYUNCU'),
      (26, 'MUSTAFA GONCA'),
      (27, 'ÖMER TUNA YÖRÜ'),
      (28, 'PINAR TÜRKOĞLU'),
      (29, 'SERKAN ÇANKAYA'),
      (30, 'YİĞİT ARDA OĞUZ'),
      (31, 'YUSUF FAYDA'),
      (32, 'MURAT ERDİVAN'),
      (33, 'HASAN BERKEHAN ÜZÜMLÜ')
  ) AS t(row_number, full_name)
  WHERE NOT EXISTS (
    -- Duplicate kontrolü
    SELECT 1 FROM employees e
    WHERE e.company_id = v_company_id
      AND LOWER(TRIM(e.full_name)) = LOWER(TRIM(t.full_name))
  );

  -- Başarı mesajı
  RAISE NOTICE '✅ % yeni personel eklendi!', (SELECT COUNT(*) FROM employees WHERE company_id = v_company_id AND created_at >= NOW() - INTERVAL '1 second');
END $$;

-- Sonuç kontrolü
SELECT
  '✅ Personeller başarıyla eklendi!' as message,
  COUNT(*) as toplam_personel_sayisi
FROM employees
WHERE status = 'active';

-- Son eklenen personelleri göster
SELECT
  employee_code,
  full_name,
  status,
  created_at
FROM employees
ORDER BY created_at DESC
LIMIT 33;
