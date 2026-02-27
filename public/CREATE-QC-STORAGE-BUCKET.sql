-- Kalite kontrol dokümanları için Supabase Storage bucket oluşturma
-- Bu dosya Supabase Dashboard'da çalıştırılacak
-- NOT: Bucket'ı Dashboard UI üzerinden manuel olarak oluşturmanız gerekiyor

-- Bucket Adı: quality-control-docs
-- Public: false (özel bucket)
-- File size limit: 10 MB
-- Allowed MIME types: application/pdf, image/*

-- ========================================
-- ADIM 1: Dashboard'dan Bucket Oluştur
-- ========================================
-- 1. Supabase Dashboard > Storage > Create bucket
-- 2. Name: quality-control-docs
-- 3. Public bucket: OFF (private)
-- 4. Save

-- ========================================
-- ADIM 2: RLS (Row Level Security) Politikaları
-- ========================================
-- Bucket oluşturduktan sonra aşağıdaki politikaları SQL Editor'de çalıştırın

-- Kullanıcılar kendi şirketlerinin dokümanlarını görebilir
CREATE POLICY "Users can view their company QC docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'quality-control-docs' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Kullanıcılar kendi şirketlerine doküman yükleyebilir
CREATE POLICY "Users can upload QC docs to their company"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'quality-control-docs' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Kullanıcılar kendi şirketlerinin dokümanlarını silebilir
CREATE POLICY "Users can delete their company QC docs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'quality-control-docs' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM profiles WHERE id = auth.uid()
  )
);

-- Başarı mesajı
DO $$
BEGIN
    RAISE NOTICE '✅ Kalite kontrol dokümanları bucket politikaları hazır!';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Bucket: quality-control-docs';
    RAISE NOTICE '   - Private bucket (signed URLs kullanılacak)';
    RAISE NOTICE '   - RLS politikaları aktif';
    RAISE NOTICE '   - Her şirket sadece kendi dokümanlarını görebilir';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  DİKKAT: Bucket''ı Dashboard''dan manuel oluşturmayı unutmayın!';
END $$;
