-- Tedarikçileri ekle - 105 Firma
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

    -- Önce mevcut tüm tedarikçileri sil
    DELETE FROM suppliers WHERE company_id = v_company_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RAISE NOTICE '🗑️ % eski tedarikçi kaydı silindi', v_deleted_count;

    -- Tedarikçileri ekle
    INSERT INTO suppliers (company_id, company_name, contact_person, phone, email, tax_number, address, category) VALUES
    (v_company_id, '4K KESİCİ TAKIM', 'SAYIN YETKİLİ', '0555 057 60 27', 'mustafa@4kkesicitakim.com.tr', '10774287', 'İVEDİK OSB 1445 SOK. NO:11 OSTİM/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'AKDAŞ SİLAH A.Ş.', 'SAYIN YETKİLİ', '0533 487 44 17', 'satinalma@akdaşsilah.com', '201172982', 'HUĞLU MAH. HUĞLU CAD. NO:95/A-42710 BEYŞEHİR / KONYA', 'KAPLAMA'),
    (v_company_id, 'AKİFSAN MAKİNA LTD.ŞTİ.', 'SAYIN YETKİLİ', '0532 393 75 00', 'ramazan@akifsan.com', '280161900', 'OSTİM OSB. MAH. AHİEVRAN CAD. NO:85', 'HIRDAVAT'),
    (v_company_id, 'AKTİF KESİCİ TAKIM HIRD.MAK.SAN.VE TİC.LTD.ŞTİ.', 'SAYIN YETKİLİ', '0312 395 05 16', 'info@aktifkesicitakim.com.tr', '042 028 0283', 'MELİH GÖKÇEK BULV.1122 CAD.No:10/C OSTİM - YENİMAHALLE / ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'ALC GRUP KİMYA ANONİM ŞİRKETİ', 'SAYIN YETKİLİ', '0530 38663 52', 'turgut@alcgrup.com.tr', '501399955', 'FATİH MAH.BALÇIK CAD. NO:8 KAHRAMANKAZAN/ANKARA', 'TEMİZLİK'),
    (v_company_id, 'ALMETAL ALÜMİNYUM SANAYİ A.Ş.', 'SAYIN YETKİLİ', '0332 582 88 54', 'info@almetal-tr.com', '470058005', 'HAFİF SANAYİ BÖLGESİ SEYDİŞEHİR/KONYA', 'ALÜMİNYUM'),
    (v_company_id, 'ANKARA KALİBRASYON TEST VE LAB.', 'SAYIN YETKİLİ', '0312 394 67 10', 'info@ankarakalibrasyon.com', '690462172', NULL, 'CİHAZ TEST-SERTİFİKA'),
    (v_company_id, 'ANKASAFETY', 'SAYIN YETKİLİ', '0531 270 49 15', 'info@ankasafety.com', '701112244', 'PINARBAŞI MAH. ZAFER İÇYER CAD. 65/A SİNCAN/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'APEKS İŞLETMECİLİK VE DIŞ TİCARET LİMİTED ŞİRKETİ', 'SAYIN YETKİLİ', '0312 432 27 27', 'info@apeksfotokopi.com', '710000784', 'CEVİZLİRE MAH. 1246 SOKAK NO:4/D BALGAT/ANKARA', 'ETİKET'),
    (v_company_id, 'ARTI MAKİNE', 'SAYIN YETKİLİ', '0541 256 97 73', 'info@artimakine.com.tr', '850055049', 'UZAY ÇAĞI BULVARI NO:66 OSTİM/ ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'ASLAN GRUP KESİCİ TAKIM TEK.HIR.OTO.İNŞ.İTH.İHR.SAN.TİC.LTD.ŞTİ', 'SAYIN YETKİLİ', '0506 957 17 28', 'oguzhan@aslanteknikhirdavat.com', '0891 305 401', 'MELİH GÖKÇEK BULV.HALK İŞ MER.17/2 YENİMAHALLE/ANK', 'KESİCİ TAKIM'),
    (v_company_id, 'ATEMA PAZARLAMA ELEKTRİK SAN.VE TİC.', 'SAYIN YETKİLİ', '0312 395 67 91', 'erdal@atema.com', '990049624', 'İVEDİK ORGANİZE SANAYİ BÖLGESİ EMİNEL YAPI KOOPARATİFİ 1475 CAD NO:11 OSTİM/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'AXIS SAVUNMA SANAYİ TİC.LTD.ŞTİ.', 'SAYIN YETKİLİ', '0216 771 44 71', 'info@axissavunma.com', '1020979087', 'ORTA MAH. ALPARSLAN SOK. NO:8 İÇ KAPI NO :54 KAT:7 KARTAL/İSTANBUL', 'FASON'),
    (v_company_id, 'AYT CNC TAKIM', 'SAYIN YETKİLİ', '0542 329 54 42', 'selcuk@ayttcnc.com', '1250359686', 'F.ÇAKMAK MAH. AHMET PETEKÇİ CAD.KOBİSAN SAN. SİT.NO:17/P KARATAY/KONYA', 'TEKNİK SERVİS'),
    (v_company_id, 'BİLGİNOĞLU ENDÜSTRİ', 'SAYIN YETKİLİ', '0530 568 16 67', 'g.harman@bilginoglu-endustri.com.tr', '1740019240', '2824 SOK. NO: 28 1. SAN. SİT. 35110 İZMİR', 'ÖLÇÜM ALETLERİ'),
    (v_company_id, 'BİLİM ÇELİK BORU KİMYA MADEN MAKİNA SAN. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0312 385 93 45', 'bilimcelik@hotmail.com', '1750412976', 'MEHMET AKİF ERSOY MAH. 328 CAD. NO:2K YENİMAHALLE/ANKARA', 'ÇELİK'),
    (v_company_id, 'BNB KESİCİ TAKIM SANAYİ VE TİC.', 'SAYIN YETKİLİ', '0533 464 12 61', 'info@bnbtakim.com', '54634344306', '1455 CAD.22/57 NEVA HOME İŞ MERKEZİ İVEDİK OSB', 'İNSERT'),
    (v_company_id, 'BROMET METAL', 'SAYIN YETKİLİ', '0537 567 32 91', 'ferit.aydin@brometmetal.com', NULL, NULL, 'ÇELİK HAMMADDE'),
    (v_company_id, 'BURAKHAN AMBALAJ', 'SAYIN YETKİLİ', '0538 489 41 01', 'burakambalaj2010@gmail.com', '17591274826', 'CEMİL MERİÇ CAD. ULUSLAR NO:37/A KAVAKPINAR PENDİK / İSTANBUL', 'AMBALAJ'),
    (v_company_id, 'BY TECH MAKİNA', 'SAYIN YETKİLİ', '0505 405 68 26', 'arif@by-tech.com.tr', '195 067 3498', 'İVEDİK OSB MAH. 2273 CAD. NO: 10/1 YENİMAHALLE/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'CTOOL KESİCİ TAKIM', 'SAYIN YETKİLİ', '0541 440 93 40', 'info@ctool.com.tr', '21500552330', 'Melih Gökçek Bulv. 1418. Cad, No:4 Yenimahalle, Ankara, Türkiye', 'KESİCİ TAKIM'),
    (v_company_id, 'CUNDA ENDÜSTRİYEL MAKİNA', 'SAYIN YETKİLİ', '0539 610 97 66', 'sibel.metin@cundaendüstriyel.com.tr', '2161418298', 'FATİH SULTAN MAH.2700 CAD. NO :3 İÇ KAPI:35 ETİMESGUT/ANKARA', 'BOR YAĞ (OPET)'),
    (v_company_id, 'EDEN MÜHENDİSLİK MİMARLIK YAPI LTD.ŞTİ.', 'SAYIN YETKİLİ', '0538 728 44 22', 'info@edenyapi.com.tr', '3240918143', 'İVEDİK OSB. MAH. 1349.SOK. NO:20 YENİMAHALLE/ANKARA', 'HIRDAVAT'),
    (v_company_id, 'EGC TEKNOLOJİ', 'SAYIN YETKİLİ', '0551 513 13 42', 'info@egcteknoloji.com', '12730164396', 'İNÖNÜ MAH.1754.SOK. NO:7 YENİMAHALLE / ANKARA', 'PLA BASKI'),
    (v_company_id, 'ERSA ENDÜSTRİYEL', 'SAYIN YETKİLİ', '0533 044 05 89', 'info@ersaltd.com', '3680114845', 'İSTANBUL ANADOLU YAKASI O.S.B.7.SOK. NO:9 TUZLA/İSTANBUL', 'ENDÜSTRİYEL'),
    (v_company_id, 'EUROFER KESİCİ TAKIMLAR MAK.SAN.TİC.LTD.ŞTİ', 'SAYIN YETKİLİ', '552 381 93 60', 'mustafa@eurofer.com.tr', '280161900', 'İVEDİK OSB. MAH. 1476 CAD. NO:8/2 YENİMAHALLE/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'FE-BA GRUP', 'SAYIN YETKİLİ', '0530 527 84 74', 'febayapimarket@gmail.com', '3851754752', 'AKŞEMSETTİN MAH. ALPARSLAN TÜRKEŞ BUL. NO:697 MERKEZ/KIRIKKALE', 'HIRDAVAT'),
    (v_company_id, 'FERTER HASSAS MEKANİK İLERİ SAN.VE TİC.', 'SAYIN YETKİLİ', '0232 472 21 60', 'satis@ferter.com.tr', NULL, '6172 SOK. NO:8 IŞIKKENT 35070 İZMİR/TÜRKİYE', 'ÖZEL TAKIM-MASTAR'),
    (v_company_id, 'FETAŞ SANAYİ ANONİM ŞİRKETİ', 'SAYIN YETKİLİ', '0533 160 56 63', 'zuhal.susmaz@ftsgroup.com.tr', '3850647355', 'İSTANBUL TUZLA ORG.SAN.BÖLG. TUZLA / İSTANBUL', 'HIRDAVAT'),
    (v_company_id, 'FORMAL ALÜMİNYUM', 'SAYIN YETKİLİ', '0533 387 02 14', 'www.formal.com.tr', '3880411814', 'ORGANİZE SAN.BÖL. 35 CAD. NO:27 38070 KAYSERİ', 'KALIP TEDARİK'),
    (v_company_id, 'FORZA KESİCİ TAKIMLAR MAK. SAN. Ve TİC. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0544 354 98 50', 'arif@forzaglobal.com.tr', '388 131 5770', 'İVEDİK OSB MAH. MELİH GÖKÇEK BUL. MAXİVEDİK İŞ MERK.112 CAD.NO:20/113 YENİMAHALLE/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'FURKAN MAKİNA TAKIM SAN. TİC. LTD.ŞTİ.', 'SAYIN YETKİLİ', '0555 975 63 84', 'muhasebe@furkantakim.com.tr', '3880105569', 'YAKACIK ÇARŞI MAH. KARTAL CAD.KASTELLİ SAN. SİT. C BLOK NO:20 KARTAL/İSTANBUL', 'TUTUCU-PENS'),
    (v_company_id, 'GK ÇELİK', 'SAYIN YETKİLİ', '0534 359 60 36', 'ayberk.sezen@celmercelik.com', '3960664446', 'ŞEKERPINAR MAH. SARMAŞIK SOK. NO:9 ÇAYIROVA GEBZE /KOCAELİ', 'HAMMADDE'),
    (v_company_id, 'GROOXE ÇELİK', 'SAYIN YETKİLİ', '0549 530 06 55', 'info@grooxe.com', NULL, 'Ostim OSB. Mah. 1202/1 Cadde (Eski 31. Sok.) No: 49-51-53-55 Yenimahalle/ANKARA', 'ÇELİK HAMMADDE'),
    (v_company_id, 'GÜRAY TAŞLAMA MAKİNA', 'SAYIN YETKİLİ', '0312 394 34 09', 'guraytaslama@taslama.com', '4400588922', 'İVEDİK OSB MAH. ÖZPETEK SAN. SİT. 1407. SOK. NO :4 YENİMAHALLE / ANKARA', 'HIRDAVAT'),
    (v_company_id, 'GÜVENAL KALIP ELEMANLARI A.Ş.', 'SAYIN YETKİLİ', '0212 501 53 81', 'anadoluteklif@guvenal.org', '4510315097', 'RAMİ KIŞLA CAD. EMİNTAŞ-3 SAN. SİTESİ NO:56-57 TOPÇULAR/EYÜP/İSTANBUL', 'HIRDAVAT'),
    (v_company_id, 'HASÇELİK', 'SAYIN YETKİLİ', '0312 815 51 11', 'info@hascelik.com', NULL, 'Susuz, İstanbul Yolu 24.km, 06980 Kahramankazan/Ankara', 'ÇELİK HAMMADDE'),
    (v_company_id, 'HMS TEST KONTROL GÖZETİM VE BELGELENDİRME', 'SAYIN YETKİLİ', '0312 472 60 40', 'hms@hms.com.tr', '4630340880', 'ÇETİN EMEÇ BUL. KABİL CAD. 1330 SOK. NO:7/5 A.ÖVEÇLER 06450 DİKMEN/ANKARA', 'DANIŞMANLIK'),
    (v_company_id, 'İMBA BİLİŞİM TİCARET LİMİTED ŞİRKETİ', 'SAYIN YETKİLİ', '0534 241 06 56', 'taka@imbacloud.com', '4740845021', 'İNKILAP MAH.DR.ADNAN BÜYÜK DENİZ CAD. 2 BLOK NO:4 İÇ KAPI NO:2', 'YAZILIM-SİSTEM'),
    (v_company_id, 'KAMA PLASTİK', 'SAYIN YETKİLİ', '0312 336 26 26', 'info@kamaplastik.com', '1212065424', 'ŞEHİT CEM ERSEVER CAD. NO:6/B DEMETEVLER / ANKARA', 'PLASTİK'),
    (v_company_id, 'KAPTAN KESİCİ TAKIM HIRDAVAT TİC.LTD.ŞTİ', 'SAYIN YETKİLİ', '0537 378 31 74', 'info@kaptankesici.com', '4990416928', 'S.ORHAN MAH. 1181/1 SOK. NO: 6B GEBZE/KOCAELİ', 'KESİCİ TAKIM'),
    (v_company_id, 'KARCAN KESİCİ TAKIMLAR A.Ş.', 'SAYIN YETKİLİ', '0534 644 69 12', 'b.kececi@karcan.com', '5230602610', 'OSB, Organize Sanayi Bölgesi 20. Cadde No:31, 26110 Odunpazarı/Eskişehir', 'KESİCİ TAKIM'),
    (v_company_id, 'KARDEŞLER KESİCİ TAKIM', 'SAYIN YETKİLİ', '0553 661 01 09', 'info@kardeslerhirdavat.com.tr', '5240586382', 'İVEDİK OSB ÖZ ANKARA SAN.SİT. 1419 CAD. NO :4 İVEDİK/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'KARMATEK KESİCİ TAKIM SAN. VE TİC. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0542 726 69 89', 'satis4@karmatekkesici.com', '5240589070', 'İkitelli OSB ESOT sanayi sitesi L Blok No16 Başakşehir İstanbul', 'KESİCİ TAKIM'),
    (v_company_id, 'KARSAN TEKNİK TAKIM', 'SAYIN YETKİLİ', '0507 221 06 44', 'gani@karsanteknik.com', '23479615254', 'MİMARSİNAN MAH. KÜÇÜK SAN. SİT. 21 CAD. NO:52 MERKEZ/ÇORUM', 'KESİCİ TAKIM'),
    (v_company_id, 'KESKİN LAZER', 'SAYIN YETKİLİ', '0555 607 93 80', 'keskinlazer@gmail.com', '5471155724', 'İVEDİK OSB. MAH. 1473 SOK. NO:68 06374 YENİMAHALLE / ANKARA', 'LAZER KESİM'),
    (v_company_id, 'KİWA BELGELENDİRME HİZMETLERİ A.Ş.', 'SAYIN YETKİLİ', '0312 472 60 40', 'rabia.engin@kiwa.com', '6200530464', 'TUZLA ORG.SAN.BLG.9.CAD. NO:15 TEPEÖREN TUZLA/İSTANBUL', 'CİHAZ TEST-SERTİFİKA'),
    (v_company_id, 'KOÇEL A.Ş', 'SAYIN YETKİLİ', '0532 387 99 39', 'www.kocel.com.tr', '5730383779', 'MAHMUTBEY MH.KÖPRÜ CAD. NO:10 BAĞCILAR / İSTANBUL', 'HIRDAVAT'),
    (v_company_id, 'LOGARİTMA KESİCİ TAKIM', 'SAYIN YETKİLİ', '0537 734 31 77', 'v.sahin@logaritmamuhendislik.com', '6091375354', 'İVEDİK OSB MAH. 1440 CAD. NO:1 İÇ KAPI NO:103 YENİMAHALLE/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'MAKİM HASSAS DÖKÜM', 'SAYIN YETKİLİ', '0312 267 56 87', 'haydogan@makim.com.tr', NULL, 'Ankara Uzay ve Havacılık İhtisas OSB, HAB OSB Mahallesi, G5 cadde No:4, 06980 Kahramankazan/ANKARA - TÜRKİYE', 'HASSAS DÖKÜM'),
    (v_company_id, 'ORALSAN MAKİNA TAKIM SAN. VE TİC. A.Ş.', 'SAYIN YETKİLİ', '0212 143 27 05', 'k.kaya@orm-tr.com', '6450010023', 'TERSANA CAD. NO:71 KARAKÖY/İSTANBUL', 'ÖZELTAKIM-KILAVUZ'),
    (v_company_id, 'ORJİNAL KARTON AMBALAJ SAN.TİC. A.Ş.', 'SAYIN YETKİLİ', '0555 962 80 79', 'satisdestek@karteksambalaj.com.tr', '6470606677', 'YENİCE MAH. YILANLIPINAR KÜME EVLER NO:8/C', 'AMBALAJ-KARTON'),
    (v_company_id, 'ÖZKAYALI MAKİNA A.Ş.', 'SAYIN YETKİLİ', '0332 345 46 14', 'muhasebe@ozkayali.com.tr', '6990748673', 'BÜYÜKKAYACIK OSB.MAH. 509 NOLU SOK. NO:14 SELÇUKLU/KONYA', 'KESİCİ TAKIM'),
    (v_company_id, 'SAĞLAM KAYNAK MAKİNA HIRDAVAT', 'SAYIN YETKİLİ', '0312 354 74 15', 'info@saglamkaynakirdavat.com', '54178607738', 'UZAY ÇAĞI CAD. UZAY ÇAĞI İŞ MERKEZİ NO:87/18 OSTİM/YENİMAHALLE', 'HIRDAVAT'),
    (v_company_id, 'SERPA HASSAS DÖKÜM', 'SAYIN YETKİLİ', '0532 377 48 77', 'serpa@serpahassasdokum.com', NULL, 'Organize Deri Sanayi Bölgesi M1-12 Özel Parsel Tav Cad.No:15 Tuzla – İSTANBUL', 'HASSAS DÖKÜM'),
    (v_company_id, 'SEYKOÇ', 'SAYIN YETKİLİ', '0538 056 71 77', 'ahmet.sahin@seykoc.com.tr', NULL, 'Ostim OSB, 1231. Sk., 06374 Yenimahalle/Ankara', 'ALÜMİNYUM HAMMADDE'),
    (v_company_id, 'SİMA ALÜMİNYUM', 'SAYIN YETKİLİ', '0534 225 64 18', 'erdem.ayyildiz@simaaluminyum.com', NULL, 'Çerkeşli OSB / İMES 5 Bulvarı No:4 Dilovası/Kocaeli', 'KALIP TEDARİK'),
    (v_company_id, 'SİMYA MAKİNA TAKIM SAN VE TİC.LTD.ŞTİ', 'SAYIN YETKİLİ', '0535 662 34 23', 'info@simyamakina.com', '7700311520', 'MERKEZ EFENDİ MAH. DAVUTPAŞA CAD. KALE İŞ MERKEZİ NO:31', 'ÖZEL TAKIM'),
    (v_company_id, 'SOYA GIDA TARIM ENDÜSTİRİYEL', 'SAYIN YETKİLİ', '0312 395 58 22', 'k.karatas@soya.com.tr', '775015779', '692 SOK. NO: 10 İVEDİK OSTİM-06370 ANKARA/ POLATLI', 'KESİCİ TAKIM'),
    (v_company_id, 'TAŞÇELİK DEMİR ÇELİK MAKİNA', 'SAYIN YETKİLİ', '0312 354 79 24', 'ersanyavuz@tascelik.com.tr', '8260519696', 'OSTİM 1232 SOK. NO:22 YENİMAHALLE / ANKARA', 'HAMMADDE'),
    (v_company_id, 'TUNCEL METAL SAN.TİC. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0532 614 33 23', 'info@tuncelmetal.com.tr', '8640014609', 'RAMİ KIŞLA CAD. ERKA SOK. EMİNTAŞ ERCİYES SAN. SİT.NO:125/97 RAMİ/İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'TURCAR HASSAS KESİCİ TAKIM SAN.', 'SAYIN YETKİLİ', '0549 449 20 22', 'duygu.aksu@turcar.com.tr', '8690443889', 'KIRIKKALE SİLAH İHTİSAS OSB FABRİKALAR MAH.2 SOK. NO:12', 'KESİCİ TAKIM'),
    (v_company_id, 'UCT MÜHENDİSLİK', 'SAYIN YETKİLİ', '0539 618 58 11', 'umut@uctmuhendislik.com.tr', '8831186756', 'İKİTELLİ OSB MAH. METAL İŞ 5A BLOK NO:50/50 BAŞAKŞEHİR/İSTANBUL', 'KESİCİ TAKIM'),
    (v_company_id, 'UGY ENDÜSTRİYEL TEKNOLOJİ METAL SAN. VE TİC.LTD.ŞTİ.', 'SAYIN YETKİLİ', '0546 235 97 21', 'info@ugykesici.com', '8850977095', 'MİMAR SİNAN MAH. ÜSKÜDAR CAD. YEDPA TİC.MRK. G 24 ATAŞEHİR/İSTANBUL', 'ÖZEL TAKIM'),
    (v_company_id, 'UMS ANKARA KALİBRASYON', 'SAYIN YETKİLİ', '0534 891 08 32', 'kalibrasyon@umsankara.com.tr', '8920298801', 'ÖRNEK SANAYİ SİTESİ 1267/1 SOK.NO:5 06374 OSTİM/ANKARA', 'CİHAZ TEST-SERTİFİKA'),
    (v_company_id, 'VİB-KUM YÜZEY İŞLEM MAKİNA SAN. TİC.LTD.ŞTİ.', 'SAYIN YETKİLİ', '0546 816 81 65', 'vibkum@vibkum.com', '9251211789', 'FEVZİ ÇAKMAK MAH.10503 SOK. NO :4 KARATAY/KONYA', 'ENDÜSTRİYEL'),
    (v_company_id, 'YALIN KESİCİ TAKIM SAN. TİC. LTD.ŞTİ.', 'SAYIN YETKİLİ', '0545 612 10 44', 'info@masterct.com.tr', '9331107550', 'ERİKLİMAN MAH. 174 NOLU SOK.CELEBİOĞLU TEPE EVLERİ NO:20/6 MERKEZ/GİRESUN', 'KESİCİ TAKIM'),
    (v_company_id, 'YD DENİZ TİCARET LTD.ŞTİ. CASTROL', 'SAYIN YETKİLİ', '0530 604 35 65', 'Sibel.uner@yddeniz.com', '9460249115', 'BAHÇEKAPI MAH. 2472 CAD. NO:7/1 ŞAŞMAZ ETİMESGUT/ANKARA', 'BOR YAĞ (CASTROL)'),
    (v_company_id, 'YILDIZLAR İŞ ELBİSELERİ EKİPMANLARI', 'SAYIN YETKİLİ', '0530 322 91 93', 'info@yildizlarisg.com', '965 060 6466', 'İVEDİK OSB MAH.1341.CD NO:79/2 OSTİM-YENİMAHALLE/ANKARA', 'İŞ ELBİSELERİ'),
    (v_company_id, 'YILMAZ REDÜKTÖR', 'SAYIN YETKİLİ', '0530 167 51 38', 'merih.aroz@yr.com.tr', '9780049288', 'ATATÜRK MAH. LOZAN CAD. NO:17 PK: 34522 ESENYURT/İSTANBUL', 'HIRDAVAT'),
    (v_company_id, 'YILMAZLAR ÇELİK SAN. VE TİC. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0532 644 38 30', 'bayramaygun@yilmazlarcelik.com', '9780075319', '1.SOKAK NO:72 OSTİM/ANKARA', 'HAMMADDE'),
    (v_company_id, 'YİKOM BASINÇLI HAVA SİSTEMLERİ', 'SAYIN YETKİLİ', '0553 625 3846', 'yikom2024@gmail.com', '37439207656', 'ÖZPETEK SİTESİ 1390 SOK. NO:10 İVEDİK YENİMAHALLE/ ANKARA', 'BAKIM ONARIM'),
    (v_company_id, 'VNS GROUP METAL', 'SAYIN YETKİLİ', '0546 225 62 29', 'vns@vnsmetal.com', '9251161599', 'ALAADDİNBEY MAH.624 SOK. MEŞE-5 İŞ MRK.SİT.E BLOK NO:26E/1 NİLÜFER/BURSA', 'KESİCİ TAKIM'),
    (v_company_id, 'EPİK KESİCİ TAKIM LTD.ŞTİ.', 'SAYIN YETKİLİ', '0542 299 86 17', 'info@kesicitakim.com', NULL, 'İVEDİK OSB 1476 SOK. İVEDİK İŞ MERKEZİ NO:8/8 YENİMAHALLE/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'OFİS OSTİM', 'SAYIN YETKİLİ', '0312 385 85 76', 'muhasebe@ofisostim.com', '6340207192', 'BAĞDAT CAD. NO.368 OSTİM-YENİMAHALLE/ANKARA', 'KIRTASİYE'),
    (v_company_id, 'NEWLİNE KESİCİ TAKIM', 'SAYIN YETKİLİ', '0546 677 62 69', 'info@trnewline.com', '6311732643', 'YUKARI DUDULLU ESENKENT MAH. HOCA NASRETTİN CAD. NO/13 ÜMRANİYE / İSTANBUL', 'KESİCİ TAKIM'),
    (v_company_id, 'UZMAN KESİCİ TAKIM', 'SAYIN YETKİLİ', '0212 544 02 72', 'info@uzmanhirdavat.com', '9010356196', 'RAMİ KIŞLA CAD. TOPÇULAR MAH. NO:58/60K', 'KESİCİ TAKIM'),
    (v_company_id, 'URANUS KESİCİ TAKIM SAN. VE TİC.LTD.ŞTİ', 'SAYIN YETKİLİ', '0212 612 64 79', 'info@uranuskesicitakim.coım.tr', '8930438733', 'TOPÇULAR MH. RAMİ KIŞLA CD. TOPÇULAR SAN.ST No:3 EYÜPSULTAN/İSTANBUL', 'KESİCİ TAKIM'),
    (v_company_id, 'AK MAKİNA SANAYİ VE TİCARET LTD. Ş.T.İ.', 'SAYIN YETKİLİ', '0212 612 87 00', 'servis@akmakina.com.tr', NULL, 'ABDİ İPEKÇİ CAD. NO:58 P.K. 34030 BAYRAMPAŞA/İSTANBUL', 'SERVİS-BAKIM'),
    (v_company_id, 'FETİH KESİCİ TAKIMLAR SAN. TİC. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0532 309 26 23', 'info@fetihteknik.com', NULL, 'TOPÇULAR MH. RAMİ KIŞLA CD. TOPÇULAR SAN.ST No:23/19 EYÜPSULTAN/İSTANBUL', 'KESİCİ TAKIM'),
    (v_company_id, 'SBA CNC KESİCİ TAKIMLAR MAKİNA', 'SAYIN YETKİLİ', '0534 594 69 51', NULL, NULL, 'FEVZİ ÇAKMAK MAH.AHMET PETEKÇİ CAD. 7. BLOK NO:10 KARATAY/KONYA', 'KESİCİ TAKIM'),
    (v_company_id, 'GÜÇTAŞ TEKNİK HIRDAVAT KESİCİ TAKIMLAR', 'SAYIN YETKİLİ', '0312 385 76 71', 'infoæguctas.com.tr', '4130642459', 'UZAY ÇAĞI CAD. UZAY ÇAĞI CAD. AYIK İŞ MRK NO:82 C16 OSTİM/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'CCN MAKİNA SANAYİ TİC. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0532 220 89 86', NULL, '2030898699', 'VELİBABA MAH. MİMAR SİNAN CAD. VELİBABA SAN. SİT. F BLOK NO:24', 'HIRDAVAT'),
    (v_company_id, 'TAMSAN COMPRESSORS SAN. VE TİC. A.Ş', 'SAYIN YETKİLİ', '4447520', 'www.tamsan.com.tr', NULL, 'BAŞKENT OSB. 18. CAD. NO:38 SİNCAN / ANKARA', 'BAKIM ONARIM'),
    (v_company_id, 'MURAT GİYİM İŞ ELBİSELERİ', 'SAYIN YETKİLİ', '0312 255 46 16', 'info@muratgiyim.com', '36124210582', 'GERSAN SAN. SİT. 2305.SOK. NO:484 ERGAZİ/ANKARA', 'İSG'),
    (v_company_id, 'AS SPOR MALZEMELERİ', 'SAYIN YETKİLİ', '0318 225 50 68', NULL, '2100164561', 'OVACIK MAH. ANKARA CAD. NO:71/19573', 'İSG'),
    (v_company_id, 'ATA İŞ ELBİSELERİ', 'SAYIN YETKİLİ', '0530 775 61 00', 'muhasebe@isg.com.tr', '9960496048', 'EMKO SAN. SİT. 1.CAD. NO /39A HAS PLAZA ESKİŞEHİR/ ODUNPAZARI', 'İSG'),
    (v_company_id, 'ATEK KESİCİ TAKIM', 'SAYIN YETKİLİ', '0544 348 28 35', 'e.yuksel@atekkesici.com', '991042273', 'OSTİM OSB MAH. UZAYÇAĞI CAD. 154/43 YENİMAHALLE/ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'DETAY CNC MAKİNA TAKIM SAN.', 'SAYIN YETKİLİ', '0532 503 46 92', 'info@detaycnc.com.tr', NULL, 'SANAYİ MAH. 60510 NOLU SOK. NO:6 ŞEHİTKAMİL/GAZİANTEP', 'TORNA CNC'),
    (v_company_id, 'NYG METALURJİ MAK.İML.İNŞ.İTH.İHR.SAN. VE TİC. LTD.ŞTİ.', 'SAYIN YETKİLİ', '0505 973 12 00', 'muhasebe@nygteknik.com', '6320474807', 'TUZLA DERİ ORGANİZE SAN. BÖLGESİ KADİFE CAD. NO:7 R.8 TUZLA/ İSTANBUL', 'KUM FİRMA'),
    (v_company_id, 'PETROTECH MÜH. VE END. ÜRÜN SAN. TİC. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0530 065 09 58', 'burak.saygipetro-tech.com.tr', NULL, 'KENİTRA CAD. ARTAR 5 SANAYİ SİTESİ NO:6/A KARATAY/KONYA', 'BOR YAĞ'),
    (v_company_id, 'BM MADENİ YAĞLAR SANAYİ VE TİCARET LTD.ŞTİ.', 'SAYIN YETKİLİ', '0543 634 99 34', 'burak@bmmadeniyaglar.com', '1781732155', 'RAMİ KIŞLA CAD. GÜNDOĞAR İŞ MERKEZİ 2 SAN. SİT. NO 1/82 EYÜPSULTAN/İSTANBUL', 'BOR YAĞ'),
    (v_company_id, 'OYKO OTO YAĞ KOZMETİK TİC. VE SAN. LTD.ŞTİ.', 'SAYIN YETKİLİ', '0554 340 00 17', 'erguncetin@oykoltd.com', '6490044994', 'İNÖNÜ MAH. FATİH SULTAN MEHMET BULV. BATI PARK İŞ MERKEZİ C BLOK NO:5 YENİMAHALLE/ANKARA', 'BOR YAĞ'),
    (v_company_id, 'ERBA MÜHENDİSLİK MAKİNE SAN. TİC. LTD. ŞTİ.', 'SAYIN YETKİLİ', '0212 771 18 88', 'erba@erba.com.tr', NULL, 'ATATÜRK SANAYİ HADIMKÖY MAH. ÜRGÜPLÜ CAD. NO:42 ARNAVUTKÖY/İSTANBUL', 'KUMLAMA MALZEMESİ'),
    (v_company_id, 'KONTROL KESİCİ TAKIMLAR', 'SAYIN YETKİLİ', '0530 954 75 29', 'aliinsu@kontrolkesici.com', '5761151317', 'FEVZİÇAKMAK MAH. MEDCEZİR CAD.NO:8/133 KARATAY/KONYA', 'KESİCİ TAKIM'),
    (v_company_id, 'KKD DONANIM ENDÜSTRİYEL TEKNOLOJİLERİ', 'SAYIN YETKİLİ', '0542 214 86 10', 'info@kkddonanim.com', '5641394219', 'KIZILIRMAK MAH.BAYRAKTAR CAD.NO:8/B TEKKEKÖY/SAMSUN', 'ENDÜSTRİYEL'),
    (v_company_id, 'KAP SAN STANDART KALIP MALZEMELERİ', 'SAYIN YETKİLİ', '0216 378 87 80', NULL, NULL, 'RAMAZANOĞLU MAH. YAREN SOK. NO:3 PENDİK/İSTANBUL', 'KALIP'),
    (v_company_id, 'EGE TEKNİK HIRDAVAT', 'SAYIN YETKİLİ', '0543 445 08 89', 'info@egeteknikhirdavat.com', '3251114506', 'TOPÇULAR MAH. RAMİ KIŞLA CAD. SARIYAŞAR PALA İŞ MERKEZİ NO:23/17 EYÜPSULTAN / İSTANBUL', 'HIRDAVAT'),
    (v_company_id, 'MAKTEK MÜHENDİSLİK', 'SAYIN YETKİLİ', '0552 418 58 06', 'infomaktekendustri.com.tr', '6111789849', 'ERTUĞRULGAZİ MAH. MUAMMER AKSOY CAD.NO:92/A SİNCAN/ANKARA', 'MÜHENDİSLİK'),
    (v_company_id, 'SEYHAN TEKNİK HIRDAVAT', 'SAYIN YETKİLİ', '0535 824 82 45', 'sey-hanteknik@hotmail.com', '44920569896', 'FEVZİ ÇAKMAK MAH. GÜLİSTAN CAD. GÜLİSTAN TİCARET VE FİNANS MERKEZİ NO:74 KARATAY/KONYA', 'HIRDAVAT'),
    (v_company_id, 'SAMSAMA TEKNİK', 'SAYIN YETKİLİ', '0532 215 45 46', 'info@samsamateknik.com', '7420952058', 'TOPÇULAR MAH. RAMİ KIŞLA CAD. ÜRETMEN İŞ MERKEZİ A BLOK NO:61 İÇ KAPI :116 EYÜP/İSTANBUL', 'TEKNİK'),
    (v_company_id, 'İHYA KESİCİ TAKIM', 'SAYIN YETKİLİ', '0212 544 3440', 'info@ihyakesicitakim.com', '56620511792', 'YENİDOĞAN MH. ÇEVREYOLU CAD. NO:18/A BAYRAMPAŞA /İSTANBUL', 'KESİCİ TAKIM'),
    (v_company_id, 'ZİRVE KESİCİ TAKIM', 'SAYIN YETKİLİ', '0212 75 37', NULL, '9980725325', 'TOPÇULAR MH. RAMİ KIŞLA CD. YÖNTEM VAYTAŞ PLAZA BLOK NO:58 EYÜPSULTAN/İSTANBUL', 'KESİCİ TAKIM'),
    (v_company_id, 'SİS KAPLAMA MAKİNE İNŞAAT TEKSTİL SANAYİ VE TİCARET LİMİTED ŞİRKETİ', 'SAYIN YETKİLİ', NULL, NULL, '7710721477', '118 SK. No:9', 'KAPLAMA');

    RAISE NOTICE '✅ Toplam 105 tedarikçi başarıyla eklendi!';
END $$;

-- Özet rapor
SELECT
    category,
    COUNT(*) as adet
FROM suppliers
GROUP BY category
ORDER BY adet DESC;
