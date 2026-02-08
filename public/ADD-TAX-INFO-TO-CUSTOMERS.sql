-- Add tax information columns to customer_companies table

-- Add tax_number column
ALTER TABLE customer_companies
ADD COLUMN IF NOT EXISTS tax_number VARCHAR(50);

-- Add tax_office column
ALTER TABLE customer_companies
ADD COLUMN IF NOT EXISTS tax_office VARCHAR(100);

-- Success message
SELECT 'tax_number ve tax_office kolonları customer_companies tablosuna eklendi' as message;
