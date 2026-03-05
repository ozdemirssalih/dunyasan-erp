-- Migration: Add document_url column to accounting tables
-- Date: 2026-03-05
-- Description: Adds document upload capability to current_account_transactions and cash_transactions

-- Add document_url to current_account_transactions
ALTER TABLE current_account_transactions
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add document_url to cash_transactions
ALTER TABLE cash_transactions
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Create storage bucket for accounting documents (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('accounting-documents', 'accounting-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for accounting-documents bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload documents for their own company
CREATE POLICY "Users can upload documents for their company"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'accounting-documents'
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE company_id = (
      SELECT split_part(name, '/', 1)::uuid FROM storage.objects WHERE id = storage.objects.id
    )
  )
);

-- Policy: Users can view documents for their own company
CREATE POLICY "Users can view documents for their company"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'accounting-documents'
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE company_id = (
      SELECT split_part(name, '/', 1)::uuid FROM storage.objects WHERE id = storage.objects.id
    )
  )
);

-- Policy: Users can delete documents for their own company
CREATE POLICY "Users can delete documents for their company"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'accounting-documents'
  AND auth.uid() IN (
    SELECT id FROM profiles WHERE company_id = (
      SELECT split_part(name, '/', 1)::uuid FROM storage.objects WHERE id = storage.objects.id
    )
  )
);

-- Add comment
COMMENT ON COLUMN current_account_transactions.document_url IS 'URL to uploaded PDF document in Supabase Storage';
COMMENT ON COLUMN cash_transactions.document_url IS 'URL to uploaded PDF document in Supabase Storage';
