-- Varsayılan Muhasebe Kategorilerini Ekle
-- Her şirket için otomatik olarak yaygın kullanılan kategoriler eklenir

-- ========================================
-- GELİR KATEGORİLERİ
-- ========================================

-- Şirket ID'sini buradan alacağız (örnek için ilk şirketi kullanıyoruz)
-- Gerçek kullanımda company_id parametresi ile çalıştırılmalı

DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- İlk aktif şirketi al (veya belirli bir şirket ID'si kullanabilirsiniz)
    SELECT id INTO v_company_id FROM companies LIMIT 1;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Şirket bulunamadı! Önce bir şirket oluşturun.';
    END IF;

    -- GELİR KATEGORİLERİ
    INSERT INTO accounting_categories (company_id, name, type, description, color, is_active) VALUES
    (v_company_id, 'Satış Geliri', 'income', 'Ürün ve hizmet satışlarından elde edilen gelir', '#10B981', true),
    (v_company_id, 'Hizmet Geliri', 'income', 'Sunulan hizmetlerden elde edilen gelir', '#059669', true),
    (v_company_id, 'Faiz Geliri', 'income', 'Banka ve yatırımlardan elde edilen faiz geliri', '#34D399', true),
    (v_company_id, 'Kira Geliri', 'income', 'Gayrimenkul kiralarından elde edilen gelir', '#6EE7B7', true),
    (v_company_id, 'Komisyon Geliri', 'income', 'Aracılık ve komisyon geliri', '#A7F3D0', true),
    (v_company_id, 'Hurda Satışı', 'income', 'Fire ve hurda malzeme satış geliri', '#D1FAE5', true),
    (v_company_id, 'Diğer Gelirler', 'income', 'Sınıflandırılmamış diğer gelirler', '#14B8A6', true)
    ON CONFLICT DO NOTHING;

    -- GİDER KATEGORİLERİ
    INSERT INTO accounting_categories (company_id, name, type, description, color, is_active) VALUES
    (v_company_id, 'Hammadde Alımı', 'expense', 'Üretim için hammadde ve malzeme alımları', '#EF4444', true),
    (v_company_id, 'Personel Maaşları', 'expense', 'Çalışan maaş ve ücretleri', '#DC2626', true),
    (v_company_id, 'Kira Gideri', 'expense', 'İşyeri ve bina kira ödemeleri', '#B91C1C', true),
    (v_company_id, 'Elektrik-Su-Doğalgaz', 'expense', 'Enerji ve temel hizmet giderleri', '#991B1B', true),
    (v_company_id, 'Taşıma-Nakliye', 'expense', 'Lojistik ve taşıma giderleri', '#F59E0B', true),
    (v_company_id, 'Bakım-Onarım', 'expense', 'Makine ve ekipman bakım giderleri', '#D97706', true),
    (v_company_id, 'Ofis Malzemeleri', 'expense', 'Kırtasiye ve ofis malzeme giderleri', '#F87171', true),
    (v_company_id, 'Pazarlama-Reklam', 'expense', 'Pazarlama ve reklam giderleri', '#FCA5A5', true),
    (v_company_id, 'Telefon-İnternet', 'expense', 'İletişim giderleri', '#FEE2E2', true),
    (v_company_id, 'Sigorta Giderleri', 'expense', 'İşyeri ve personel sigorta ödemeleri', '#EC4899', true),
    (v_company_id, 'Vergi ve Harçlar', 'expense', 'Devlete ödenen vergi ve harçlar', '#DB2777', true),
    (v_company_id, 'Danışmanlık Gideri', 'expense', 'Muhasebe, hukuk ve danışmanlık giderleri', '#BE185D', true),
    (v_company_id, 'Yemek Gideri', 'expense', 'Personel yemek ve ikram giderleri', '#FBBF24', true),
    (v_company_id, 'Yakıt Gideri', 'expense', 'Araç ve makine yakıt giderleri', '#F59E0B', true),
    (v_company_id, 'Banka Komisyonları', 'expense', 'Banka işlem komisyon ve masrafları', '#8B5CF6', true),
    (v_company_id, 'Diğer Giderler', 'expense', 'Sınıflandırılmamış diğer giderler', '#6B7280', true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '';
    RAISE NOTICE '✅ VARSAYILAN KATEGORİLER EKLENDİ!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Eklenen Kategoriler:';
    RAISE NOTICE '   💰 Gelir: 7 kategori';
    RAISE NOTICE '     - Satış Geliri';
    RAISE NOTICE '     - Hizmet Geliri';
    RAISE NOTICE '     - Faiz Geliri';
    RAISE NOTICE '     - Kira Geliri';
    RAISE NOTICE '     - Komisyon Geliri';
    RAISE NOTICE '     - Hurda Satışı';
    RAISE NOTICE '     - Diğer Gelirler';
    RAISE NOTICE '';
    RAISE NOTICE '   💸 Gider: 16 kategori';
    RAISE NOTICE '     - Hammadde Alımı';
    RAISE NOTICE '     - Personel Maaşları';
    RAISE NOTICE '     - Kira Gideri';
    RAISE NOTICE '     - Elektrik-Su-Doğalgaz';
    RAISE NOTICE '     - Taşıma-Nakliye';
    RAISE NOTICE '     - Bakım-Onarım';
    RAISE NOTICE '     - Ofis Malzemeleri';
    RAISE NOTICE '     - Pazarlama-Reklam';
    RAISE NOTICE '     - Telefon-İnternet';
    RAISE NOTICE '     - Sigorta Giderleri';
    RAISE NOTICE '     - Vergi ve Harçlar';
    RAISE NOTICE '     - Danışmanlık Gideri';
    RAISE NOTICE '     - Yemek Gideri';
    RAISE NOTICE '     - Yakıt Gideri';
    RAISE NOTICE '     - Banka Komisyonları';
    RAISE NOTICE '     - Diğer Giderler';
    RAISE NOTICE '';
    RAISE NOTICE '🎨 Renkler otomatik atandı!';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  NOT: Bu kategoriler ilk şirket için eklendi.';
    RAISE NOTICE '    Başka şirketler için ayrıca eklenmelidir.';
    RAISE NOTICE '';
END $$;
