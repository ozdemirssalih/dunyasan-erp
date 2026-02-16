-- DÜNYASAN PERSONEL TOPLU EKLEMESİ
-- İlk 63 personelin sisteme eklenmesi

DO $$
DECLARE
    v_company_id UUID;
BEGIN
    -- Dünyasan şirket ID'sini al
    SELECT id INTO v_company_id
    FROM companies
    WHERE name ILIKE '%dünyasan%'
    LIMIT 1;

    -- Eğer bulunamazsa ilk şirketi al
    IF v_company_id IS NULL THEN
        SELECT id INTO v_company_id FROM companies LIMIT 1;
    END IF;

    -- Personelleri ekle
    INSERT INTO employees (company_id, employee_code, full_name, id_number, hire_date, phone, status) VALUES
    (v_company_id, 'EMP001', 'Burhan Şanal', '25849904876', '2024-02-02', '+905301509871', 'active'),
    (v_company_id, 'EMP002', 'Ekrem Taşçı', '11627380772', '2025-02-07', NULL, 'active'),
    (v_company_id, 'EMP003', 'Orhan Öztürk', '30107161526', '2025-02-10', '+905426393317', 'active'),
    (v_company_id, 'EMP004', 'İbrahimcan Eşme', '17366455344', '2025-02-18', NULL, 'active'),
    (v_company_id, 'EMP005', 'Enver Gürel', '40606812096', '2024-03-28', '+905326378972', 'active'),
    (v_company_id, 'EMP006', 'Barış Hacımirzaoğlu', '45652512358', '2024-03-28', '+905325137217', 'active'),
    (v_company_id, 'EMP007', 'Mevlüt Tekeli', '22490017566', '2024-06-24', '+905459673251', 'active'),
    (v_company_id, 'EMP008', 'Yasemin Laçin', '43843704698', '2024-04-26', '+905453483364', 'active'),
    (v_company_id, 'EMP009', 'Bahar Yalçın', '15212259962', '2024-05-08', '+905425930905', 'active'),
    (v_company_id, 'EMP010', 'Recep Okal', '24548347502', '2024-05-14', '+905549008250', 'active'),
    (v_company_id, 'EMP011', 'Nurhan Karayel', '51592767192', '2024-07-24', NULL, 'active'),
    (v_company_id, 'EMP012', 'Hatice Nur Tulpar', '16148627184', '2024-07-29', NULL, 'active'),
    (v_company_id, 'EMP013', 'Yeliz Yıldırım', '24368564592', '2024-12-02', '+905464908384', 'active'),
    (v_company_id, 'EMP014', 'Haydar Çakmak', '10817407626', '2025-02-07', NULL, 'active'),
    (v_company_id, 'EMP015', 'Yaşar Kaplan', '16010631806', '2025-02-14', '+905424537685', 'active'),
    (v_company_id, 'EMP016', 'Fidan Yılmaz', '62641363258', '2024-07-01', '+905413351202', 'active'),
    (v_company_id, 'EMP017', 'İskender İnce', '36496817600', '2024-08-08', '+905421901440', 'active'),
    (v_company_id, 'EMP018', 'Oktay Soyutemiz', '11621380440', '2025-04-07', '+905536836522', 'active'),
    (v_company_id, 'EMP019', 'Emine Türk', '21584049216', '2025-05-05', '+905445441474', 'active'),
    (v_company_id, 'EMP020', 'Ertan Taşçı', '43480317572', '2025-05-20', NULL, 'active'),
    (v_company_id, 'EMP021', 'Şule Nur Bedir', '40540413854', '2025-07-14', '+905523891799', 'active'),
    (v_company_id, 'EMP022', 'Sefa Kazım Güni', '31099773650', '2025-01-06', '+905536469043', 'active'),
    (v_company_id, 'EMP023', 'Murat Özkılıç', '14504283388', '2025-01-22', '+905444827101', 'active'),
    (v_company_id, 'EMP024', 'Dilara Kayhan', '60601272442', '2025-02-24', '+905502360594', 'active'),
    (v_company_id, 'EMP025', 'Mevlüt Yücel', '40517138650', '2025-02-26', NULL, 'active'),
    (v_company_id, 'EMP026', 'Kerim Zengin', '22346022034', '2025-03-03', NULL, 'active'),
    (v_company_id, 'EMP027', 'Bayram İsi', '51409452426', '2025-03-10', '+905520035851', 'active'),
    (v_company_id, 'EMP028', 'İsmail Nurdoğdu', '57943513456', '2025-03-21', NULL, 'active'),
    (v_company_id, 'EMP029', 'Ahmet Can Ceylan', '12362355254', '2025-07-10', '+905426176302', 'active'),
    (v_company_id, 'EMP030', 'Egehan Demirci', '11399387900', '2025-07-10', NULL, 'active'),
    (v_company_id, 'EMP031', 'Bahadır Yücel', '24751939976', '2025-07-10', '+905422997844', 'active'),
    (v_company_id, 'EMP032', 'Özlem Karartı', '54736341586', '2025-07-11', NULL, 'active'),
    (v_company_id, 'EMP033', 'Samet Emir Güvenç', '10344142830', '2025-07-11', NULL, 'active'),
    (v_company_id, 'EMP034', 'Zeynep Olgun', '51889436510', '2025-07-12', '+905054949398', 'active'),
    (v_company_id, 'EMP035', 'Hava Coşkun', '71194115122', '2025-07-23', '+905389768020', 'active'),
    (v_company_id, 'EMP036', 'Şeyda Gül Caneri', '40573685334', '2025-08-04', '+905444722304', 'active'),
    (v_company_id, 'EMP037', 'Kaan Kanmaz', '12676075510', '2025-09-08', NULL, 'active'),
    (v_company_id, 'EMP038', 'Mehmet Ali Ceylan', '11679056038', '2025-08-06', '+905458934912', 'active'),
    (v_company_id, 'EMP039', 'Seydi Salih Özdemir', '14987212622', '2026-01-28', '+905421333134', 'active'),
    (v_company_id, 'EMP040', 'Sefa Akmaz', '10554137602', '2025-12-11', NULL, 'active'),
    (v_company_id, 'EMP041', 'Durmuş Efe Şahin', '11114397412', '2026-01-05', NULL, 'active'),
    (v_company_id, 'EMP042', 'Yasin Sümercan', '36973534730', '2025-11-17', NULL, 'active'),
    (v_company_id, 'EMP043', 'Mustafa Güneş', '21590725494', '2025-08-20', NULL, 'active'),
    (v_company_id, 'EMP044', 'Samet Nurdoğdu', '10427420268', '2025-11-18', NULL, 'active'),
    (v_company_id, 'EMP045', 'Mert Yılmaz', '33025664100', '2025-10-01', NULL, 'active'),
    (v_company_id, 'EMP046', 'Tuğba Sevindim', '27175463386', '2025-09-24', NULL, 'active'),
    (v_company_id, 'EMP047', 'Arda Kılıç', '12413354496', '2025-07-17', NULL, 'active'),
    (v_company_id, 'EMP048', 'Hüseyin Mert Karartı', '11822373692', '2026-01-12', '+905469016768', 'active'),
    (v_company_id, 'EMP049', 'Sezgin Uzman', '48487150658', '2026-02-03', '+905425570416', 'active'),
    (v_company_id, 'EMP050', 'Ahmet Çelik', '42061363038', '2026-01-26', '+905303008666', 'active'),
    (v_company_id, 'EMP051', 'Necdet Can Demir', '22634012730', '2025-09-29', NULL, 'active'),
    (v_company_id, 'EMP052', 'Tugay Özdek', '10463818258', '2026-01-05', NULL, 'active'),
    (v_company_id, 'EMP053', 'Zübeyde Ayten', '10496417664', '2025-11-10', '+905511843961', 'active'),
    (v_company_id, 'EMP054', 'Enes Çiçek', '48532921554', '2026-01-12', '+905354738364', 'active'),
    (v_company_id, 'EMP055', 'Yiğit Nuri Ataman', '39913436200', '2025-12-11', NULL, 'active'),
    (v_company_id, 'EMP056', 'Haydar Olgun', '52036431600', '2025-11-04', '+905383651831', 'active'),
    (v_company_id, 'EMP057', 'Samet Sarıkaya', '37156763008', '2025-09-08', NULL, 'active'),
    (v_company_id, 'EMP058', 'Aydın Efe Arlıer', '12599347718', '2025-07-21', NULL, 'active'),
    (v_company_id, 'EMP059', 'Tolga Yıldız', '31345760908', '2026-01-05', NULL, 'active'),
    (v_company_id, 'EMP060', 'Mustafa İşıklı', '53458384246', '2026-02-10', '+905439728029', 'active'),
    (v_company_id, 'EMP061', 'Songül Tümer', '40651411732', '2025-09-11', NULL, 'active'),
    (v_company_id, 'EMP062', 'Yusuf Nurdoğdu', '30106893190', '2025-09-11', NULL, 'active')
    ON CONFLICT (company_id, employee_code) DO NOTHING;

    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE '✅ PERSONEL EKLEMESİ TAMAMLANDI!';
    RAISE NOTICE '============================================';
    RAISE NOTICE '  📊 Toplam: 62 personel eklendi';
    RAISE NOTICE '  🏢 Şirket: Dünyasan Savunma';
    RAISE NOTICE '  📅 Personel Kodları: EMP001 - EMP062';
    RAISE NOTICE '';
    RAISE NOTICE 'Not: Duplikat kayıtlar atlandı (ON CONFLICT)';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
END $$;
