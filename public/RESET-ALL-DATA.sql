-- TÜM VERİLERİ SIFIRLA (TEST İÇİN)
-- DİKKAT: Bu script tüm iş verilerini siler, sadece profiles ve companies kalır

-- Önce child tablolardan başla (foreign key constraints için)

-- Proje ilişkili veriler (varsa sil)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_materials') THEN
        DELETE FROM project_materials;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_outputs') THEN
        DELETE FROM production_outputs;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_scrap_records') THEN
        DELETE FROM production_scrap_records;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'production_to_machine_transfers') THEN
        DELETE FROM production_to_machine_transfers;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'quality_controls') THEN
        DELETE FROM quality_controls;
    END IF;
END $$;

-- Tezgahlar (project_id'yi null yap önce)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'machines') THEN
        UPDATE machines SET project_id = NULL;
        DELETE FROM machines;
    END IF;
END $$;

-- Projeler
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
        DELETE FROM projects;
    END IF;
END $$;

-- Depo ve stok
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'warehouse_items') THEN
        DELETE FROM warehouse_items;
    END IF;
END $$;

-- Müşteriler
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_companies') THEN
        DELETE FROM customer_companies;
    END IF;
END $$;

-- Siparişler
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orders') THEN
        DELETE FROM orders;
    END IF;
END $$;

-- Faturalar
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices') THEN
        DELETE FROM invoices;
    END IF;
END $$;

-- Cari hesaplar
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'accounts') THEN
        DELETE FROM accounts;
    END IF;
END $$;

-- Personel
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'personnel') THEN
        DELETE FROM personnel;
    END IF;
END $$;

-- Maliyet kayıtları
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cost_records') THEN
        DELETE FROM cost_records;
    END IF;
END $$;

-- Başarı mesajı
SELECT 'TÜM VERİLER SİLİNDİ - Profiles ve Companies korundu' as message;
