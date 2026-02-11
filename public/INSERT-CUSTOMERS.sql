-- Müşterileri ekle - 4 Firma
-- NOT: company_id değerini kendi şirket ID'niz ile değiştirin

DO $$
DECLARE
    v_company_id UUID;
    v_deleted_count INTEGER;
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

    -- Önce mevcut tüm müşterileri sil
    DELETE FROM customer_companies WHERE company_id = v_company_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '🗑️ % eski müşteri kaydı silindi', v_deleted_count;

    -- Müşterileri ekle
    INSERT INTO customer_companies (company_id, customer_name, contact_person, phone, email, tax_number, address) VALUES
    (v_company_id, 'SİNERJİ SİLAH VE MUHİMMAT ANONİM ŞİRKETİ', 'SAYIN YETKİLİ', '0545 832 13 83', NULL, '7710551723', 'SİLAH OSB.2 SOK. NO:5 MERKEZ/KIRIKKALE'),
    (v_company_id, 'AKIN TEKNOLOJİ ANONİM ŞİRKETİ', 'SAYIN YETKİLİ', '0545 177 84 06', NULL, '270714369', '9 SOK. NO:6 KAPI:1 71000 YAHŞİHAN/KIRIKKALE'),
    (v_company_id, 'MAKİNE VE KİMYA ENDÜSTRİ ANONİM ŞİRKETİ', 'SAYIN YETKİLİ', '0535 717 08 53', NULL, '6111520767', 'DÖGOL CAD. NO:2/1 YENİMAHALLE / ANKARA'),
    (v_company_id, 'SİS KAPLAMA MAKİNE İNŞAAT TEKSTİL SANAYİ VE TİCARET LİMİTED ŞİRKETİ', 'SAYIN YETKİLİ', NULL, NULL, '7710721477', '118 SK. No:9');

    RAISE NOTICE '✅ Toplam 4 müşteri başarıyla eklendi!';
END $$;

-- Özet rapor
SELECT
    customer_name,
    contact_person,
    phone,
    tax_number
FROM customer_companies
ORDER BY customer_name;
