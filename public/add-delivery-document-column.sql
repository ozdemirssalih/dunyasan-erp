-- =============================================
-- TESLİM TUTANAĞI ALANI EKLEME
-- =============================================
-- warehouse_transactions ve warehouse_qc_requests
-- tablolarına delivery_document_url kolonu ekler
-- =============================================

-- 1. warehouse_transactions tablosuna delivery_document_url ekle
ALTER TABLE warehouse_transactions
ADD COLUMN IF NOT EXISTS delivery_document_url TEXT;

-- 2. warehouse_qc_requests tablosuna delivery_document_url ekle
ALTER TABLE warehouse_qc_requests
ADD COLUMN IF NOT EXISTS delivery_document_url TEXT;

-- 3. Kolon açıklamaları
COMMENT ON COLUMN warehouse_transactions.delivery_document_url IS 'Teslim tutanağı dosyasının URL''si (Supabase Storage)';
COMMENT ON COLUMN warehouse_qc_requests.delivery_document_url IS 'Teslim tutanağı dosyasının URL''si (Supabase Storage)';

-- Başarı mesajı
SELECT
  '✅ Teslim tutanağı alanları eklendi!' as message,
  'warehouse_transactions ve warehouse_qc_requests tablolarına delivery_document_url kolonu eklendi.' as details;

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
