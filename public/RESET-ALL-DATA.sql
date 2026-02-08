-- TÜM VERİLERİ SIFIRLA (TEST İÇİN)
-- DİKKAT: Bu script tüm iş verilerini siler, sadece profiles ve companies kalır

-- Önce child tablolardan başla (foreign key constraints için)

-- Proje ilişkili veriler
DELETE FROM project_materials;
DELETE FROM production_outputs;
DELETE FROM production_to_machine_transfers;
DELETE FROM quality_controls;

-- Tezgahlar (project_id'yi null yap önce)
UPDATE machines SET project_id = NULL;
DELETE FROM machines;

-- Projeler
DELETE FROM projects;

-- Depo ve stok
DELETE FROM warehouse_items;

-- Müşteriler
DELETE FROM customer_companies;

-- Siparişler
DELETE FROM orders;

-- Faturalar
DELETE FROM invoices;

-- Cari hesaplar
DELETE FROM accounts;

-- Personel
DELETE FROM personnel;

-- Maliyet kayıtları
DELETE FROM cost_records;

-- Takımhane (varsa)
-- DELETE FROM toolroom_items;

-- Üretim planları (varsa)
-- DELETE FROM production_plans;

-- Başarı mesajı
SELECT 'TÜM VERİLER SİLİNDİ - Profiles ve Companies korundu' as message;
