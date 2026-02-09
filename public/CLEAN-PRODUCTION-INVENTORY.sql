-- Üretim deposundaki yanlış/test stok verilerini temizle
-- ÖNEMLİ: Bu işlem üretim deposunu sıfırlar!
-- Gerçek üretim verileri varsa YEDEK ALIN!

-- Tüm production_inventory kayıtlarını sil
DELETE FROM production_inventory;

-- Alternatif: Sadece belirli bir firma için sil
-- DELETE FROM production_inventory WHERE company_id = 'BURAYA-COMPANY-ID-GİRİN';

-- Alternatif: Sadece hammaddeleri sil (bitmiş ürünleri koru)
-- DELETE FROM production_inventory WHERE item_type = 'raw_material';

-- Success message
SELECT 'production_inventory tablosu temizlendi. Ana depodan hammadde transfer edilebilir.' as message;
