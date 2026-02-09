-- Üretim deposundaki yanlış/test stok verilerini temizle
-- ÖNEMLİ: Bu işlem üretim deposunu TAMAMEN sıfırlar!
-- Gerçek üretim verileri varsa YEDEK ALIN!

-- RLS bypass için (Supabase SQL Editor'da çalıştırılmalı)
-- Tüm production_inventory kayıtlarını sil
TRUNCATE TABLE production_inventory RESTART IDENTITY CASCADE;

-- Alternatif: DELETE komutu (eğer TRUNCATE çalışmazsa)
-- DELETE FROM production_inventory WHERE TRUE;

-- Alternatif: Sadece belirli bir firma için sil
-- DELETE FROM production_inventory WHERE company_id = 'fc777863-e790-4774-98a5-a6b0af06a59f';

-- Alternatif: Sadece hammaddeleri sil (bitmiş ürünleri koru)
-- DELETE FROM production_inventory WHERE item_type = 'raw_material';

-- Alternatif: Sadece bitmiş ürünleri sil (hammaddeleri koru)
-- DELETE FROM production_inventory WHERE item_type = 'finished_product';

-- Kontrol: Kaç kayıt kaldı?
SELECT COUNT(*) as remaining_records FROM production_inventory;

-- Success message
SELECT 'production_inventory tablosu tamamen temizlendi (hammadde + bitmiş ürün). Temiz başlayabilirsiniz.' as message;
