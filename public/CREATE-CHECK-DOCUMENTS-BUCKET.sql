-- Çek belgeleri için storage bucket oluştur
-- Supabase Dashboard > Storage > Create Bucket

-- Bucket Name: check-documents
-- Public: Yes (veya No, tercihe göre)

-- Storage policies
-- Supabase Dashboard > Storage > check-documents > Policies

-- Policy 1: Users can upload check documents
CREATE POLICY "Users can upload check documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'check-documents');

-- Policy 2: Users can view check documents
CREATE POLICY "Users can view check documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'check-documents');

-- Policy 3: Users can delete their check documents
CREATE POLICY "Users can delete check documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'check-documents');

-- Policy 4: Users can update check documents
CREATE POLICY "Users can update check documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'check-documents');
