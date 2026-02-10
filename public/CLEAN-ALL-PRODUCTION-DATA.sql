-- TUM URETIM, KALITE KONTROL VE DEPO VERILERINI TEMIZLE
-- DIKKAT: Bu islem GERI ALINAMAZ! Tum gecmis veriler silinecek.

-- ============================================================
-- 1. ONCE KONTROL: Hangi verileri siliyoruz?
-- ============================================================

SELECT 'SILINECEK VERILER:' as info;

SELECT
    'production_outputs' as tablo,
    COUNT(*) as kayit_sayisi,
    'Uretim kayitlari' as aciklama
FROM production_outputs;

SELECT
    'production_scrap_records' as tablo,
    COUNT(*) as kayit_sayisi,
    'Fire kayitlari' as aciklama
FROM production_scrap_records;

SELECT
    'production_to_machine_transfers' as tablo,
    COUNT(*) as kayit_sayisi,
    'Tezgaha transfer kayitlari' as aciklama
FROM production_to_machine_transfers;

SELECT
    'machine_inventory' as tablo,
    COUNT(*) as kayit_sayisi,
    'Tezgah stok kayitlari' as aciklama
FROM machine_inventory;

SELECT
    'production_inventory' as tablo,
    COUNT(*) as kayit_sayisi,
    'Uretim deposu kayitlari' as aciklama
FROM production_inventory;

SELECT
    'quality_control_inventory' as tablo,
    COUNT(*) as kayit_sayisi,
    'Kalite deposu kayitlari' as aciklama
FROM quality_control_inventory;

SELECT
    'warehouse_items' as tablo,
    COUNT(*) as toplam_urun,
    SUM(current_stock) as toplam_stok,
    'Ana depo stok kayitlari' as aciklama
FROM warehouse_items;

SELECT
    'production_material_requests' as tablo,
    COUNT(*) as kayit_sayisi,
    'Uretim malzeme talepleri' as aciklama
FROM production_material_requests;

SELECT
    'production_to_warehouse_transfers' as tablo,
    COUNT(*) as kayit_sayisi,
    'Uretim->Depo transferleri' as aciklama
FROM production_to_warehouse_transfers;

SELECT
    'qc_to_warehouse_transfers' as tablo,
    COUNT(*) as kayit_sayisi,
    'Kalite->Depo transferleri' as aciklama
FROM qc_to_warehouse_transfers;

SELECT
    'warehouse_transactions' as tablo,
    COUNT(*) as kayit_sayisi,
    'Depo islem gecmisi' as aciklama
FROM warehouse_transactions;

SELECT
    'production_to_qc_transfers' as tablo,
    COUNT(*) as kayit_sayisi,
    'Uretim->Kalite Kontrol transferleri' as aciklama
FROM production_to_qc_transfers;

-- ============================================================
-- 2. VERILERI TEMIZLE (GERI ALINAMAZ!)
-- ============================================================

-- Uretim ciktilari
DELETE FROM production_outputs;

-- Fire kayitlari
DELETE FROM production_scrap_records;

-- Tezgaha transfer kayitlari
DELETE FROM production_to_machine_transfers;

-- Tezgah stogu
DELETE FROM machine_inventory;

-- Uretim deposu (tum hammadde ve bitmis urun stoklari)
DELETE FROM production_inventory;

-- Kalite kontrol deposu
DELETE FROM quality_control_inventory;

-- Uretim malzeme talepleri
DELETE FROM production_material_requests;

-- Uretim->Depo transferleri
DELETE FROM production_to_warehouse_transfers;

-- Kalite->Depo transferleri
DELETE FROM qc_to_warehouse_transfers;

-- Depo islem gecmisi
DELETE FROM warehouse_transactions;

-- Uretim->Kalite Kontrol transferleri
DELETE FROM production_to_qc_transfers;

-- Ana depo stoklarini sifirla (warehouse_items tablosunda)
UPDATE warehouse_items
SET current_stock = 0
WHERE current_stock IS NOT NULL;

-- ============================================================
-- 3. KONTROL: Veriler silindi mi?
-- ============================================================

SELECT 'TEMIZLEME SONUCLARI:' as info;

SELECT
    'production_outputs' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM production_outputs;

SELECT
    'production_scrap_records' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM production_scrap_records;

SELECT
    'production_to_machine_transfers' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM production_to_machine_transfers;

SELECT
    'machine_inventory' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM machine_inventory;

SELECT
    'production_inventory' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM production_inventory;

SELECT
    'quality_control_inventory' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM quality_control_inventory;

SELECT
    'production_material_requests' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM production_material_requests;

SELECT
    'production_to_warehouse_transfers' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM production_to_warehouse_transfers;

SELECT
    'qc_to_warehouse_transfers' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM qc_to_warehouse_transfers;

SELECT
    'warehouse_transactions' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM warehouse_transactions;

SELECT
    'production_to_qc_transfers' as tablo,
    COUNT(*) as kalan_kayit,
    CASE WHEN COUNT(*) = 0 THEN 'Temizlendi' ELSE 'Hala kayit var!' END as durum
FROM production_to_qc_transfers;

SELECT
    'warehouse_items' as tablo,
    SUM(current_stock) as toplam_stok,
    CASE WHEN SUM(current_stock) = 0 OR SUM(current_stock) IS NULL THEN 'Stoklar sifirlandi' ELSE 'Hala stok var!' END as durum
FROM warehouse_items;

-- ============================================================
-- 4. BASARI MESAJI
-- ============================================================

SELECT 'TUM URETIM, KALITE VE DEPO VERILERI TEMIZLENDI!' as mesaj;
SELECT 'Ana depo stoklari sifirlandi (warehouse_items.current_stock = 0).' as bilgi;
SELECT 'Bu islem geri alinamaz - tum gecmis veriler silindi.' as uyari;
