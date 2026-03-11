-- =============================================
-- MÜŞTERİLERİ TEDARİKÇİLER TABLOSUNA KOPYALA
-- =============================================
-- customer_companies tablosundaki firmaları
-- suppliers tablosuna ekler
-- Kategori: "MÜŞTERİ" olarak işaretlenir
-- =============================================

INSERT INTO suppliers (
  company_id,
  company_name,
  contact_person,
  phone,
  email,
  tax_number,
  address,
  category,
  notes,
  is_active,
  created_at,
  updated_at
)
SELECT
  company_id,
  customer_name as company_name,
  contact_person,
  phone,
  email,
  tax_number,
  address,
  'MÜŞTERİ' as category, -- Müşteri olduğunu belirten kategori
  CASE
    WHEN tax_office IS NOT NULL AND tax_office != ''
    THEN 'Vergi Dairesi: ' || tax_office
    ELSE NULL
  END as notes, -- Vergi dairesi bilgisi notlara ekleniyor
  true as is_active,
  created_at,
  NOW() as updated_at
FROM customer_companies
WHERE customer_name IS NOT NULL
  AND customer_name != ''
  -- Zaten suppliers tablosunda olmayan müşterileri ekle (duplicate check)
  AND NOT EXISTS (
    SELECT 1 FROM suppliers s
    WHERE s.company_id = customer_companies.company_id
    AND LOWER(TRIM(s.company_name)) = LOWER(TRIM(customer_companies.customer_name))
  );

-- Başarı mesajı
SELECT
  '✅ Müşteriler tedarikçiler tablosuna kopyalandı!' as message,
  COUNT(*) as eklenen_musteri_sayisi
FROM suppliers
WHERE category = 'MÜŞTERİ';
