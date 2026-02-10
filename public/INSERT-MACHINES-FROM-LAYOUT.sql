-- Fabrika layout'undan tüm tezgahları ekle
-- NOT: company_id değerini kendi şirket ID'niz ile değiştirin

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

    -- Tezgahları ekle
    INSERT INTO machines (company_id, machine_code, machine_name, machine_type, capacity, status, location) VALUES
    -- DENER Tezgahları
    (v_company_id, 'F22', 'F22-DENER', '4 Eksen İşleme Merkezi', '1200', 'active', 'Sol Bölge'),
    (v_company_id, 'F23', 'F23-DENER', '4 Eksen İşleme Merkezi', '1200', 'active', 'Sol Bölge'),
    (v_company_id, 'F19', 'F19-DENER', '4 Eksen İşleme Merkezi', '1600', 'active', 'Sol Bölge'),
    (v_company_id, 'F20', 'F20-DENER', '4 Eksen İşleme Merkezi', '1600', 'active', 'Sol Bölge'),
    (v_company_id, 'F21', 'F21-DENER', '4 Eksen İşleme Merkezi', '1200', 'active', 'Sol Bölge'),
    (v_company_id, 'T8', 'T8-DENER', 'CNC Torna C Eksen', '12 inç', 'active', 'Torna Bölgesi'),
    (v_company_id, 'T9', 'T9-DENER', 'CNC Torna C Eksen', '10 inç', 'active', 'Torna Bölgesi'),
    (v_company_id, 'T5', 'T5-DENER', 'CNC Torna C Eksen', '12 inç', 'active', 'Torna Bölgesi'),
    (v_company_id, 'T6', 'T6-DENER', 'CNC Torna C Eksen', '12 inç', 'active', 'Torna Bölgesi'),
    (v_company_id, 'T7', 'T7-DENER', 'CNC Torna C Eksen', '12 inç', 'active', 'Torna Bölgesi'),

    -- DMG MORI Tezgahları
    (v_company_id, 'F8', 'F8-DMG MORI', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Sol Bölge'),
    (v_company_id, 'F9', 'F9-DMG MORI', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Sol Bölge'),
    (v_company_id, 'T4', 'T4-DMG MORI', 'CNC Torna C Eksen', '8 inç', 'active', 'Sağ Bölge'),

    -- KOMATECH
    (v_company_id, 'F10', 'F10-KOMATECH', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Sol Bölge'),

    -- WELE Tezgahları
    (v_company_id, 'F5', 'F5-WELE', '4 Eksen İşleme Merkezi', '1200', 'active', 'Orta Bölge'),
    (v_company_id, 'F6', 'F6-WELE', '4 Eksen İşleme Merkezi', '1200', 'active', 'Orta Bölge'),
    (v_company_id, 'F7', 'F7-WELE', '4 Eksen İşleme Merkezi', '1200', 'active', 'Orta Bölge'),

    -- MICRO DYN Tezgahları
    (v_company_id, 'F15', 'F15-MICRO DYN', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Bölge'),
    (v_company_id, 'F16', 'F16-MICRO DYN', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Bölge'),
    (v_company_id, 'F17', 'F17-MICRO DYN', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Bölge'),
    (v_company_id, 'F18', 'F18-MICRO DYN', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Bölge'),
    (v_company_id, 'F11', 'F11-MICRO DYN', '5 Eksen İşleme Merkezi', '300', 'active', 'Orta Bölge'),
    (v_company_id, 'F12', 'F12-MICRO DYN', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Bölge'),
    (v_company_id, 'F13', 'F13-MICRO DYN', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Bölge'),
    (v_company_id, 'F14', 'F14-MICRO DYN', '4 Eksen İşleme Merkezi', '800', 'active', 'Orta Bölge'),

    -- ACCUWAY Tornalar
    (v_company_id, 'T1', 'T1-ACCUWAY', 'CNC Torna', '8 inç', 'active', 'Sağ Bölge'),
    (v_company_id, 'T2', 'T2-ACCUWAY', 'CNC Torna', '8 inç', 'active', 'Sağ Bölge'),
    (v_company_id, 'T3', 'T3-ACCUWAY', 'CNC Torna', '8 inç', 'active', 'Sağ Bölge'),

    -- HYUNDAI WIA Tezgahları
    (v_company_id, 'F1', 'F1-HYUNDAI WIA', 'Yatay İşleme Merkezi', '600', 'active', 'Sağ Bölge'),
    (v_company_id, 'F2', 'F2-HYUNDAI WIA', '4 Eksen İşleme Merkezi', '1000', 'active', 'Sağ Bölge'),
    (v_company_id, 'F3', 'F3-HYUNDAI WIA', '4 Eksen İşleme Merkezi', '1000', 'active', 'Sağ Bölge'),
    (v_company_id, 'F4', 'F4-HYUNDAI WIA', '4 Eksen İşleme Merkezi', '1000', 'active', 'Sağ Bölge')

    ON CONFLICT (company_id, machine_code) DO UPDATE SET
        machine_name = EXCLUDED.machine_name,
        machine_type = EXCLUDED.machine_type,
        capacity = EXCLUDED.capacity,
        location = EXCLUDED.location,
        updated_at = NOW();

    RAISE NOTICE '✅ Toplam 36 tezgah başarıyla eklendi/güncellendi!';
END $$;

-- Özet rapor
SELECT
    machine_type,
    COUNT(*) as adet,
    STRING_AGG(machine_code, ', ' ORDER BY machine_code) as tezgahlar
FROM machines
GROUP BY machine_type
ORDER BY adet DESC;
