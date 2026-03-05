-- Storage Policies for accounting-documents bucket
-- Run this in Supabase SQL Editor after creating the bucket manually

-- Policy 1: Users can upload documents for their company
CREATE POLICY "Users can upload accounting documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'accounting-documents'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy 2: Users can view documents for their company
CREATE POLICY "Users can view accounting documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'accounting-documents'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy 3: Users can delete documents for their company
CREATE POLICY "Users can delete accounting documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'accounting-documents'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);
