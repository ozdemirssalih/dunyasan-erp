-- =============================================
-- TESLİM TUTANAĞI VE İŞLEM TARİHİ ALANLARI EKLEME
-- =============================================
-- Tüm stok tablolarına delivery_document_url ve transaction_date kolonlarını ekler
-- =============================================

-- 1. warehouse_transactions tablosuna alanlar ekle
ALTER TABLE warehouse_transactions
ADD COLUMN IF NOT EXISTS delivery_document_url TEXT,
ADD COLUMN IF NOT EXISTS transaction_date DATE;

-- 2. warehouse_qc_requests tablosuna alanlar ekle
ALTER TABLE warehouse_qc_requests
ADD COLUMN IF NOT EXISTS delivery_document_url TEXT,
ADD COLUMN IF NOT EXISTS transaction_date DATE;

-- 3. warehouse_items tablosuna alanlar ekle (Stok/Hammadde - Depo)
ALTER TABLE warehouse_items
ADD COLUMN IF NOT EXISTS delivery_document_url TEXT,
ADD COLUMN IF NOT EXISTS transaction_date DATE;

-- 4. inventory tablosuna alanlar ekle (Stok Kalemi)
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS delivery_document_url TEXT,
ADD COLUMN IF NOT EXISTS transaction_date DATE;

-- 5. tools tablosuna alanlar ekle (Takımhane)
ALTER TABLE tools
ADD COLUMN IF NOT EXISTS delivery_document_url TEXT,
ADD COLUMN IF NOT EXISTS transaction_date DATE;

-- 6. Kolon açıklamaları
COMMENT ON COLUMN warehouse_transactions.delivery_document_url IS 'Teslim tutanağı dosyasının URL''si (Supabase Storage)';
COMMENT ON COLUMN warehouse_transactions.transaction_date IS 'İşlem tarihi';
COMMENT ON COLUMN warehouse_qc_requests.delivery_document_url IS 'Teslim tutanağı dosyasının URL''si (Supabase Storage)';
COMMENT ON COLUMN warehouse_qc_requests.transaction_date IS 'İşlem tarihi';
COMMENT ON COLUMN warehouse_items.delivery_document_url IS 'Teslim tutanağı dosyasının URL''si (Supabase Storage)';
COMMENT ON COLUMN warehouse_items.transaction_date IS 'İşlem tarihi';
COMMENT ON COLUMN inventory.delivery_document_url IS 'Teslim tutanağı dosyasının URL''si (Supabase Storage)';
COMMENT ON COLUMN inventory.transaction_date IS 'İşlem tarihi';
COMMENT ON COLUMN tools.delivery_document_url IS 'Teslim tutanağı dosyasının URL''si (Supabase Storage)';
COMMENT ON COLUMN tools.transaction_date IS 'İşlem tarihi';

-- Başarı mesajı
SELECT
  '✅ Teslim tutanağı ve işlem tarihi alanları eklendi!' as message,
  'Tüm stok tablolarına delivery_document_url ve transaction_date kolonları eklendi.' as details;

-- =============================================
-- SUPABASE STORAGE BUCKET OLUŞTURMA
-- =============================================
-- Not: Aşağıdaki komutlar Supabase Dashboard'dan
-- manuel olarak çalıştırılmalıdır (Storage bölümü)
--
-- 1. Storage > Create Bucket
-- 2. Bucket Name: delivery-documents
-- 3. Public: Yes (veya No, tercih edilebilir)
-- 4. File size limit: 10 MB
--
-- Alternatif olarak SQL ile:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('delivery-documents', 'delivery-documents', true);
--
-- Bucket policies (isteğe bağlı):
-- - Authenticated kullanıcılar yükleyebilir
-- - Herkes okuyabilir (public bucket ise)
-- =============================================
