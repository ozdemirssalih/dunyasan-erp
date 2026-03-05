-- Add document_url columns to accounting tables
-- Run this in Supabase SQL Editor

-- Add document_url to current_account_transactions
ALTER TABLE current_account_transactions
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add document_url to cash_transactions
ALTER TABLE cash_transactions
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add comments
COMMENT ON COLUMN current_account_transactions.document_url IS 'URL to uploaded PDF document in Supabase Storage';
COMMENT ON COLUMN cash_transactions.document_url IS 'URL to uploaded PDF document in Supabase Storage';
