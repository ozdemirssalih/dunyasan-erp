-- Üretim deposundaki yanlış stok verilerini temizle
-- Sadece gerçek verileri tut

-- Önce mevcut company_id'yi al (örnek)
-- Bu SQL'i çalıştırırken kendi company_id'nizi kullanın

-- Tüm production_inventory kayıtlarını sil
DELETE FROM production_inventory;

-- Alternatif: Sadece belirli bir firma için sil
-- DELETE FROM production_inventory WHERE company_id = 'BURAYA-COMPANY-ID-GİRİN';

-- Success message
SELECT 'production_inventory tablosu temizlendi. Yeni stok kayıtları manuel olarak eklenebilir.' as message;
