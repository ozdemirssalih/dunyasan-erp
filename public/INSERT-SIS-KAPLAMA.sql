-- SİS KAPLAMA şirketini hem müşteri hem tedarikçi olarak ekle

DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Mevcut kullanıcının company_id'sini al
    SELECT company_id INTO v_company_id
    FROM profiles
    WHERE id = auth.uid()
    LIMIT 1;

    -- Eğer bulunamazsa, ilk company'yi kullan (test için)
    IF v_company_id IS NULL THEN
        SELECT id INTO v_company_id FROM companies LIMIT 1;
    END IF;

    -- Müşteri olarak ekle
    INSERT INTO customer_companies (company_id, customer_name, contact_person, phone, email, tax_number, address)
    VALUES (v_company_id, 'SİS KAPLAMA MAKİNE İNŞAAT TEKSTİL SANAYİ VE TİCARET LİMİTED ŞİRKETİ', 'SAYIN YETKİLİ', NULL, NULL, '7710721477', '118 SK. No:9')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ Müşteri olarak eklendi: SİS KAPLAMA';

    -- Tedarikçi olarak ekle
    INSERT INTO suppliers (company_id, company_name, contact_person, phone, email, tax_number, address, category, is_active)
    VALUES (v_company_id, 'SİS KAPLAMA MAKİNE İNŞAAT TEKSTİL SANAYİ VE TİCARET LİMİTED ŞİRKETİ', 'SAYIN YETKİLİ', NULL, NULL, '7710721477', '118 SK. No:9', 'KAPLAMA', true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✅ Tedarikçi olarak eklendi: SİS KAPLAMA (Kategori: KAPLAMA)';

    RAISE NOTICE '🎉 SİS KAPLAMA başarıyla hem müşteri hem tedarikçi olarak eklendi!';
END $$;
