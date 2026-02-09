-- Üretim deposundaki yanlış/test stok verilerini temizle
-- ÖNEMLİ: Bu işlem üretim deposunu TAMAMEN sıfırlar!
-- Gerçek üretim verileri varsa YEDEK ALIN!

-- Tüm production_inventory kayıtlarını sil (hem hammadde hem bitmiş ürün)
DELETE FROM production_inventory;

-- Alternatif: Sadece belirli bir firma için sil
-- DELETE FROM production_inventory WHERE company_id = 'BURAYA-COMPANY-ID-GİRİN';

-- Alternatif: Sadece hammaddeleri sil (bitmiş ürünleri koru)
-- DELETE FROM production_inventory WHERE item_type = 'raw_material';

-- Alternatif: Sadece bitmiş ürünleri sil (hammaddeleri koru)
-- DELETE FROM production_inventory WHERE item_type = 'finished_product';

-- Success message
SELECT 'production_inventory tablosu tamamen temizlendi (hammadde + bitmiş ürün). Temiz başlayabilirsiniz.' as message;
