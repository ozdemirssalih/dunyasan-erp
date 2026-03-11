-- ÇEK BELGELERİ İÇİN STORAGE BUCKET KURULUMU
-- ==============================================

-- ADIM 1: Supabase Dashboard'a git
-- ADIM 2: Storage > Create Bucket
-- ADIM 3: Bucket Name: check-documents
-- ADIM 4: Public: No (güvenlik için private olmalı)
-- ADIM 5: Create Bucket'a tıkla

-- ADIM 6: Aşağıdaki SQL'i çalıştır (Storage Policies için)

-- Policy 1: Kullanıcılar çek belgelerini yükleyebilir
CREATE POLICY "Users can upload check documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'check-documents');

-- Policy 2: Kullanıcılar çek belgelerini görüntüleyebilir
CREATE POLICY "Users can view check documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'check-documents');

-- Policy 3: Kullanıcılar çek belgelerini silebilir
CREATE POLICY "Users can delete check documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'check-documents');

-- Policy 4: Kullanıcılar çek belgelerini güncelleyebilir
CREATE POLICY "Users can update check documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'check-documents');

-- NOT: Eğer policy'ler zaten varsa ve hata alıyorsanız,
-- önce Supabase Dashboard'dan Storage > check-documents > Policies
-- bölümünden eski policy'leri manuel olarak silin.
