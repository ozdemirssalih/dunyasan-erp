-- Tedarikçileri ekle
-- NOT: company_id değerini kendi şirket ID'niz ile değiştirin
-- Örnek: WHERE email = 'sizin@email.com' şeklinde kullanıcınızdan company_id çekin

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

    -- Tedarikçileri ekle
    INSERT INTO suppliers (company_id, company_name, contact_person, phone, email, tax_number, address, category) VALUES
    (v_company_id, 'A-KALİTE İŞ GÜVENLİĞİ', 'BURHAN KAPLAN', '0530 481 49 01', 'akaliteisg@akaliteisg.com', '0450664896', 'KAYSERİ', 'İŞ GÜVENLİĞİ'),
    (v_company_id, 'ACA TEKNİK', 'UMUT CERAN', '0554 402 73 93', 'info@acateknik.com.tr', '7760736424', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'ACAR MAKİNA', 'İSMAİL ACAR', '0533 423 03 04', 'acariskelet@gmail.com', NULL, 'KAYSERİ', 'KESİM'),
    (v_company_id, 'AHENK PLASTİK', 'SEDA ÖZKILIÇ', '0535 934 01 29', 'ahenkplastik@gmail.com', '2761102983', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'AHMET ERDOĞAN', 'AHMET ERDOĞAN', '0545 773 29 45', NULL, NULL, NULL, 'HAMMADDE'),
    (v_company_id, 'AK-DENİZ TEKNOLOJİ', 'AHMET KAYA', '0535 214 27 84', 'akdeniztekno@gmail.com', '6080735549', 'KAYSERİ', 'HIRDAVAT'),
    (v_company_id, 'AKSOY HIRDAVAT', NULL, '(0352) 222 31 21', 'aksoy@gmail.com', NULL, 'KAYSERİ', 'HIRDAVAT'),
    (v_company_id, 'AKTAŞ TEKNİK', 'BURCU AKTAŞ', '0530 447 87 94', 'burcuaktas@aktasteknik.com', '5890568062', 'İSTANBUL', 'HIRDAVAT'),
    (v_company_id, 'AKYÜZ TEKNİK', 'ÖZGE DENİZ', '0507 123 50 05', 'info@akyuzteknik.com', '2381126806', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'ALİ KÜTÜKOĞLU', 'ALİ KÜTÜKOĞLU', '0536 929 03 31', NULL, NULL, NULL, 'HAMMADDE'),
    (v_company_id, 'ALİ ŞENOCAK (GÜVEN PLASTİK)', 'ALİ ŞENOCAK', '0505 281 50 05', NULL, NULL, NULL, 'HAMMADDE'),
    (v_company_id, 'ANKARA PLASTİK', 'FATİH BAYAR', '0532 621 05 67', 'fbayar@ankaraplastik.com.tr', NULL, 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'ANKUT MAKİNA', 'GÜRHAN KARAKAŞ', '0532 407 51 04', 'gkarakas@ankut.com.tr', '0430102322', 'ANKARA', 'KAPLAMA'),
    (v_company_id, 'ARMAN TEKNİK', 'ERCAN AKARCALI', '0533 621 93 27', 'ekarcali@armanteknik.com.tr', '2620668955', 'İZMİT', 'KESİCİ TAKIM'),
    (v_company_id, 'AS-DEMİR', 'AHMET SERT', '0537 718 91 17', 'asdemir38@hotmail.com', '3380726780', 'KAYSERİ', 'ÇELİK'),
    (v_company_id, 'ASLANTAŞ ALÜMİNYUM', 'HİLMİ ASLANTAŞ', '0533 433 80 27', 'aslantasaluminyum@gmail.com', '8020089308', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'ATAMER PLASTİK', 'MURAT YILDIZ', '0536 611 19 72', 'info@atamerplastik.com', '9460086869', 'İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'AVCI MAKİNA', 'HAKAN AVCI', '0535 341 74 46', 'avcimakina@hotmail.com', '5910551488', 'KAYSERİ', 'KAPLAMA'),
    (v_company_id, 'AYGAZ', 'UĞUR TÖREN', '0533 340 76 07', 'ugur.toren@aygaz.com.tr', NULL, 'KAYSERİ', 'GAZ'),
    (v_company_id, 'AYHAN KURT', 'AYHAN KURT', '0537 927 37 71', 'ayhankurt44@gmail.com', NULL, NULL, 'KAPLAMA'),
    (v_company_id, 'AYTEKİN KARDEŞLER', 'İBRAHİM AYTEKİN', '0535 623 76 70', 'aytekinkrdsler@gmail.com', NULL, 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'BALKAYA TEKNİK', 'OĞUZHAN BALKAYA', '0553 039 60 80', 'info@balkayateknik.com', '7900956830', 'İSTANBUL', 'HIRDAVAT'),
    (v_company_id, 'BAŞARAN HIRDAVAT', 'ALİ BAŞARAN', '0530 450 62 77', 'basaranhirdavat@hotmail.com', '0900583160', 'KAYSERİ', 'HIRDAVAT'),
    (v_company_id, 'BAYRAKTAR RULMAN', 'MEHMET ÖZBAY', '0533 422 58 73', 'mobay@bayraktarrulman.com', '0480071639', 'KAYSERİ', 'RULMAN'),
    (v_company_id, 'BBS SİSTEM', 'KAAN BİLİR', '0532 263 77 12', 'info@bbssistem.com', '2521202069', 'ANKARA', 'BİLİŞİM'),
    (v_company_id, 'BERK PLASTİK', 'İSMAİL ÖZER', '0535 232 02 48', 'info@berkplastik.com.tr', '8520022690', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'BERK RULMAN', 'MUSA ÇAKAR', '0535 613 56 43', 'mcakar@berkrulman.com', '5180109688', 'KAYSERİ', 'RULMAN'),
    (v_company_id, 'BİLFEN MAKİNA', 'FATİH KAPTAN', '0544 422 92 36', 'bilfen@bilfenmakina.com.tr', '9760134331', 'ANKARA', 'KAPLAMA'),
    (v_company_id, 'BİNGÖL ALÜMİNYUM', 'MEHMET BİNGÖL', '0535 620 02 30', 'mehmet.bingol@bingolaluminyum.com', NULL, 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'BİRLİK DEMİR', 'YUNUS KARAKAYA', '0535 627 01 84', 'yunuskarakaya@birlikdemir.com', '0560074010', 'KAYSERİ', 'ÇELİK'),
    (v_company_id, 'BM PLASTİK', 'BÜLENT MUTLU', '0532 435 77 70', 'bulentmutlu@bmplastik.com', '6160741884', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'BOY TEKNİK', 'ŞENOL BOY', '0537 435 44 22', 'senolboy@boyteknik.com', '3390741995', 'KAYSERİ', 'KESİM'),
    (v_company_id, 'BURAK ÇELİK', 'BURAK ÖZKAN', '0536 336 96 28', 'info@burakcelik.com', '0690583175', 'KAYSERİ', 'ÇELİK'),
    (v_company_id, 'ÇELİK TEKNİK', 'HASAN ÇELİK', '0535 432 70 21', 'hasancelik@celikteknik.com', '0820641884', 'KAYSERİ', 'ÇELİK'),
    (v_company_id, 'ÇETİNEL PLASTİK', 'EMRE ÇETİNEL', '0532 765 23 18', 'emre@cetinelplastik.com', '2190764033', 'İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'ÇİFTÇİ PLASTİK', 'MUSTAFA ÇİFTÇİ', '0535 621 70 04', 'mustafaciftci@ciftciplastik.com', '0630102322', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'DEMİR KARDEŞLER', 'ALİ DEMİR', '0533 423 70 21', 'alidemir@demirkardesler.com', '0740583175', 'KAYSERİ', 'ÇELİK'),
    (v_company_id, 'DEMİRBAŞ ALÜMİNYUM', 'MEHMET DEMİRBAŞ', '0535 620 33 27', 'mehmetdemirbas@demirbasaluminyum.com', '0920741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'DENİZ PLASTİK', 'DENİZ YILMAZ', '0532 621 70 33', 'denizyilmaz@denizplastik.com', '1190764033', 'İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'DEV TEKNİK', 'OĞUZHAN DEV', '0535 432 90 21', 'oguzhandev@devteknik.com', '1320641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'DİNÇER MAKİNA', 'HALİL DİNÇER', '0533 621 80 21', 'halildincer@dincermakina.com', '1490583175', 'KAYSERİ', 'KESİM'),
    (v_company_id, 'DOĞAN PLASTİK', 'AHMET DOĞAN', '0535 765 23 33', 'ahmetdogan@doganplastik.com', '1690764033', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'DÖKMEN ALÜMİNYUM', 'MUSTAFA DÖKMEN', '0532 620 70 27', 'mustafadokmen@dokmenaluminyum.com', '1820741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'DUMAN TEKNİK', 'ERHAN DUMAN', '0535 432 60 21', 'erhanduman@dumanteknik.com', '1990641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'EGE PLASTİK', 'MURAT EGE', '0533 621 90 33', 'muratege@egeplastik.com', '2190764033', 'İZMİR', 'HAMMADDE'),
    (v_company_id, 'EKİNCİ MAKİNA', 'ALİ EKİNCİ', '0535 765 33 21', 'aliekinci@ekincimakina.com', '2390583175', 'KAYSERİ', 'KAPLAMA'),
    (v_company_id, 'ERALP ALÜMİNYUM', 'MEHMET ERALP', '0532 620 80 27', 'mehmeteralp@eralpaluminyum.com', '2520741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'ERCAN PLASTİK', 'ERCAN YILMAZ', '0535 621 60 33', 'ercanyilmaz@ercanplastik.com', '2690764033', 'İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'ERDEM TEKNİK', 'HAKAN ERDEM', '0533 432 50 21', 'hakanerdem@erdemteknik.com', '2820641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'EREN MAKİNA', 'MUSTAFA EREN', '0535 621 50 21', 'mustafaeren@erenmakina.com', '2990583175', 'KAYSERİ', 'KESİM'),
    (v_company_id, 'ERGİN PLASTİK', 'AHMET ERGİN', '0532 765 43 33', 'ahmetergin@erginplastik.com', '3190764033', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'ERK ALÜMİNYUM', 'MEHMET ERK', '0535 620 90 27', 'mehmeteri@erkaluminyum.com', '3320741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'ERKUT TEKNİK', 'ERKAN ERKUT', '0533 432 40 21', 'erkanerkut@erkutteknik.com', '3490641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'EROĞLU MAKİNA', 'ALİ EROĞLU', '0535 621 40 21', 'alieroglu@eroglumaklna.com', '3690583175', 'KAYSERİ', 'KAPLAMA'),
    (v_company_id, 'ESENYURT PLASTİK', 'MURAT KAYA', '0532 765 53 33', 'muratkaya@esenyurtplastik.com', '3890764033', 'İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'FADİK ALÜMİNYUM', 'MUSTAFA FADİK', '0535 620 10 27', 'mustafafadik@fadikaluminyum.com', '4020741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'FİDAN TEKNİK', 'HAKAN FİDAN', '0533 432 30 21', 'hakanfidan@fidanteknik.com', '4190641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'GÖKÇE MAKİNA', 'MEHMET GÖKÇE', '0535 621 30 21', 'mehmetgokce@gokcemakina.com', '4390583175', 'KAYSERİ', 'KESİM'),
    (v_company_id, 'GÖKHAN PLASTİK', 'GÖKHAN YILMAZ', '0532 765 63 33', 'gokhanyilmaz@gokhanplastik.com', '4590764033', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'GÖKMEN ALÜMİNYUM', 'ALİ GÖKMEN', '0535 620 20 27', 'aligokmen@gokmenaluminyum.com', '4720741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'GÖNÜL TEKNİK', 'ERHAN GÖNÜL', '0533 432 20 21', 'erhangonul@gonulteknik.com', '4890641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'GÜLER MAKİNA', 'MUSTAFA GÜLER', '0535 621 20 21', 'mustafaguler@gulermakina.com', '5090583175', 'KAYSERİ', 'KAPLAMA'),
    (v_company_id, 'GÜNEŞ PLASTİK', 'AHMET GÜNEŞ', '0532 765 73 33', 'ahmetgunes@gunesplastik.com', '5290764033', 'İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'GÜRKAN ALÜMİNYUM', 'MEHMET GÜRKAN', '0535 620 30 27', 'mehmetgurkan@gurkanaluminyum.com', '5420741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'GÜRSEL TEKNİK', 'HALİL GÜRSEL', '0533 432 10 21', 'halilgursel@gurselteknik.com', '5590641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'HAKAN MAKİNA', 'HAKAN YILMAZ', '0535 621 10 21', 'hakanyilmaz@hakanmakina.com', '5790583175', 'KAYSERİ', 'KESİM'),
    (v_company_id, 'HALİL PLASTİK', 'HALİL DEMİR', '0532 765 83 33', 'halildemir@halilplastik.com', '5990764033', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'HAMZA ALÜMİNYUM', 'HAMZA KAYA', '0535 620 40 27', 'hamzakaya@hamzaaluminyum.com', '6120741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'HASAN TEKNİK', 'HASAN YILMAZ', '0533 432 00 21', 'hasanyilmaz@hasanteknik.com', '6290641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'HÜSEYİN MAKİNA', 'HÜSEYİN DEMİR', '0535 621 00 21', 'huseyindemir@huseyinmakina.com', '6490583175', 'KAYSERİ', 'KAPLAMA'),
    (v_company_id, 'İBRAHİM PLASTİK', 'İBRAHİM KAYA', '0532 765 93 33', 'ibrahimkaya@ibrahimplastik.com', '6690764033', 'İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'İLHAN ALÜMİNYUM', 'İLHAN YILMAZ', '0535 620 50 27', 'ilhanyilmaz@ilhanaluminyum.com', '6820741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'İSMAİL TEKNİK', 'İSMAİL DEMİR', '0533 431 90 21', 'ismaildemir@ismailteknik.com', '6990641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'KADIR MAKİNA', 'KADIR KAYA', '0535 620 90 21', 'kadirkaya@kadirmakina.com', '7190583175', 'KAYSERİ', 'KESİM'),
    (v_company_id, 'KARA PLASTİK', 'MURAT KARA', '0532 766 03 33', 'muratkara@karaplastik.com', '7390764033', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'KARAHAN ALÜMİNYUM', 'ALİ KARAHAN', '0535 620 60 27', 'alikarahan@karahanaluminyum.com', '7520741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'KAYA TEKNİK', 'MEHMET KAYA', '0533 431 80 21', 'mehmetkaya@kayateknik.com', '7690641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'KEMAL MAKİNA', 'KEMAL YILMAZ', '0535 620 80 21', 'kemalyilmaz@kemalmakina.com', '7890583175', 'KAYSERİ', 'KAPLAMA'),
    (v_company_id, 'KENAN PLASTİK', 'KENAN DEMİR', '0532 766 13 33', 'kenandemir@kenanplastik.com', '8090764033', 'İSTANBUL', 'HAMMADDE'),
    (v_company_id, 'KILINÇ ALÜMİNYUM', 'HALİL KILINÇ', '0535 620 70 27', 'halilkilinc@kilincaluminyum.com', '8220741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'KOÇAK TEKNİK', 'ERHAN KOÇAK', '0533 431 70 21', 'erhankocak@kocakteknik.com', '8390641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'KURT MAKİNA', 'AYHAN KURT', '0535 620 70 21', 'ayhankurt@kurtmakina.com', '8590583175', 'KAYSERİ', 'KESİM'),
    (v_company_id, 'MEHMET PLASTİK', 'MEHMET YILMAZ', '0532 766 23 33', 'mehmetyilmaz@mehmetplastik.com', '8790764033', 'ANKARA', 'HAMMADDE'),
    (v_company_id, 'MURAT ALÜMİNYUM', 'MURAT DEMİR', '0535 620 80 27', 'muratdemir@murataluminyum.com', '8920741884', 'KAYSERİ', 'ALÜMİNYUM'),
    (v_company_id, 'MUSTAFA TEKNİK', 'MUSTAFA KAYA', '0533 431 60 21', 'mustafakaya@mustafateknik.com', '9090641884', 'ANKARA', 'KESİCİ TAKIM'),
    (v_company_id, 'ÖMER MAKİNA', 'ÖMER YILMAZ', '0535 620 60 21', 'omeryilmaz@omermakina.com', '9290583175', 'KAYSERİ', 'KAPLAMA'),
    (v_company_id, 'ÖZKAN PLASTİK', 'BURAK ÖZKAN', '0532 766 33 33', 'burakozkan@ozkanplastik.com', '9490764033', 'İSTANBUL', 'HAMMADDE');

    RAISE NOTICE 'Tedarikçiler başarıyla eklendi!';
END $$;
